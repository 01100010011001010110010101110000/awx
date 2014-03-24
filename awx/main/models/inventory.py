# Copyright (c) 2014 AnsibleWorks, Inc.
# All Rights Reserved.

# Python
import datetime
import hashlib
import hmac
import json
import logging
import os
import re
import shlex
import uuid

# PyYAML
import yaml

# ZMQ
import zmq

# Django
from django.conf import settings
from django.db import models
from django.db.models import CASCADE, SET_NULL, PROTECT
from django.utils.translation import ugettext_lazy as _
from django.core.exceptions import ValidationError, NON_FIELD_ERRORS
from django.core.urlresolvers import reverse
from django.contrib.auth.models import User
from django.utils.timezone import now, make_aware, get_default_timezone

# AWX
from awx.main.fields import AutoOneToOneField
from awx.main.models.base import *
from awx.main.models.unified_jobs import *
from awx.main.utils import encrypt_field

__all__ = ['Inventory', 'Host', 'Group', 'InventorySource', 'InventoryUpdate']


class Inventory(CommonModel):
    '''
    an inventory source contains lists and hosts.
    '''

    class Meta:
        app_label = 'main'
        verbose_name_plural = _('inventories')
        unique_together = [('name', 'organization')]

    organization = models.ForeignKey(
        'Organization',
        related_name='inventories',
        help_text=_('Organization containing this inventory.'),
    )
    variables = models.TextField(
        blank=True,
        default='',
        help_text=_('Inventory variables in JSON or YAML format.'),
    )
    has_active_failures = models.BooleanField(
        default=False,
        editable=False,
        help_text=_('Flag indicating whether any hosts in this inventory have failed.'),
    )
    total_hosts = models.PositiveIntegerField(
        default=0,
        editable=False,
        help_text=_('Total mumber of hosts in this inventory.'),
    )
    hosts_with_active_failures = models.PositiveIntegerField(
        default=0,
        editable=False,
        help_text=_('Number of hosts in this inventory with active failures.'),
    )
    total_groups = models.PositiveIntegerField(
        default=0,
        editable=False,
        help_text=_('Total number of groups in this inventory.'),
    )
    groups_with_active_failures = models.PositiveIntegerField(
        default=0,
        editable=False,
        help_text=_('Number of groups in this inventory with active failures.'),
    )
    has_inventory_sources = models.BooleanField(
        default=False,
        editable=False,
        help_text=_('Flag indicating whether this inventory has any external inventory sources.'),
    )
    total_inventory_sources = models.PositiveIntegerField(
        default=0,
        editable=False,
        help_text=_('Total number of external inventory sources configured within this inventory.'),
    )
    inventory_sources_with_failures = models.PositiveIntegerField(
        default=0,
        editable=False,
        help_text=_('Number of external inventory sources in this inventory with failures.'),
    )

    def get_absolute_url(self):
        return reverse('api:inventory_detail', args=(self.pk,))

    def mark_inactive(self, save=True):
        '''
        When marking inventory inactive, also mark hosts and groups inactive.
        '''
        from awx.main.signals import ignore_inventory_computed_fields
        with ignore_inventory_computed_fields():
            for host in self.hosts.filter(active=True):
                host.mark_inactive()
            for group in self.groups.filter(active=True):
                group.mark_inactive(recompute=False)
            for inventory_source in self.inventory_sources.filter(active=True):
                inventory_source.mark_inactive()
        super(Inventory, self).mark_inactive(save=save)

    variables_dict = VarsDictProperty('variables')

    def update_computed_fields(self, update_groups=True, update_hosts=True):
        '''
        Update model fields that are computed from database relationships.
        '''
        if update_hosts:
            for host in self.hosts.filter(active=True):
                host.update_computed_fields(update_inventory=False,
                                            update_groups=False)
        if update_groups:
            for group in self.groups.filter(active=True):
                group.update_computed_fields()
        active_hosts = self.hosts.filter(active=True)
        failed_hosts = active_hosts.filter(has_active_failures=True)
        active_groups = self.groups.filter(active=True)
        failed_groups = active_groups.filter(has_active_failures=True)
        active_inventory_sources = self.inventory_sources.filter(active=True, source__in=CLOUD_INVENTORY_SOURCES)
        #failed_inventory_sources = active_inventory_sources.filter(last_update_failed=True)
        failed_inventory_sources = active_inventory_sources.filter(last_job_failed=True)
        computed_fields = {
            'has_active_failures': bool(failed_hosts.count()),
            'total_hosts': active_hosts.count(),
            'hosts_with_active_failures': failed_hosts.count(),
            'total_groups': active_groups.count(),
            'groups_with_active_failures': failed_groups.count(),
            'has_inventory_sources': bool(active_inventory_sources.count()),
            'total_inventory_sources': active_inventory_sources.count(),
            'inventory_sources_with_failures': failed_inventory_sources.count(),
        }
        for field, value in computed_fields.items():
            if getattr(self, field) != value:
                setattr(self, field, value)
            else:
                computed_fields.pop(field)
        if computed_fields:
            self.save(update_fields=computed_fields.keys())

    @property
    def root_groups(self):
        group_pks = self.groups.values_list('pk', flat=True)
        return self.groups.exclude(parents__pk__in=group_pks).distinct()


class HostBase(CommonModelNameNotUnique):
    '''
    A managed node
    '''

    class Meta:
        abstract = True
        app_label = 'main'
        unique_together = (("name", "inventory"),) # FIXME: Add ('instance_id', 'inventory') after migration.

    inventory = models.ForeignKey(
        'Inventory',
        related_name='hosts',
    )
    enabled = models.BooleanField(
        default=True,
        help_text=_('Is this host online and available for running jobs?'),
    )
    instance_id = models.CharField(
        max_length=100,
        blank=True,
        default='',
    )
    variables = models.TextField(
        blank=True,
        default='',
        help_text=_('Host variables in JSON or YAML format.'),
    )
    #last_job = models.ForeignKey(
    #    'Job',
    #    related_name='hosts_as_last_job+',
    #    blank=True,
    #    null=True,
    #    default=None,
    #    editable=False,
    #    on_delete=models.SET_NULL,
    #)
    last_job_host_summary = models.ForeignKey(
        'JobHostSummary',
        related_name='hosts_as_last_job_summary+',
        blank=True,
        null=True,
        default=None,
        editable=False,
        on_delete=models.SET_NULL,
    )
    has_active_failures  = models.BooleanField(
        default=False,
        editable=False,
        help_text=_('Flag indicating whether the last job failed for this host.'),
    )
    has_inventory_sources = models.BooleanField(
        default=False,
        editable=False,
        help_text=_('Flag indicating whether this host was created/updated from any external inventory sources.'),
    )
    #inventory_sources = models.ManyToManyField(
    #    'InventorySource',
    #    related_name='hosts',
    #    blank=True,
    #    editable=False,
    #    help_text=_('Inventory source(s) that created or modified this host.'),
    #)

    def __unicode__(self):
        return self.name

    def get_absolute_url(self):
        return reverse('api:host_detail', args=(self.pk,))

    def mark_inactive(self, save=True):
        '''
        When marking hosts inactive, remove all associations to related
        inventory sources.
        '''
        super(HostBase, self).mark_inactive(save=save)
        self.inventory_sources.clear()

    def update_computed_fields(self, update_inventory=True, update_groups=True):
        '''
        Update model fields that are computed from database relationships.
        '''
        has_active_failures = bool(self.last_job_host_summary and
                                   self.last_job_host_summary.job.active and
                                   self.last_job_host_summary.failed)
        active_inventory_sources = self.inventory_sources.filter(active=True,
                                                                 source__in=CLOUD_INVENTORY_SOURCES)
        computed_fields = {
            'has_active_failures': has_active_failures,
            'has_inventory_sources': bool(active_inventory_sources.count()),
        }
        for field, value in computed_fields.items():
            if getattr(self, field) != value:
                setattr(self, field, value)
            else:
                computed_fields.pop(field)
        if computed_fields:
            self.save(update_fields=computed_fields.keys())
        # Groups and inventory may also need to be updated when host fields
        # change.
        if update_groups:
            for group in self.all_groups.filter(active=True):
                group.update_computed_fields()
        if update_inventory:
            self.inventory.update_computed_fields(update_groups=False,
                                                  update_hosts=False)

    variables_dict = VarsDictProperty('variables')

    @property
    def all_groups(self):
        '''
        Return all groups of which this host is a member, avoiding infinite
        recursion in the case of cyclical group relations.
        '''
        qs = self.groups.distinct()
        for group in self.groups.all():
            qs = qs | group.all_parents
        return qs

    # Use .job_host_summaries.all() to get jobs affecting this host.
    # Use .job_events.all() to get events affecting this host.


if getattr(settings, 'UNIFIED_JOBS_STEP') == 0:

    class Host(HostBase):

        class Meta:
            app_label = 'main'
            unique_together = (("name", "inventory"),)

        last_job = models.ForeignKey(
            'Job',
            related_name='hosts_as_last_job+',
            blank=True,
            null=True,
            default=None,
            editable=False,
            on_delete=models.SET_NULL,
        )
        new_last_job = models.ForeignKey(
            'JobNew',
            related_name='hosts_as_last_job+',
            blank=True,
            null=True,
            default=None,
            editable=False,
            on_delete=models.SET_NULL,
        )
        inventory_sources = models.ManyToManyField(
            'InventorySource',
            related_name='hosts',
            blank=True,
            editable=False,
            help_text=_('Inventory source(s) that created or modified this host.'),
        )
        new_inventory_sources = models.ManyToManyField(
            'InventorySourceNew',
            related_name='hosts',
            blank=True,
            editable=False,
            help_text=_('Inventory source(s) that created or modified this host.'),
        )

if getattr(settings, 'UNIFIED_JOBS_STEP') == 1:

    class Host(HostBase):

        class Meta:
            app_label = 'main'
            unique_together = (("name", "inventory"),)

        new_last_job = models.ForeignKey(
            'JobNew',
            related_name='hosts_as_last_job+',
            blank=True,
            null=True,
            default=None,
            editable=False,
            on_delete=models.SET_NULL,
        )
        new_inventory_sources = models.ManyToManyField(
            'InventorySourceNew',
            related_name='hosts',
            blank=True,
            editable=False,
            help_text=_('Inventory source(s) that created or modified this host.'),
        )

if getattr(settings, 'UNIFIED_JOBS_STEP') == 2:

    class Host(HostBase):

        class Meta:
            app_label = 'main'
            unique_together = (("name", "inventory"),)

        last_job = models.ForeignKey(
            'Job',
            related_name='hosts_as_last_job+',
            blank=True,
            null=True,
            default=None,
            editable=False,
            on_delete=models.SET_NULL,
        )
        inventory_sources = models.ManyToManyField(
            'InventorySource',
            related_name='hosts',
            blank=True,
            editable=False,
            help_text=_('Inventory source(s) that created or modified this host.'),
        )


class GroupBase(CommonModelNameNotUnique):
    '''
    A group containing managed hosts.  A group or host may belong to multiple
    groups.
    '''

    class Meta:
        abstract = True
        app_label = 'main'
        unique_together = (("name", "inventory"),)

    inventory = models.ForeignKey(
        'Inventory',
        related_name='groups',
    )
    # Can also be thought of as: parents == member_of, children == members
    parents = models.ManyToManyField(
        'self',
        symmetrical=False,
        related_name='children',
        blank=True,
    )
    variables = models.TextField(
        blank=True,
        default='',
        help_text=_('Group variables in JSON or YAML format.'),
    )
    hosts = models.ManyToManyField(
        'Host',
        related_name='groups',
        blank=True,
        help_text=_('Hosts associated directly with this group.'),
    )
    total_hosts = models.PositiveIntegerField(
        default=0,
        editable=False,
        help_text=_('Total number of hosts directly or indirectly in this group.'),
    )
    has_active_failures = models.BooleanField(
        default=False,
        editable=False,
        help_text=_('Flag indicating whether this group has any hosts with active failures.'),
    )
    hosts_with_active_failures = models.PositiveIntegerField(
        default=0,
        editable=False,
        help_text=_('Number of hosts in this group with active failures.'),
    )
    total_groups = models.PositiveIntegerField(
        default=0,
        editable=False,
        help_text=_('Total number of child groups contained within this group.'),
    )
    groups_with_active_failures = models.PositiveIntegerField(
        default=0,
        editable=False,
        help_text=_('Number of child groups within this group that have active failures.'),
    )
    has_inventory_sources = models.BooleanField(
        default=False,
        editable=False,
        help_text=_('Flag indicating whether this group was created/updated from any external inventory sources.'),
    )
    #inventory_sources = models.ManyToManyField(
    #    'InventorySource',
    #    related_name='groups',
    #    blank=True,
    #    editable=False,
    #    help_text=_('Inventory source(s) that created or modified this group.'),
    #)

    def __unicode__(self):
        return self.name

    def get_absolute_url(self):
        return reverse('api:group_detail', args=(self.pk,))

    def mark_inactive(self, save=True, recompute=True):
        '''
        When marking groups inactive, remove all associations to related
        groups/hosts/inventory_sources.
        '''
        def mark_actual():
            super(GroupBase, self).mark_inactive(save=save)
            self.inventory_source.mark_inactive(save=save)
            self.inventory_sources.clear()
            self.parents.clear()
            self.children.clear()
            self.hosts.clear()
        from awx.main.signals import ignore_inventory_computed_fields
        i = self.inventory

        if recompute:
            with ignore_inventory_computed_fields():
                mark_actual()
            i.update_computed_fields()
        else:
            mark_actual()

    def update_computed_fields(self):
        '''
        Update model fields that are computed from database relationships.
        '''
        active_hosts = self.all_hosts.filter(active=True)
        failed_hosts = active_hosts.filter(last_job_host_summary__job__active=True,
                                           last_job_host_summary__failed=True)
        active_groups = self.all_children.filter(active=True)
        # FIXME: May not be accurate unless we always update groups depth-first.
        failed_groups = active_groups.filter(has_active_failures=True)
        active_inventory_sources = self.inventory_sources.filter(active=True,
                                                                 source__in=CLOUD_INVENTORY_SOURCES)
        computed_fields = {
            'total_hosts': active_hosts.count(),
            'has_active_failures': bool(failed_hosts.count()),
            'hosts_with_active_failures': failed_hosts.count(),
            'total_groups': active_groups.count(),
            'groups_with_active_failures': failed_groups.count(),
            'has_inventory_sources': bool(active_inventory_sources.count()),
        }
        for field, value in computed_fields.items():
            if getattr(self, field) != value:
                setattr(self, field, value)
            else:
                computed_fields.pop(field)
        if computed_fields:
            self.save(update_fields=computed_fields.keys())

    variables_dict = VarsDictProperty('variables')

    def get_all_parents(self, except_pks=None):
        '''
        Return all parents of this group recursively, avoiding infinite
        recursion in the case of cyclical relations.  The group itself will be
        excluded unless there is a cycle leading back to it.
        '''
        except_pks = except_pks or set()
        except_pks.add(self.pk)
        qs = self.parents.distinct()
        for group in self.parents.exclude(pk__in=except_pks):
            qs = qs | group.get_all_parents(except_pks)
        return qs

    @property
    def all_parents(self):
        return self.get_all_parents()

    def get_all_children(self, except_pks=None):
        '''
        Return all children of this group recursively, avoiding infinite
        recursion in the case of cyclical relations.  The group itself will be
        excluded unless there is a cycle leading back to it.
        '''
        except_pks = except_pks or set()
        except_pks.add(self.pk)
        qs = self.children.distinct()
        for group in self.children.exclude(pk__in=except_pks):
            qs = qs | group.get_all_children(except_pks)
        return qs

    @property
    def all_children(self):
        return self.get_all_children()

    def get_all_hosts(self, except_group_pks=None):
        '''
        Return all hosts associated with this group or any of its children,
        avoiding infinite recursion in the case of cyclical group relations.
        '''
        except_group_pks = except_group_pks or set()
        except_group_pks.add(self.pk)
        qs = self.hosts.distinct()
        for group in self.children.exclude(pk__in=except_group_pks):
            qs = qs | group.get_all_hosts(except_group_pks)
        return qs

    @property
    def all_hosts(self):
        return self.get_all_hosts()

    @property
    def job_host_summaries(self):
        from awx.main.models.jobs import JobHostSummary
        return JobHostSummary.objects.filter(host__in=self.all_hosts)

    @property
    def job_events(self):
        from awx.main.models.jobs import JobEvent
        return JobEvent.objects.filter(host__in=self.all_hosts)


if getattr(settings, 'UNIFIED_JOBS_STEP') == 0:
    
    class Group(GroupBase):

        class Meta:
            app_label = 'main'
            unique_together = (("name", "inventory"),)
            
        inventory_sources = models.ManyToManyField(
            'InventorySource',
            related_name='groups',
            blank=True,
            editable=False,
            help_text=_('Inventory source(s) that created or modified this group.'),
        )

        new_inventory_sources = models.ManyToManyField(
            'InventorySourceNew',
            related_name='groups',
            blank=True,
            editable=False,
            help_text=_('Inventory source(s) that created or modified this group.'),
        )
        
if getattr(settings, 'UNIFIED_JOBS_STEP') == 1:

    class Group(GroupBase):

        class Meta:
            app_label = 'main'
            unique_together = (("name", "inventory"),)
            
        new_inventory_sources = models.ManyToManyField(
            'InventorySourceNew',
            related_name='groups',
            blank=True,
            editable=False,
            help_text=_('Inventory source(s) that created or modified this group.'),
        )

if getattr(settings, 'UNIFIED_JOBS_STEP') == 2:

    class Group(GroupBase):
        
        class Meta:
            app_label = 'main'
            unique_together = (("name", "inventory"),)

        inventory_sources = models.ManyToManyField(
            'InventorySource',
            related_name='groups',
            blank=True,
            editable=False,
            help_text=_('Inventory source(s) that created or modified this group.'),
        )


class InventorySourceOptions(BaseModel):
    '''
    Common fields for InventorySource and InventoryUpdate.
    '''

    SOURCE_CHOICES = [
        ('file', _('Local File, Directory or Script')),
        ('rax', _('Rackspace Cloud Servers')),
        ('ec2', _('Amazon EC2')),
    ]

    class Meta:
        abstract = True

    source = models.CharField(
        max_length=32,
        choices=SOURCE_CHOICES,
        blank=True,
        default='',
    )
    source_path = models.CharField(
        max_length=1024,
        blank=True,
        default='',
        editable=False,
    )
    source_vars = models.TextField(
        blank=True,
        default='',
        help_text=_('Inventory source variables in YAML or JSON format.'),
    )
    credential = models.ForeignKey(
        'Credential',
        related_name='%(class)ss',
        null=True,
        default=None,
        blank=True,
        #on_delete=models.SET_NULL, # FIXME
    )
    source_regions = models.CharField(
        max_length=1024,
        blank=True,
        default='',
    )
    overwrite = models.BooleanField(
        default=False,
        help_text=_('Overwrite local groups and hosts from remote inventory source.'),
    )
    overwrite_vars = models.BooleanField(
        default=False,
        help_text=_('Overwrite local variables from remote inventory source.'),
    )

    @classmethod
    def get_ec2_region_choices(cls):
        ec2_region_names = getattr(settings, 'EC2_REGION_NAMES', {})
        ec2_name_replacements = {
            'us': 'US',
            'ap': 'Asia Pacific',
            'eu': 'Europe',
            'sa': 'South America',
        }
        import boto.ec2
        regions = [('all', 'All')]
        for region in boto.ec2.regions():
            label = ec2_region_names.get(region.name, '')
            if not label:
                label_parts = []
                for part in region.name.split('-'):
                    part = ec2_name_replacements.get(part.lower(), part.title())
                    label_parts.append(part)
                label = ' '.join(label_parts)
            regions.append((region.name, label))
        return regions

    @classmethod
    def get_rax_region_choices(cls):
        # Not possible to get rax regions without first authenticating, so use
        # list from settings.
        regions = list(getattr(settings, 'RAX_REGION_CHOICES', []))
        regions.insert(0, ('ALL', 'All'))
        return regions

    def clean_credential(self):
        if not self.source:
            return None
        cred = self.credential
        if cred:
            if self.source == 'ec2' and cred.kind != 'aws':
                raise ValidationError('Credential kind must be "aws" for an '
                                      '"ec2" source')
            if self.source == 'rax' and cred.kind != 'rax':
                raise ValidationError('Credential kind must be "rax" for a '
                                    '"rax" source')
        elif self.source in ('ec2', 'rax'):
            raise ValidationError('Credential is required for a cloud source')
        return cred

    def clean_source_regions(self):
        regions = self.source_regions
        if self.source == 'ec2':
            valid_regions = [x[0] for x in self.get_ec2_region_choices()]
            region_transform = lambda x: x.strip().lower()
        elif self.source == 'rax':
            valid_regions = [x[0] for x in self.get_rax_region_choices()]
            region_transform = lambda x: x.strip().upper()
        else:
            return ''
        all_region = region_transform('all')
        valid_regions = [region_transform(x) for x in valid_regions]
        regions = [region_transform(x) for x in regions.split(',') if x.strip()]
        if all_region in regions:
            return all_region
        invalid_regions = []
        for r in regions:
            if r not in valid_regions and r not in invalid_regions:
                invalid_regions.append(r)
        if invalid_regions:
            raise ValidationError('Invalid %s region%s: %s' % (self.source,
                                  '' if len(invalid_regions) == 1 else 's',
                                  ', '.join(invalid_regions)))
        return ','.join(regions)


class InventorySourceBase(InventorySourceOptions):

    class Meta:
        abstract = True
        app_label = 'main'

    update_on_launch = models.BooleanField(
        default=False,
    )
    update_cache_timeout = models.PositiveIntegerField(
        default=0,
    )


class InventorySourceBaseMethods(object):

    def save(self, *args, **kwargs):
        # If update_fields has been specified, add our field names to it,
        # if it hasn't been specified, then we're just doing a normal save.
        update_fields = kwargs.get('update_fields', [])
        # Update inventory from group (if available).
        if self.group and not self.inventory:
            self.inventory = self.group.inventory
            if 'inventory' not in update_fields:
                update_fields.append('inventory')
        # Set name automatically.
        if not self.name:
            self.name = 'inventory_source %s' % now()
            if 'name' not in update_fields:
                update_fields.append('name')
        # Do the actual save.
        super(InventorySourceBaseMethods, self).save(*args, **kwargs)

    source_vars_dict = VarsDictProperty('source_vars')

    def get_absolute_url(self):
        return reverse('api:inventory_source_detail', args=(self.pk,))

    def _can_update(self):
        # FIXME: Prevent update when another one is active!
        return bool(self.source)

    def update_signature(self, **kwargs):
        if self.can_update:
            inventory_update = self.inventory_updates.create() # FIXME: Copy inventory source fields to update
            inventory_update_sig = inventory_update.start_signature()
            return (inventory_update, inventory_update_sig)

    def update(self, **kwargs):
        if self.can_update:
            inventory_update = self.inventory_updates.create() # FIXME: Copy inventory source fields to update
            if hasattr(settings, 'CELERY_UNIT_TEST'):
                inventory_update.start(None, **kwargs)
            else:
                inventory_update.signal_start(**kwargs)
            return inventory_update


if getattr(settings, 'UNIFIED_JOBS_STEP') == 0:

    class InventorySource(InventorySourceBaseMethods, PrimordialModel, InventorySourceBase):

        INVENTORY_SOURCE_STATUS_CHOICES = [
            ('none', _('No External Source')),
            ('never updated', _('Never Updated')),
            ('updating', _('Updating')),
            ('failed', _('Failed')),
            ('successful', _('Successful')),
        ]

        class Meta:
            app_label = 'main'

        inventory = models.ForeignKey(
            'Inventory',
            related_name='inventory_sources',
            null=True,
            default=None,
            editable=False,
        )
        group = AutoOneToOneField(
            'Group',
            related_name='inventory_source',
            blank=True,
            null=True,
            default=None,
            editable=False,
        )
        current_update = models.ForeignKey(
            'InventoryUpdate',
            null=True,
            default=None,
            editable=False,
            related_name='inventory_source_as_current_update+',
        )
        last_update = models.ForeignKey(
            'InventoryUpdate',
            null=True,
            default=None,
            editable=False,
            related_name='inventory_source_as_last_update+',
        )
        last_update_failed = models.BooleanField(
            default=False,
            editable=False,
        )
        last_updated = models.DateTimeField(
            null=True,
            default=None,
            editable=False,
        )
        status = models.CharField(
            max_length=32,
            choices=INVENTORY_SOURCE_STATUS_CHOICES,
            default='none',
            editable=False,
        )

if getattr(settings, 'UNIFIED_JOBS_STEP') in (0, 1):

    class InventorySourceNew(InventorySourceBaseMethods, UnifiedJobTemplate, InventorySourceBase):

        class Meta:
            app_label = 'main'

        inventory = models.ForeignKey(
            'Inventory',
            related_name='new_inventory_sources',
            null=True,
            default=None,
            editable=False,
        )
        group = AutoOneToOneField(
            'Group',
            related_name='new_inventory_source',
            blank=True,
            null=True,
            default=None,
            editable=False,
        )

if getattr(settings, 'UNIFIED_JOBS_STEP') == 1:

    class InventorySource(InventorySourceNew):

        class Meta:
            proxy = True

if getattr(settings, 'UNIFIED_JOBS_STEP') == 2:

    class InventorySource(InventorySourceBaseMethods, UnifiedJobTemplate, InventorySourceBase):

        class Meta:
            app_label = 'main'

        inventory = models.ForeignKey(
            'Inventory',
            related_name='inventory_sources',
            null=True,
            default=None,
            editable=False,
        )
        group = AutoOneToOneField(
            'Group',
            related_name='inventory_source',
            blank=True,
            null=True,
            default=None,
            editable=False,
        )


class InventoryUpdateBase(InventorySourceOptions):
    '''
    Internal job for tracking inventory updates from external sources.
    '''

    class Meta:
        app_label = 'main'
        abstract = True

    license_error = models.BooleanField(
        default=False,
        editable=False,
    )


class InventoryUpdateBaseMethods(object):

    def save(self, *args, **kwargs):
        update_fields = kwargs.get('update_fields', [])
        if bool('license' in self.result_stdout and
                'exceeded' in self.result_stdout and not self.license_error):
            self.license_error = True
            if 'license_error' not in update_fields:
                update_fields.append('license_error')
        super(InventoryUpdateBaseMethods, self).save(*args, **kwargs)

    def _get_parent_instance(self):
        return self.inventory_source

    def get_absolute_url(self):
        return reverse('api:inventory_update_detail', args=(self.pk,))

    def _get_task_class(self):
        from awx.main.tasks import RunInventoryUpdate
        return RunInventoryUpdate

    def is_blocked_by(self, obj):
        if type(obj) == InventoryUpdate:
            if self.inventory_source == obj.inventory_source:
                return True
        return False

    @property
    def task_impact(self):
        return 50

    def signal_start(self, **kwargs):
        from awx.main.tasks import notify_task_runner
        if not self.can_start:
            return False
        needed = self._get_passwords_needed_to_start()
        opts = dict([(field, kwargs.get(field, '')) for field in needed])
        if not all(opts.values()):
            return False

        json_args = json.dumps(kwargs)
        self.start_args = json_args
        self.save()
        self.start_args = encrypt_field(self, 'start_args')
        self.save()
        # notify_task_runner.delay(dict(task_type="inventory_update", id=self.id, metadata=kwargs))
        return True


if getattr(settings, 'UNIFIED_JOBS_STEP') == 0:

    class InventoryUpdate(InventoryUpdateBaseMethods, CommonTask, InventoryUpdateBase):

        class Meta:
            app_label = 'main'

        inventory_source = models.ForeignKey(
            'InventorySource',
            related_name='inventory_updates',
            on_delete=models.CASCADE,
            editable=False,
        )

if getattr(settings, 'UNIFIED_JOBS_STEP') in (0, 1):

    class InventoryUpdateNew(InventoryUpdateBaseMethods, UnifiedJob, InventoryUpdateBase):

        class Meta:
            app_label = 'main'

        inventory_source = models.ForeignKey(
            'InventorySourceNew',
            related_name='inventory_updates',
            on_delete=models.CASCADE,
            editable=False,
        )

if getattr(settings, 'UNIFIED_JOBS_STEP') == 1:

    class InventoryUpdate(InventoryUpdateNew):

        class Meta:
            proxy = True

if getattr(settings, 'UNIFIED_JOBS_STEP') == 2:

    class InventoryUpdate(InventoryUpdateBaseMethods, UnifiedJob, InventoryUpdateBase):

        class Meta:
            app_label = 'main'

        inventory_source = models.ForeignKey(
            'InventorySource',
            related_name='inventory_updates',
            on_delete=models.CASCADE,
            editable=False,
        )
