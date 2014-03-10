#Copyright (c) 2014 Ansible, Inc.
# All Rights Reserved

# Python
import os
import datetime
import logging
import json
import signal
import time
from optparse import make_option
from multiprocessing import Process

# Django
from django.conf import settings
from django.core.management.base import NoArgsCommand, CommandError
from django.db import transaction, DatabaseError
from django.contrib.auth.models import User
from django.utils.dateparse import parse_datetime
from django.utils.timezone import now, is_aware, make_aware
from django.utils.tzinfo import FixedOffset

# AWX
from awx.main.models import *
from awx.main.tasks import handle_work_error
from awx.main.utils import get_system_task_capacity, decrypt_field

# ZeroMQ
import zmq

# Celery
from celery.task.control import inspect

class SimpleDAG(object):

    def __init__(self, nodes=[], edges=[]):
        self.nodes = nodes
        self.edges = edges

    def __contains__(self, obj):
        for node in self.nodes:
            if node['node_object'] == obj:
                return True
        return False

    def __len__(self):
        return len(self.nodes)

    def __iter__(self):
        return self.nodes.__iter__()

    def generate_graphviz_plot(self):
        doc = """
        digraph g {
        rankdir = LR
        """
        for n in self.nodes:
            doc += "%s [color = %s]\n" % (str(n), "red" if n.status == 'running' else "black")
        for from, to in self.edges:
            doc += "%s -> %s;\n" % (str(self.nodes[from]), str(self.nodes[to]))
        doc += "}"
        gv_file = open('/tmp/graph.gv', 'w')
        gv_file.write(doc)
        gv_file.close()

    def add_node(self, obj, metadata=None):
        if self.find_ord(obj) is None:
            self.nodes.append(dict(node_object=obj, metadata=metadata))

    def add_edge(self, from_obj, to_obj):
        from_obj_ord = self.find_ord(from_obj)
        to_obj_ord = self.find_ord(from_obj)
        if from_obj_ord is None or to_obj_ord is None:
            raise LookupError("Object not found")
        self.edges.append((from_obj_ord, to_obj_ord))

    def add_edges(self, edgelist):
        for from_obj, to_obj in edgelist:
            self.add_edge(from_obj, to_obj)

    def find_ord(self, obj):
        for idx in range(len(self.nodes)):
            if obj == self.nodes[idx]['node_object']:
                return idx
        return None

    def get_node_type(self, obj):
        if type(obj) == Job:
            return "ansible_playbook"
        elif type(obj) == InventoryUpdate:
            return "inventory_update"
        elif type(obj) == ProjectUpdate:
            return "project_update"
        return "unknown"

    def get_dependencies(self, obj):
        antecedents = []
        this_ord = find_ord(self, obj)
        for node, dep in self.edges:
            if node == this_ord:
                antecedents.append(self.nodes[dep])
        return antecedents

    def get_dependents(self, obj):
        decendents = []
        this_ord = find_ord(self, obj)
        for node, dep in self.edges:
            if dep == this_ord:
                decendents.append(self.nodes[node])
        return decendents

    def get_leaf_nodes():
        leafs = []
        for n in self.nodes:
            if len(self.get_dependencies(n)) < 1:
                leafs.append(n)
        return n

def get_tasks():
    # TODO: Replace this when we can grab all objects in a sane way
    graph_jobs = [j for j in Job.objects.filter(status__in=('new', 'waiting', 'pending', 'running'))]
    graph_inventory_updates = [iu for iu in InventoryUpdate.objects.filter(status__in=('new', 'waiting', 'pending', 'running'))]
    graph_project_updates = [pu for pu in ProjectUpdate.objects.filter(status__in=('new', 'waiting', 'pending', 'running'))]
    all_actions = sorted(graph_jobs + graph_inventory_updates + graph_project_updates, key=lambda task: task.created)

def rebuild_graph(message):
    inspector = inspect()
    active_task_queues = inspector.active()
    active_tasks = []
    for queue in active_task_queues:
        active_tasks += active_task_queues[queue]

    all_sorted_tasks = get_tasks()
    running_tasks = filter(lambda t: t.status == 'running', all_sorted_tasks)
    waiting_tasks = filter(lambda t: t.status != 'running', all_sorted_tasks)
    new_tasks = filter(lambda t: t.status == 'new', all_sorted_tasks)

    # Check running tasks and make sure they are active in celery
    for task in list(running_tasks):
        if task.celery_task_id not in active_tasks:
            task.status = 'failed'
            task.result_traceback += "Task was marked as running in Tower but was not present in Celery so it has been marked as failed"
            task.save()
            running_tasks.pop(task)
            if settings.DEBUG:
                print("Task %s appears orphaned... marking as failed" % task)

    # Create and process dependencies for new tasks
    for task in new_tasks:
        task_dependencies = task.generate_dependencies(running_tasks + waiting_tasks) #TODO: other 'new' tasks? Need to investigate this scenario
        for dep in task_dependencies:
            # We recalculate the created time for the moment to ensure the dependencies are always sorted in the right order relative to the dependent task
            time_delt = len(task_dependencies) - task_dependencies.index(dep)
            dep.created = task.created - datetime.timedelta(seconds=1+time_delt)
            dep.save()
            waiting_tasks.insert(dep, waiting_tasks.index(task))
        
    # Rebuild graph
    graph = SimpleDAG()
    for task in running_tasks:
        graph.add_node(task)
    for wait_task in waiting_tasks:
        node_dependencies = []
        for node in graph:
            if wait_task.is_blocked_by(node['node_objects']):
                node_dependencies.append(node)
        graph.add_node(wait_task)
        graph.add_edges([(wait_task, n) for n in node_dependencies])
    if settings.DEBUG:
        graph.generate_graphviz_plot()
    return graph

def process_graph(graph, task_capacity):
    leaf_nodes = graph.get_leaf_nodes()
    running_nodes = filter(lambda x['node_object'].status == 'running', leaf_nodes)
    running_impact = sum([t['node_object'].task_impact for t in running_nodes])
    ready_nodes = filter(lambda x['node_object'].status != 'running', leaf_nodes)
    remaining_volume = task_capacity - running_impact
    for task_node in ready_nodes:
        node_obj = task_node['node_object']
        node_args = task_node['metadata']
        impact = node_obj.task_impact
        if impact <= remaining_volume or running_impact == 0:
            dependent_nodes = [{'type': graph.get_node_type(n), 'id': n.id} for n in graph.get_dependents()]
            error_handler = handle_work_error.s(subtasks=dependent_nodes)
            node_obj.start(error_callback=error_handler)
            remaining_volume -= impact
            running_impact += impact

def run_taskmanager(command_port):
    paused = False
    task_capacity = get_system_task_capacity()
    command_context = zmq.Context()
    command_socket = command_context.socket(zmq.REP)
    command_socket.bind(command_port)
    last_rebuild = datetime.datetime.now()
    while True:
        try:
            message = command_socket.recv_json(flags=zmq.NOBLOCK)
            command_socket.send("1")
        except zmq.core.error.ZMQError,e:
            message = None
        if message is not None or (datetime.datetime.now() - last_rebuild).seconds > 60:
            if 'pause' in message:
                paused = message['pause']
            graph = rebuild_graph(message)
            if not paused:
                process_graph(graph, task_capacity)
            last_rebuild = datetime.datetime.now()
        time.sleep(0.1)

class Command(NoArgsCommand):

    help = 'Launch the job graph runner'

    def init_logging(self):
        log_levels = dict(enumerate([logging.ERROR, logging.INFO,
                                     logging.DEBUG, 0]))
        self.logger = logging.getLogger('awx.main.commands.run_task_system')
        self.logger.setLevel(log_levels.get(self.verbosity, 0))
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter('%(message)s'))
        self.logger.addHandler(handler)
        self.logger.propagate = False

    def handle_noargs(self, **options):
        self.verbosity = int(options.get('verbosity', 1))
        self.init_logging()
        command_port = settings.TASK_COMMAND_PORT
        try:
            run_taskmanager(command_port)
        except KeyboardInterrupt:
            pass
