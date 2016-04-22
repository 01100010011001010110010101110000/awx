# Copyright (c) 2015 Ansible, Inc.
# All Rights Reserved.

# Python
import contextlib
import logging
import threading
import json

# Django
from django.db.models.signals import post_save, pre_delete, post_delete, m2m_changed
from django.dispatch import receiver

# Django-CRUM
from crum import get_current_request
from crum.signals import current_user_getter

# AWX
from awx.main.models import * # noqa
from awx.api.serializers import * # noqa
from awx.main.utils import model_instance_diff, model_to_dict, camelcase_to_underscore, emit_websocket_notification
from awx.main.utils import ignore_inventory_computed_fields, ignore_inventory_group_removal, _inventory_updates
from awx.main.tasks import update_inventory_computed_fields
from awx.main.conf import tower_settings

__all__ = []

logger = logging.getLogger('awx.main.signals')

# Update has_active_failures for inventory/groups when a Host/Group is deleted,
# when a Host-Group or Group-Group relationship is updated, or when a Job is deleted

def emit_job_event_detail(sender, **kwargs):
    instance = kwargs['instance']
    created = kwargs['created']
    if created:
        event_serialized = JobEventSerializer(instance).data
        event_serialized['id'] = instance.id
        event_serialized["created"] = event_serialized["created"].isoformat()
        event_serialized["modified"] = event_serialized["modified"].isoformat()
        event_serialized["event_name"] = instance.event
        emit_websocket_notification('/socket.io/job_events', 'job_events-' + str(instance.job.id), event_serialized)

def emit_ad_hoc_command_event_detail(sender, **kwargs):
    instance = kwargs['instance']
    created = kwargs['created']
    if created:
        event_serialized = AdHocCommandEventSerializer(instance).data
        event_serialized['id'] = instance.id
        event_serialized["created"] = event_serialized["created"].isoformat()
        event_serialized["modified"] = event_serialized["modified"].isoformat()
        event_serialized["event_name"] = instance.event
        emit_websocket_notification('/socket.io/ad_hoc_command_events', 'ad_hoc_command_events-' + str(instance.ad_hoc_command_id), event_serialized)

def emit_update_inventory_computed_fields(sender, **kwargs):
    logger.debug("In update inventory computed fields")
    if getattr(_inventory_updates, 'is_updating', False):
        return
    instance = kwargs['instance']
    if sender == Group.hosts.through:
        sender_name = 'group.hosts'
    elif sender == Group.parents.through:
        sender_name = 'group.parents'
    elif sender == Host.inventory_sources.through:
        sender_name = 'host.inventory_sources'
    elif sender == Group.inventory_sources.through:
        sender_name = 'group.inventory_sources'
    else:
        sender_name = unicode(sender._meta.verbose_name)
    if kwargs['signal'] == post_save:
        if sender == Job:
            return
        sender_action = 'saved'
    elif kwargs['signal'] == post_delete:
        sender_action = 'deleted'
    elif kwargs['signal'] == m2m_changed and kwargs['action'] in ('post_add', 'post_remove', 'post_clear'):
        sender_action = 'changed'
    else:
        return
    logger.debug('%s %s, updating inventory computed fields: %r %r',
                 sender_name, sender_action, sender, kwargs)
    try:
        inventory = instance.inventory
    except Inventory.DoesNotExist:
        pass
    else:
        update_inventory_computed_fields.delay(inventory.id, True)

def emit_update_inventory_on_created_or_deleted(sender, **kwargs):
    if getattr(_inventory_updates, 'is_updating', False):
        return
    instance = kwargs['instance']
    if ('created' in kwargs and kwargs['created']) or \
       kwargs['signal'] == post_delete:
        pass
    else:
        return
    sender_name = unicode(sender._meta.verbose_name)
    logger.debug("%s created or deleted, updating inventory computed fields: %r %r",
                 sender_name, sender, kwargs)
    try:
        inventory = instance.inventory
    except Inventory.DoesNotExist:
        pass
    else:
        if inventory is not None:
            update_inventory_computed_fields.delay(inventory.id, True)

def rebuild_role_ancestor_list(reverse, model, instance, pk_set, action, **kwargs):
    'When a role parent is added or removed, update our role hierarchy list'
    if action == 'post_add':
        if reverse:
            model.rebuild_role_ancestor_list(list(pk_set), [])
        else:
            model.rebuild_role_ancestor_list([instance.id], [])

    if action in ['post_remove', 'post_clear']:
        if reverse:
            model.rebuild_role_ancestor_list([], list(pk_set))
        else:
            model.rebuild_role_ancestor_list([], [instance.id])

def sync_superuser_status_to_rbac(instance, **kwargs):
    'When the is_superuser flag is changed on a user, reflect that in the membership of the System Admnistrator role'
    if instance.is_superuser:
        Role.singleton(ROLE_SINGLETON_SYSTEM_ADMINISTRATOR).members.add(instance)
    else:
        Role.singleton(ROLE_SINGLETON_SYSTEM_ADMINISTRATOR).members.remove(instance)

def create_user_role(instance, **kwargs):
    try:
        Role.objects.get(
            content_type=ContentType.objects.get_for_model(instance),
            object_id=instance.id,
            role_field='admin_role'
        )
    except Role.DoesNotExist:
        role = Role.objects.create(
            role_field='admin_role',
            content_object = instance,
        )
        role.members.add(instance)

def org_admin_edit_members(instance, action, model, reverse, pk_set, **kwargs):
    content_type = ContentType.objects.get_for_model(Organization)

    if reverse:
        return
    else:
        if instance.content_type == content_type and \
           instance.content_object.member_role.id == instance.id:
            items = model.objects.filter(pk__in=pk_set).all()
            for user in items:
                if action == 'post_add':
                    instance.content_object.admin_role.children.add(user.admin_role)
                if action == 'pre_remove':
                    instance.content_object.admin_role.children.remove(user.admin_role)


post_save.connect(emit_update_inventory_on_created_or_deleted, sender=Host)
post_delete.connect(emit_update_inventory_on_created_or_deleted, sender=Host)
post_save.connect(emit_update_inventory_on_created_or_deleted, sender=Group)
post_delete.connect(emit_update_inventory_on_created_or_deleted, sender=Group)
m2m_changed.connect(emit_update_inventory_computed_fields, sender=Group.hosts.through)
m2m_changed.connect(emit_update_inventory_computed_fields, sender=Group.parents.through)
m2m_changed.connect(emit_update_inventory_computed_fields, sender=Host.inventory_sources.through)
m2m_changed.connect(emit_update_inventory_computed_fields, sender=Group.inventory_sources.through)
post_save.connect(emit_update_inventory_on_created_or_deleted, sender=InventorySource)
post_delete.connect(emit_update_inventory_on_created_or_deleted, sender=InventorySource)
post_save.connect(emit_update_inventory_on_created_or_deleted, sender=Job)
post_delete.connect(emit_update_inventory_on_created_or_deleted, sender=Job)
post_save.connect(emit_job_event_detail, sender=JobEvent)
post_save.connect(emit_ad_hoc_command_event_detail, sender=AdHocCommandEvent)
m2m_changed.connect(rebuild_role_ancestor_list, Role.parents.through)
m2m_changed.connect(org_admin_edit_members, Role.members.through)
post_save.connect(sync_superuser_status_to_rbac, sender=User)
post_save.connect(create_user_role, sender=User)


# Migrate hosts, groups to parent group(s) whenever a group is deleted

@receiver(pre_delete, sender=Group)
def save_related_pks_before_group_delete(sender, **kwargs):
    if getattr(_inventory_updates, 'is_removing', False):
        return
    instance = kwargs['instance']
    instance._saved_inventory_pk = instance.inventory.pk
    instance._saved_parents_pks = set(instance.parents.values_list('pk', flat=True))
    instance._saved_hosts_pks = set(instance.hosts.values_list('pk', flat=True))
    instance._saved_children_pks = set(instance.children.values_list('pk', flat=True))

@receiver(post_delete, sender=Group)
def migrate_children_from_deleted_group_to_parent_groups(sender, **kwargs):
    if getattr(_inventory_updates, 'is_removing', False):
        return
    instance = kwargs['instance']
    parents_pks = getattr(instance, '_saved_parents_pks', [])
    hosts_pks = getattr(instance, '_saved_hosts_pks', [])
    children_pks = getattr(instance, '_saved_children_pks', [])
    with ignore_inventory_group_removal():
        with ignore_inventory_computed_fields():
            if parents_pks:
                for parent_group in Group.objects.filter(pk__in=parents_pks):
                    for child_host in Host.objects.filter(pk__in=hosts_pks):
                        logger.debug('adding host %s to parent %s after group deletion',
                                     child_host, parent_group)
                        parent_group.hosts.add(child_host)
                    for child_group in Group.objects.filter(pk__in=children_pks):
                        logger.debug('adding group %s to parent %s after group deletion',
                                     child_group, parent_group)
                        parent_group.children.add(child_group)
                inventory_pk = getattr(instance, '_saved_inventory_pk', None)
                if inventory_pk:
                    try:
                        inventory = Inventory.objects.get(pk=inventory_pk)
                        inventory.update_computed_fields()
                    except Inventory.DoesNotExist:
                        pass


# Update host pointers to last_job and last_job_host_summary when a job is deleted

def _update_host_last_jhs(host):
    jhs_qs = JobHostSummary.objects.filter(host__pk=host.pk)
    try:
        jhs = jhs_qs.order_by('-job__pk')[0]
    except IndexError:
        jhs = None
    update_fields = []
    last_job = jhs.job if jhs else None
    if host.last_job != last_job:
        host.last_job = last_job
        update_fields.append('last_job')
    if host.last_job_host_summary != jhs:
        host.last_job_host_summary = jhs
        update_fields.append('last_job_host_summary')
    if update_fields:
        host.save(update_fields=update_fields)

@receiver(pre_delete, sender=Job)
def save_host_pks_before_job_delete(sender, **kwargs):
    instance = kwargs['instance']
    hosts_qs = Host.objects.filter( last_job__pk=instance.pk)
    instance._saved_hosts_pks = set(hosts_qs.values_list('pk', flat=True))

@receiver(post_delete, sender=Job)
def update_host_last_job_after_job_deleted(sender, **kwargs):
    instance = kwargs['instance']
    hosts_pks = getattr(instance, '_saved_hosts_pks', [])
    for host in Host.objects.filter(pk__in=hosts_pks):
        _update_host_last_jhs(host)

# Set via ActivityStreamRegistrar to record activity stream events

class ActivityStreamEnabled(threading.local):
    def __init__(self):
        self.enabled = getattr(tower_settings, 'ACTIVITY_STREAM_ENABLED', True)

    def __nonzero__(self):
        return bool(self.enabled)

activity_stream_enabled = ActivityStreamEnabled()

@contextlib.contextmanager
def disable_activity_stream():
    '''
    Context manager to disable capturing activity stream changes.
    '''
    try:
        previous_value = activity_stream_enabled.enabled
        activity_stream_enabled.enabled = False
        yield
    finally:
        activity_stream_enabled.enabled = previous_value


model_serializer_mapping = {
    Organization: OrganizationSerializer,
    Inventory: InventorySerializer,
    Host: HostSerializer,
    Group: GroupSerializer,
    InventorySource: InventorySourceSerializer,
    Credential: CredentialSerializer,
    Team: TeamSerializer,
    Project: ProjectSerializer,
    JobTemplate: JobTemplateSerializer,
    Job: JobSerializer,
    AdHocCommand: AdHocCommandSerializer,
    TowerSettings: TowerSettingsSerializer,
    Notifier: NotifierSerializer,
    Notification: NotificationSerializer,
}

def activity_stream_create(sender, instance, created, **kwargs):
    if created and activity_stream_enabled:
        # Skip recording any inventory source directly associated with a group.
        if isinstance(instance, InventorySource) and instance.group:
            return
        # TODO: Rethink details of the new instance
        object1 = camelcase_to_underscore(instance.__class__.__name__)
        activity_entry = ActivityStream(
            operation='create',
            object1=object1,
            changes=json.dumps(model_to_dict(instance, model_serializer_mapping)))
        activity_entry.save()
        #TODO: Weird situation where cascade SETNULL doesn't work
        #      it might actually be a good idea to remove all of these FK references since
        #      we don't really use them anyway.
        if type(instance) is not TowerSettings:
            getattr(activity_entry, object1).add(instance)

def activity_stream_update(sender, instance, **kwargs):
    if instance.id is None:
        return
    if not activity_stream_enabled:
        return
    try:
        old = sender.objects.get(id=instance.id)
    except sender.DoesNotExist:
        return

    new = instance
    changes = model_instance_diff(old, new, model_serializer_mapping)
    if changes is None:
        return
    object1 = camelcase_to_underscore(instance.__class__.__name__)
    activity_entry = ActivityStream(
        operation='update',
        object1=object1,
        changes=json.dumps(changes))
    activity_entry.save()
    if type(instance) is not TowerSettings:
        getattr(activity_entry, object1).add(instance)

def activity_stream_delete(sender, instance, **kwargs):
    if not activity_stream_enabled:
        return
    try:
        old = sender.objects.get(id=instance.id)
    except sender.DoesNotExist:
        return
    # Skip recording any inventory source directly associated with a group.
    if isinstance(instance, InventorySource) and instance.group:
        return
    changes = model_instance_diff(old, instance)
    object1 = camelcase_to_underscore(instance.__class__.__name__)
    activity_entry = ActivityStream(
        operation='delete',
        changes=json.dumps(changes),
        object1=object1)
    activity_entry.save()

def activity_stream_associate(sender, instance, **kwargs):
    if not activity_stream_enabled:
        return
    if 'pre_add' in kwargs['action'] or 'pre_remove' in kwargs['action']:
        if kwargs['action'] == 'pre_add':
            action = 'associate'
        elif kwargs['action'] == 'pre_remove':
            action = 'disassociate'
        else:
            return
        obj1 = instance
        object1=camelcase_to_underscore(obj1.__class__.__name__)
        obj_rel = sender.__module__ + "." + sender.__name__
        for entity_acted in kwargs['pk_set']:
            obj2 = kwargs['model']
            obj2_id = entity_acted
            obj2_actual = obj2.objects.get(id=obj2_id)
            object2 = camelcase_to_underscore(obj2.__name__)
            # Skip recording any inventory source, or system job template changes here.
            if isinstance(obj1, InventorySource) or isinstance(obj2_actual, InventorySource):
                continue
            if isinstance(obj1, SystemJobTemplate) or isinstance(obj2_actual, SystemJobTemplate):
                continue
            activity_entry = ActivityStream(
                operation=action,
                object1=object1,
                object2=object2,
                object_relationship_type=obj_rel)
            activity_entry.save()
            getattr(activity_entry, object1).add(obj1)
            getattr(activity_entry, object2).add(obj2_actual)


@receiver(current_user_getter)
def get_current_user_from_drf_request(sender, **kwargs):
    '''
    Provider a signal handler to return the current user from the current
    request when using Django REST Framework. Requires that the APIView set
    drf_request on the underlying Django Request object.
    '''
    request = get_current_request()
    drf_request = getattr(request, 'drf_request', None)
    return (getattr(drf_request, 'user', False), 0)
