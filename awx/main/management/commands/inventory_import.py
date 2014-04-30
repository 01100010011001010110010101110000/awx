# Copyright (c) 2014 AnsibleWorks, Inc.
# All Rights Reserved.

# Python
import glob
import json
import logging
from optparse import make_option
import os
import re
import shlex
import string
import subprocess
import sys
import time
import traceback

# PyYAML
import yaml

# Django
from django.conf import settings
from django.core.management.base import NoArgsCommand, CommandError
from django.db import connection, transaction
from django.db.models import Q
from django.contrib.auth.models import User

# AWX
from awx.main.models import *
from awx.main.utils import ignore_inventory_computed_fields
from awx.main.signals import disable_activity_stream
from awx.main.task_engine import TaskSerializer as LicenseReader

logger = logging.getLogger('awx.main.commands.inventory_import')

LICENSE_MESSAGE = '''\
Number of licensed instances exceeded, would bring available instances to %(new_count)d, system is licensed for %(available_instances)d.
See http://www.ansible.com/ansible-tower for license extension information.'''

DEMO_LICENSE_MESSAGE = '''\
Demo mode free license count exceeded, would bring available instances to %(new_count)d, demo mode allows %(available_instances)d.
See http://www.ansible.com/ansible-tower for licensing information.'''


class MemObject(object):
    '''
    Common code shared between in-memory groups and hosts.
    '''
    
    def __init__(self, name, source_dir):
        assert name, 'no name'
        assert source_dir, 'no source dir'
        self.name = name
        self.source_dir = source_dir
    
    def load_vars(self, path):
        if os.path.exists(path) and os.path.isfile(path):
            vars_name = os.path.basename(os.path.dirname(path))
            logger.debug('Loading %s from %s', vars_name, path)
            try:
                v = yaml.safe_load(file(path, 'r').read())
                return v if hasattr(v, 'items') else {}
            except yaml.YAMLError, e:
                if hasattr(e, 'problem_mark'):
                    logger.error('Invalid YAML in %s:%s col %s', path,
                                 e.problem_mark.line + 1,
                                 e.problem_mark.column + 1)
                else:
                    logger.error('Error loading YAML from %s', path)
                raise
        return {}


class MemGroup(MemObject):
    '''
    In-memory representation of an inventory group.
    '''

    def __init__(self, name, source_dir):
        super(MemGroup, self).__init__(name, source_dir)
        self.children = []
        self.hosts = []
        self.variables = {}
        self.parents = []
        # Used on the "all" group in place of previous global variables.
        # maps host and group names to hosts to prevent redudant additions
        self.all_hosts = {}
        self.all_groups = {}

        group_vars = os.path.join(self.source_dir, 'group_vars', self.name)
        self.variables = self.load_vars(group_vars)
        logger.debug('Loaded group: %s', self.name)
        
    def child_group_by_name(self, name, loader):
        if name == 'all':
            return
        logger.debug('Looking for %s as child group of %s', name, self.name)
        # slight hack here, passing in 'self' for all_group but child=True won't use it
        group = loader.get_group(name, self, child=True)
        if group:
            # don't add to child groups if already there
            for g in self.children:
                if g.name == name:
                     return g
            logger.debug('Adding child group %s to group %s', group.name, self.name)
            self.children.append(group)
        return group

    def add_child_group(self, group):
        assert group.name is not 'all', 'group name is all'
        assert isinstance(group, MemGroup), 'not MemGroup instance'
        logger.debug('Adding child group %s to parent %s', group.name, self.name)
        if group not in self.children:
            self.children.append(group)
        if not self in group.parents:
            group.parents.append(self)

    def add_host(self, host):
        assert isinstance(host, MemHost), 'not MemHost instance'
        logger.debug('Adding host %s to group %s', host.name, self.name)
        if host not in self.hosts:
            self.hosts.append(host)

    def debug_tree(self, group_names=None):
        group_names = group_names or set()
        if self.name in group_names:
            return
        logger.debug('Dumping tree for group "%s":', self.name)
        logger.debug('- Vars: %r', self.variables)
        for h in self.hosts:
            logger.debug('- Host: %s, %r',  h.name, h.variables)
        for g in self.children:
            logger.debug('- Child: %s', g.name)
        logger.debug('----')
        group_names.add(self.name)
        for g in self.children:
            g.debug_tree(group_names)


class MemHost(MemObject):
    '''
    In-memory representation of an inventory host.
    '''

    def __init__(self, name, source_dir):
        super(MemHost, self).__init__(name, source_dir)
        self.variables = {}
        self.instance_id = None
        if ':' in name:
            tokens = name.split(':')
            self.name = tokens[0]
            self.variables['ansible_ssh_port'] = int(tokens[1])
        host_vars = os.path.join(source_dir, 'host_vars', name)
        self.variables.update(self.load_vars(host_vars))
        logger.debug('Loaded host: %s', self.name)


class BaseLoader(object):
    '''
    Common functions for an inventory loader from a given source.
    '''

    def __init__(self, source, all_group=None, group_filter_re=None, host_filter_re=None):
        self.source = source
        self.source_dir = os.path.dirname(self.source)
        self.all_group = all_group or MemGroup('all', self.source_dir)
        self.group_filter_re = group_filter_re
        self.host_filter_re = host_filter_re

    def get_host(self, name):
        '''
        Return a MemHost instance from host name, creating if needed.
        '''
        if '[' in name or ']' in name:
            raise ValueError('host ranges like %s are not supported by this importer' % name)
        host_name = name.split(':')[0]
        if self.host_filter_re and not self.host_filter_re.match(host_name):
            logger.debug('Filtering host %s', host_name)
            return None
        host = None
        if not host_name in self.all_group.all_hosts:
            host = MemHost(name, self.source_dir)
            self.all_group.all_hosts[host_name] = host
        return self.all_group.all_hosts[host_name]

    def get_hosts(self, name):
        '''
        Return iterator over one or more MemHost instances from host name or
        host pattern.
        '''
        def iternest(*args):
            if args:
                for i in args[0]:
                    for j in iternest(*args[1:]):
                        yield ''.join([str(i), j])
            else:
                yield ''
        pattern_re = re.compile(r'(\[(?:(?:\d+\:\d+)|(?:[A-Za-z]\:[A-Za-z]))(?:\:\d+)??\])')
        iters = []
        for s in re.split(pattern_re, name):
            if re.match(pattern_re, s):
                start, end, step = (s[1:-1] + ':1').split(':')[:3]
                mapfunc = str
                if start in string.ascii_letters:
                    istart = string.ascii_letters.index(start)
                    iend = string.ascii_letters.index(end) + 1
                    if istart >= iend:
                        raise ValueError('invalid host range specified')
                    seq = string.ascii_letters[istart:iend:int(step)]
                else:
                    if start[0] == '0' and len(start) > 1:
                        if len(start) != len(end):
                            raise ValueError('invalid host range specified')
                        mapfunc = lambda x: str(x).zfill(len(start))
                    seq = xrange(int(start), int(end) + 1, int(step))
                iters.append(map(mapfunc, seq))
            elif re.search(r'[\[\]]', s):
                raise ValueError('invalid host range specified')
            elif s:
                iters.append([s])
        for iname in iternest(*iters):
            yield self.get_host(iname)

    def get_group(self, name, all_group=None, child=False):
        '''
        Return a MemGroup instance from group name, creating if needed.
        '''
        all_group = all_group or self.all_group
        if name == 'all':
            return all_group
        if self.group_filter_re and not self.group_filter_re.match(name):
            logger.debug('Filtering group %s', name)
            return None
        if not name in self.all_group.all_groups:
            group = MemGroup(name, self.source_dir) 
            if not child:
                all_group.add_child_group(group)
            self.all_group.all_groups[name] = group
        return self.all_group.all_groups[name]

    def load(self):
        raise NotImplementedError


class IniLoader(BaseLoader):
    '''
    Loader to read inventory from an INI-formatted text file.
    '''
    
    def load(self):
        logger.info('Reading INI source: %s', self.source)
        group = self.all_group
        input_mode = 'host'
        for line in file(self.source, 'r'):
            line = line.split('#')[0].strip()
            if not line:
                continue
            elif line.startswith('[') and line.endswith(']'):
                # Mode change, possible new group name
                line = line[1:-1].strip()
                if line.endswith(':vars'):
                    input_mode = 'vars'
                    line = line[:-5]
                elif line.endswith(':children'):
                    input_mode = 'children'
                    line = line[:-9]
                else:
                    input_mode = 'host'
                group = self.get_group(line)
            elif group:
                # If group is None, we are skipping this group and shouldn't
                # capture any children/variables/hosts under it.
                # Add hosts with inline variables, or variables/children to
                # an existing group.
                tokens = shlex.split(line)
                if input_mode == 'host':
                    for host in self.get_hosts(tokens[0]):
                        if not host:
                            continue
                        if len(tokens) > 1:
                            for t in tokens[1:]:
                                k,v = t.split('=', 1)
                                host.variables[k] = v
                        group.add_host(host) 
                elif input_mode == 'children':
                    group.child_group_by_name(line, self)
                elif input_mode == 'vars':
                    for t in tokens:
                        k, v = t.split('=', 1)
                        group.variables[k] = v
            # TODO: expansion patterns are probably not going to be supported.  YES THEY ARE!


# from API documentation:
#
# if called with --list, inventory outputs like so:
#        
# {
#    "databases"   : {
#        "hosts"   : [ "host1.example.com", "host2.example.com" ],
#        "vars"    : {
#            "a"   : true
#        }
#    },
#    "webservers"  : [ "host2.example.com", "host3.example.com" ],
#    "atlanta"     : {
#        "hosts"   : [ "host1.example.com", "host4.example.com", "host5.example.com" ],
#        "vars"    : {
#            "b"   : false
#        },
#        "children": [ "marietta", "5points" ],
#    },
#    "marietta"    : [ "host6.example.com" ],
#    "5points"     : [ "host7.example.com" ]
# }
#
# if called with --host <host_record_name> outputs JSON for that host


class ExecutableJsonLoader(BaseLoader):

    def command_to_json(self, cmd):
        data = {}
        stdout, stderr = '', ''
        try:
            proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            stdout, stderr = proc.communicate()
            if proc.returncode != 0:
                raise RuntimeError('%r failed (rc=%d) with output: %s' % (cmd, proc.returncode, stderr))
            data = json.loads(stdout)
            if not isinstance(data, dict):
                raise TypeError('Returned JSON must be a dictionary, got %s instead' % str(type(data)))
        except:
            logger.error('Failed to load JSON from: %s', stdout)
            raise
        return data

    def load(self):
        logger.info('Reading executable JSON source: %s', self.source)
        data = self.command_to_json([self.source, '--list'])
        _meta = data.pop('_meta', {})

        for k,v in data.iteritems():
            group = self.get_group(k)
            if not group:
                continue

            # Load group hosts/vars/children from a dictionary.
            if isinstance(v, dict):
                # Process hosts within a group.
                hosts = v.get('hosts', {})
                if isinstance(hosts, dict):
                    for hk, hv in hosts.iteritems():
                        host = self.get_host(hk)
                        if not host:
                            continue
                        if isinstance(hv, dict):
                            host.variables.update(hv)
                        else:
                            self.logger.warning('Expected dict of vars for '
                                                'host "%s", got %s instead',
                                                hk, str(type(hv)))
                        group.add_host(host)
                elif isinstance(hosts, (list, tuple)):
                    for hk in hosts:
                        host = self.get_host(hk)
                        if not host:
                            continue
                        group.add_host(host)
                else:
                    logger.warning('Expected dict or list of "hosts" for '
                                   'group "%s", got %s instead', k,
                                   str(type(hosts)))
                # Process group variables.
                vars = v.get('vars', {})
                if isinstance(vars, dict):
                    group.variables.update(vars)
                else:
                    self.logger.warning('Expected dict of vars for '
                                        'group "%s", got %s instead',
                                        k, str(type(vars)))
                # Process child groups.
                children = v.get('children', [])
                if isinstance(children, (list, tuple)):
                    for c in children:
                        child = self.get_group(c, self.all_group, child=True)
                        if child:
                            group.add_child_group(child)
                else:
                    self.logger.warning('Expected list of children for '
                                        'group "%s", got %s instead',
                                        k, str(type(children)))

            # Load host names from a list.
            elif isinstance(v, (list, tuple)):
                for h in v:
                    host = self.get_host(h)
                    if not host:
                        continue
                    group.add_host(host)
            else:
                logger.warning('')
                self.logger.warning('Expected dict or list for group "%s", '
                                    'got %s instead', k, str(type(v)))

            if k != 'all':
                self.all_group.add_child_group(group)

        # Invoke the executable once for each host name we've built up
        # to set their variables
        for k,v in self.all_group.all_hosts.iteritems():
            if 'hostvars' not in _meta:
                data = self.command_to_json([self.source, '--host', k])
            else:
                data = _meta['hostvars'].get(k, {})
            if isinstance(data, dict):
                v.variables.update(data)
            else:
                self.logger.warning('Expected dict of vars for '
                                    'host "%s", got %s instead',
                                    k, str(type(data)))


def load_inventory_source(source, all_group=None, group_filter_re=None,
                          host_filter_re=None, exclude_empty_groups=False):
    '''
    Load inventory from given source directory or file.
    '''
    logger.debug('Analyzing type of source: %s', source)
    original_all_group = all_group
    if not os.path.exists(source):
        raise IOError('Source does not exist: %s' % source)
    if os.path.isdir(source):
        all_group = all_group or MemGroup('all', source)
        for filename in glob.glob(os.path.join(source, '*')):
            if filename.endswith(".ini") or os.path.isdir(filename):
                continue
            load_inventory_source(filename, all_group, group_filter_re,
                                  host_filter_re)
    else:
        all_group = all_group or MemGroup('all', os.path.dirname(source))
        if os.access(source, os.X_OK):
            ExecutableJsonLoader(source, all_group, group_filter_re, host_filter_re).load()
        else:
            IniLoader(source, all_group, group_filter_re, host_filter_re).load()

    logger.debug('Finished loading from source: %s', source)
    # Exclude groups that are completely empty.
    if original_all_group is None and exclude_empty_groups:
        for name, group in all_group.all_groups.items():
            if not group.children and not group.hosts and not group.variables:
                logger.debug('Removing empty group %s', name)
                for parent in group.parents:
                    if group in parent.children:
                        parent.children.remove(group)
                del all_group.all_groups[name]
    if original_all_group is None:
        logger.info('Loaded %d groups, %d hosts', len(all_group.all_groups),
                    len(all_group.all_hosts))
    return all_group


class Command(NoArgsCommand):
    '''
    Management command to import inventory from a directory, ini file, or
    dynamic inventory script.
    '''

    help = 'Import or sync external inventory sources'

    option_list = NoArgsCommand.option_list + (
        make_option('--inventory-name', dest='inventory_name', type='str',
                    default=None, metavar='n',
                    help='name of inventory to sync'),
        make_option('--inventory-id', dest='inventory_id', type='int',
                    default=None, metavar='i', help='id of inventory to sync'),
        make_option('--overwrite', dest='overwrite', action='store_true',
                    metavar="o", default=False,
                    help='overwrite the destination hosts and groups'),
        make_option('--overwrite-vars', dest='overwrite_vars',
                    action='store_true', metavar="V", default=False,
                    help='overwrite (rather than merge) variables'),
        make_option('--keep-vars', dest='keep_vars', action='store_true',
                    metavar="k", default=False,
                    help='use database variables if set'),
        make_option('--source', dest='source', type='str', default=None,
                    metavar='s', help='inventory directory, file, or script '
                    'to load'),
        make_option('--enabled-var', dest='enabled_var', type='str',
                    default=None, metavar='v', help='host variable used to '
                    'set/clear enabled flag when host is online/offline'),
        make_option('--enabled-value', dest='enabled_value', type='str',
                    default=None, metavar='v', help='value of host variable '
                    'specified by --enabled-var that indicates host is '
                    'enabled/online.'),
        make_option('--group-filter', dest='group_filter', type='str',
                    default=None, metavar='regex', help='regular expression '
                    'to filter group name(s); only matches are imported.'),
        make_option('--host-filter', dest='host_filter', type='str',
                    default=None, metavar='regex', help='regular expression '
                    'to filter host name(s); only matches are imported.'),
        make_option('--exclude-empty-groups', dest='exclude_empty_groups',
                    action='store_true', default=False, help='when set, '
                    'exclude all groups that have no child groups, hosts, or '
                    'variables.'),
        make_option('--instance-id-var', dest='instance_id_var', type='str',
                    default=None, metavar='v', help='host variable that '
                    'specifies the unique, immutable instance ID'),
    )

    def init_logging(self):
        log_levels = dict(enumerate([logging.ERROR, logging.INFO,
                                     logging.DEBUG, 0]))
        self.logger = logging.getLogger('awx.main.commands.inventory_import')
        self.logger.setLevel(log_levels.get(self.verbosity, 0))
        handler = logging.StreamHandler()
        class Formatter(logging.Formatter):
            def format(self, record):
                record.relativeSeconds = record.relativeCreated / 1000.0
                return logging.Formatter.format(self, record)
        formatter = Formatter('%(relativeSeconds)9.3f %(levelname)-8s %(message)s')
        handler.setFormatter(formatter)
        self.logger.addHandler(handler)
        self.logger.propagate = False

    def load_inventory_from_database(self):
        '''
        Load inventory and related objects from the database.
        '''
        # Load inventory object based on name or ID.
        if self.inventory_id:
            q = dict(id=self.inventory_id)
        else:
            q = dict(name=self.inventory_name)
        try:
            self.inventory = Inventory.objects.filter(active=True).get(**q)
        except Inventory.DoesNotExist:
            raise CommandError('Inventory with %s = %s cannot be found' % q.items()[0])
        except Inventory.MultipleObjectsReturned:
            raise CommandError('Inventory with %s = %s returned multiple results' % q.items()[0])
        self.logger.info('Updating inventory %d: %s' % (self.inventory.pk,
                                                        self.inventory.name))

        # Load inventory source if specified via environment variable (when
        # inventory_import is called from an InventoryUpdate task).
        inventory_source_id = os.getenv('INVENTORY_SOURCE_ID', None)
        if inventory_source_id:
            try:
                self.inventory_source = InventorySource.objects.get(pk=inventory_source_id,
                                                                    inventory=self.inventory,
                                                                    active=True)
            except InventorySource.DoesNotExist:
                raise CommandError('Inventory source with id=%s not found' % \
                                   inventory_source_id)
            self.inventory_update = None
        # Otherwise, create a new inventory source to capture this invocation
        # via command line.
        else:
            with ignore_inventory_computed_fields():
                self.inventory_source, created = InventorySource.objects.get_or_create(
                    inventory=self.inventory,
                    group=None,
                    source='file',
                    source_path=os.path.abspath(self.source),
                    overwrite=self.overwrite,
                    overwrite_vars=self.overwrite_vars,
                    active=True,
                )
                self.inventory_update = self.inventory_source.create_inventory_update(
                    job_args=json.dumps(sys.argv),
                    job_env=dict(os.environ.items()),
                    job_cwd=os.getcwd(),
                )

        # FIXME: Wait or raise error if inventory is being updated by another
        # source.

    def load_into_database(self):
        '''
        Load inventory from in-memory groups to the database, overwriting or
        merging as appropriate.
        '''

        # Find any hosts in the database without an instance_id set that may
        # still have one available via host variables.
        db_instance_id_map = {}
        if self.instance_id_var:
            if self.inventory_source.group:
                host_qs = self.inventory_source.group.all_hosts
            else:
                host_qs = self.inventory.hosts.all()
            host_qs = host_qs.filter(active=True, instance_id='',
                                     variables__contains=self.instance_id_var)
            for host in host_qs:
                instance_id = host.variables_dict.get(self.instance_id_var, '')
                if not instance_id:
                    continue
                db_instance_id_map[instance_id] = host.pk

        # Update instance ID for each imported host and define a mapping of
        # instance IDs to MemHost instances.
        mem_instance_id_map = {}
        if self.instance_id_var:
            for mem_host in self.all_group.all_hosts.values():
                instance_id = mem_host.variables.get(self.instance_id_var, '')
                if not instance_id:
                    self.logger.warning('Host "%s" has no "%s" variable',
                                        mem_host.name, self.instance_id_var)
                    continue
                mem_host.instance_id = instance_id
                mem_instance_id_map[instance_id] = mem_host.name
            #self.logger.warning('%r', instance_id_map)

        # If overwrite is set, for each host in the database that is NOT in
        # the local list, delete it. When importing from a cloud inventory
        # source attached to a specific group, only delete hosts beneath that
        # group.  Delete each host individually so signal handlers will run.
        if self.overwrite:
            if self.inventory_source.group:
                del_hosts = self.inventory_source.group.all_hosts
                # FIXME: Also include hosts from inventory_source.managed_hosts?
            else:
                del_hosts = self.inventory.hosts.filter(active=True)
            instance_ids = set(mem_instance_id_map.keys())
            host_pks = set([v for k,v in db_instance_id_map.items() if k in instance_ids])
            host_names = set(mem_instance_id_map.values()) - set(self.all_group.all_hosts.keys())
            del_hosts = del_hosts.exclude(Q(name__in=host_names) | Q(instance_id__in=instance_ids) | Q(pk__in=host_pks))
            for host in del_hosts:
                host_name = host.name
                host.mark_inactive()
                self.logger.info('Deleted host "%s"', host_name)

        # If overwrite is set, for each group in the database that is NOT in
        # the local list, delete it. When importing from a cloud inventory
        # source attached to a specific group, only delete children of that
        # group.  Delete each group individually so signal handlers will run.
        if self.overwrite:
            if self.inventory_source.group:
                del_groups = self.inventory_source.group.all_children
                # FIXME: Also include groups from inventory_source.managed_groups?
            else:
                del_groups = self.inventory.groups.filter(active=True)
            group_names = set(self.all_group.all_groups.keys())
            del_groups = del_groups.exclude(name__in=group_names)
            for group in del_groups:
                group_name = group.name
                group.mark_inactive(recompute=False)
                self.logger.info('Group "%s" deleted', group_name)

        # If overwrite is set, clear all invalid child relationships for groups
        # and all invalid host memberships.  When importing from a cloud
        # inventory source attached to a specific group, only clear
        # relationships for hosts and groups that are beneath the inventory
        # source group.
        if self.overwrite:
            if self.inventory_source.group:
                db_groups = self.inventory_source.group.all_children
            else:
                db_groups = self.inventory.groups.filter(active=True)
            for db_group in db_groups:
                db_children = db_group.children.filter(active=True)
                mem_children = self.all_group.all_groups[db_group.name].children
                mem_children_names = [g.name for g in mem_children]
                for db_child in db_children.exclude(name__in=mem_children_names):
                    if db_child not in db_group.children.filter(active=True):
                        continue
                    db_group.children.remove(db_child)
                    self.logger.info('Group "%s" removed from group "%s"',
                                     db_child.name, db_group.name)
                db_hosts = db_group.hosts.filter(active=True)
                mem_hosts = self.all_group.all_groups[db_group.name].hosts
                mem_host_names = set([h.name for h in mem_hosts if not h.instance_id])
                mem_instance_ids = set([h.instance_id for h in mem_hosts if h.instance_id])
                db_host_pks = set([v for k,v in db_instance_id_map.items() if k in mem_instance_ids])
                for db_host in db_hosts.exclude(Q(name__in=mem_host_names) | Q(instance_id__in=mem_instance_ids) | Q(pk__in=db_host_pks)):
                    if db_host not in db_group.hosts.filter(active=True):
                        continue
                    db_group.hosts.remove(db_host)
                    self.logger.info('Host "%s" removed from group "%s"',
                                     db_host.name, db_group.name)

        # Update/overwrite variables from "all" group.  If importing from a
        # cloud source attached to a specific group, variables will be set on
        # the base group, otherwise they will be set on the whole inventory.
        if self.inventory_source.group:
            all_obj = self.inventory_source.group
            all_obj.inventory_sources.add(self.inventory_source)
            all_name = 'group "%s"' % all_obj.name
        else:
            all_obj = self.inventory
            all_name = 'inventory'
        db_variables = all_obj.variables_dict
        if self.overwrite_vars or self.overwrite:
            db_variables = self.all_group.variables
        else:
            db_variables.update(self.all_group.variables)
        if db_variables != all_obj.variables_dict:
            all_obj.variables = json.dumps(db_variables)
            all_obj.save(update_fields=['variables'])
            if self.overwrite_vars or self.overwrite:
                self.logger.info('%s variables replaced from "all" group', all_name.capitalize())
            else:
                self.logger.info('%s variables updated from "all" group', all_name.capitalize())
        else:
            self.logger.info('%s variables unmodified', all_name.capitalize())

        # FIXME: Attribute changes to superuser?

        # For each group in the local list, create it if it doesn't exist in
        # the database.  Otherwise, update/replace database variables from the
        # imported data.  Associate with the inventory source group if
        # importing from cloud inventory source.
        for k,v in self.all_group.all_groups.iteritems():
            variables = json.dumps(v.variables)
            defaults = dict(variables=variables, description='imported')
            group, created = self.inventory.groups.get_or_create(name=k,
                                                                 defaults=defaults)
            # Access auto one-to-one attribute to create related object.
            group.inventory_source
            if created:
                self.logger.info('Group "%s" added', k)
            else:
                db_variables = group.variables_dict
                if self.overwrite_vars or self.overwrite:
                    db_variables = v.variables
                else:
                    db_variables.update(v.variables)
                if db_variables != group.variables_dict:
                    group.variables = json.dumps(db_variables)
                    group.save(update_fields=['variables'])
                    if self.overwrite_vars or self.overwrite:
                        self.logger.info('Group "%s" variables replaced', k)
                    else:
                        self.logger.info('Group "%s" variables updated', k)
                else:
                    self.logger.info('Group "%s" variables unmodified', k)
            if self.inventory_source.group and self.inventory_source.group != group:
                self.inventory_source.group.children.add(group)
            group.inventory_sources.add(self.inventory_source)

        # For each host in the local list, create it if it doesn't exist in
        # the database.  Otherwise, update/replace database variables from the
        # imported data.  Associate with the inventory source group if
        # importing from cloud inventory source.
        for k,v in self.all_group.all_hosts.iteritems():
            variables = json.dumps(v.variables)
            defaults = dict(variables=variables, name=k, description='imported')
            enabled = None
            if self.enabled_var and self.enabled_var in v.variables:
                value = v.variables[self.enabled_var]
                if self.enabled_value is not None:
                    enabled = bool(unicode(self.enabled_value) == unicode(value))
                else:
                    enabled = bool(value)
                defaults['enabled'] = enabled
            instance_id = ''
            if self.instance_id_var:
                instance_id = v.variables.get(self.instance_id_var, '')
                defaults['instance_id'] = instance_id
            if instance_id in db_instance_id_map:
                attrs = {'pk': db_instance_id_map[instance_id]}
            elif instance_id:
                attrs = {'instance_id': instance_id}
                defaults.pop('instance_id')
            else:
                attrs = {'name': k}
                defaults.pop('name')
            attrs['defaults'] = defaults
            host, created = self.inventory.hosts.get_or_create(**attrs)
            if created:
                if enabled is False:
                    self.logger.info('Host "%s" added (disabled)', k)
                else:
                    self.logger.info('Host "%s" added', k)
                #self.logger.info('Host variables: %s', variables)
            else:
                db_variables = host.variables_dict
                if self.overwrite_vars or self.overwrite:
                    db_variables = v.variables
                else:
                    db_variables.update(v.variables)
                update_fields = []
                if db_variables != host.variables_dict:
                    host.variables = json.dumps(db_variables)
                    update_fields.append('variables')
                if enabled is not None and host.enabled != enabled:
                    host.enabled = enabled
                    update_fields.append('enabled')
                if k != host.name:
                    old_name = host.name
                    host.name = k
                    update_fields.append('name')
                if instance_id != host.instance_id:
                    old_instance_id = host.instance_id
                    host.instance_id = instance_id
                    update_fields.append('instance_id')
                if update_fields:
                    host.save(update_fields=update_fields)
                if 'name' in update_fields:
                    self.logger.info('Host renamed from "%s" to "%s"', old_name, k)
                if 'instance_id' in update_fields:
                    if old_instance_id:
                        self.logger.info('Host "%s" instance_id updated', k)
                    else:
                        self.logger.info('Host "%s" instance_id added', k)
                if 'variables' in update_fields:
                    if self.overwrite_vars or self.overwrite:
                        self.logger.info('Host "%s" variables replaced', k)
                    else:
                        self.logger.info('Host "%s" variables updated', k)
                else:
                    self.logger.info('Host "%s" variables unmodified', k)
                if 'enabled' in update_fields:
                    if enabled:
                        self.logger.info('Host "%s" is now enabled', k)
                    else:
                        self.logger.info('Host "%s" is now disabled', k)
            if self.inventory_source.group:
                self.inventory_source.group.hosts.add(host)
            host.inventory_sources.add(self.inventory_source)
            host.update_computed_fields(False, False)

        # For each host in a mem group, add it to the parent(s) to which it
        # belongs.
        for k,v in self.all_group.all_groups.iteritems():
            if not v.hosts:
                continue
            db_group = self.inventory.groups.get(name=k)
            for h in v.hosts:
                if h.instance_id:
                    db_host = self.inventory.hosts.get(instance_id=h.instance_id)
                else:
                    db_host = self.inventory.hosts.get(name=h.name)
                if db_host not in db_group.hosts.all():
                    db_group.hosts.add(db_host)
                    self.logger.info('Host "%s" added to group "%s"', h.name, k)
                else:
                    self.logger.info('Host "%s" already in group "%s"', h.name, k)
  
        # for each group, draw in child group arrangements
        for k,v in self.all_group.all_groups.iteritems():
            if not v.children:
                continue
            db_group = self.inventory.groups.get(name=k)
            for g in v.children:
                db_child = self.inventory.groups.get(name=g.name)
                if db_child not in db_group.hosts.all():
                    db_group.children.add(db_child)
                    self.logger.info('Group "%s" added as child of "%s"', g.name, k)
                else:
                    self.logger.info('Group "%s" already child of group "%s"', g.name, k)

    def check_license(self):
        reader = LicenseReader()
        license_info = reader.from_file()
        available_instances = license_info.get('available_instances', 0)
        free_instances = license_info.get('free_instances', 0)
        time_remaining = license_info.get('time_remaining', 0)
        new_count = Host.objects.filter(active=True).count()
        if time_remaining <= 0 and not license_info.get('demo', False):
            self.logger.error('License has expired')
            raise CommandError("License has expired!")
        if free_instances < 0:
            d = {
                'new_count': new_count,
                'available_instances': available_instances,
            }
            if license_info.get('demo', False):
                self.logger.error(DEMO_LICENSE_MESSAGE % d)
            else:
                self.logger.error(LICENSE_MESSAGE % d)
            raise CommandError('License count exceeded!')

    @transaction.commit_on_success
    def handle_noargs(self, **options):
        self.verbosity = int(options.get('verbosity', 1))
        self.init_logging()
        self.inventory_name = options.get('inventory_name', None)
        self.inventory_id = options.get('inventory_id', None)
        self.overwrite = bool(options.get('overwrite', False))
        self.overwrite_vars = bool(options.get('overwrite_vars', False))
        self.keep_vars = bool(options.get('keep_vars', False))
        self.source = options.get('source', None)
        self.enabled_var = options.get('enabled_var', None)
        self.enabled_value = options.get('enabled_value', None)
        self.group_filter = options.get('group_filter', None) or r'^.+$'
        self.host_filter = options.get('host_filter', None) or r'^.+$'
        self.exclude_empty_groups = bool(options.get('exclude_empty_groups', False))
        self.instance_id_var = options.get('instance_id_var', None)

        # Load inventory and related objects from database.
        if self.inventory_name and self.inventory_id:
            raise CommandError('--inventory-name and --inventory-id are mutually exclusive')
        elif not self.inventory_name and not self.inventory_id:
            raise CommandError('--inventory-name or --inventory-id is required')
        if (self.overwrite or self.overwrite_vars) and self.keep_vars:
            raise CommandError('--overwrite/--overwrite-vars and --keep-vars are mutually exclusive')
        if not self.source:
            raise CommandError('--source is required')
        try:
            self.group_filter_re = re.compile(self.group_filter)
        except re.error:
            raise CommandError('invalid regular expression for --group-filter')
        try:
            self.host_filter_re = re.compile(self.host_filter)
        except re.error:
            raise CommandError('invalid regular expression for --host-filter')

        self.check_license()
        begin = time.time()
        self.load_inventory_from_database()

        status, tb, exc = 'error', '', None
        try:
            # Update inventory update for this command line invocation.
            with ignore_inventory_computed_fields():
                if self.inventory_update:
                    self.inventory_update.status = 'running'
                    self.inventory_update.save()
                    transaction.commit()

            # Load inventory from source.
            self.all_group = load_inventory_source(self.source, None,
                                                   self.group_filter_re,
                                                   self.host_filter_re,
                                                   self.exclude_empty_groups)
            self.all_group.debug_tree()

            # Merge/overwrite inventory into database.
            with ignore_inventory_computed_fields():
                if getattr(settings, 'ACTIVITY_STREAM_ENABLED_FOR_INVENTORY_SYNC', True):
                    self.load_into_database()
                else:
                    with disable_activity_stream():
                        self.load_into_database()
                self.inventory.update_computed_fields()
            self.check_license()
 
            if self.inventory_source.group:
                inv_name = 'group "%s"' % (self.inventory_source.group.name)
            else:
                inv_name = '"%s" (id=%s)' % (self.inventory.name,
                                             self.inventory.id)
            self.logger.info('Inventory import completed for %s in %0.1fs',
                             inv_name, time.time() - begin)
            status = 'successful'
            if settings.DEBUG:
                sqltime = sum(float(x['time']) for x in connection.queries)
                self.logger.info('Inventory import required %d queries '
                                 'taking %0.3fs', len(connection.queries),
                                 sqltime)
        except Exception, e:
            if isinstance(e, KeyboardInterrupt):
                status = 'canceled'
                exc = e
            elif isinstance(e, CommandError):
                exc = e
            else:
                tb = traceback.format_exc()
                exc = e
            if self.inventory_update:
                transaction.rollback()

        if self.inventory_update:
            with ignore_inventory_computed_fields():
                self.inventory_update = InventoryUpdate.objects.get(pk=self.inventory_update.pk)
                self.inventory_update.result_traceback = tb
                self.inventory_update.status = status
                self.inventory_update.save(update_fields=['status', 'result_traceback'])
                transaction.commit()
            
        if exc and isinstance(exc, CommandError):
            sys.exit(1)
        elif exc:
            raise exc
