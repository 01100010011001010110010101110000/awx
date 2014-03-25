# Copyright (c) 2014 AnsibleWorks, Inc.
# All Rights Reserved.

# Python
import json
import shlex
import os
import os.path

# PyYAML
import yaml

# Django
from django.conf import settings
from django.db import models
from django.db import transaction
from django.core.exceptions import ValidationError
from django.contrib.contenttypes.models import ContentType
from django.utils.translation import ugettext_lazy as _
from django.utils.timezone import now

# Django-JSONField
from jsonfield import JSONField

# Django-Polymorphic
from polymorphic import PolymorphicModel

# Django-Taggit
from taggit.managers import TaggableManager

# Django-Celery
from djcelery.models import TaskMeta

__all__ = ['VarsDictProperty', 'BaseModel', 'CreatedModifiedModel', 'PrimordialModel', 'CommonModel',
           'CommonModelNameNotUnique', 'CommonTask', 'PERM_INVENTORY_ADMIN',
           'PERM_INVENTORY_READ', 'PERM_INVENTORY_WRITE',
           'PERM_INVENTORY_DEPLOY', 'PERM_INVENTORY_CHECK', 'JOB_TYPE_CHOICES',
           'PERMISSION_TYPE_CHOICES', 'TASK_STATUS_CHOICES',
           'CLOUD_INVENTORY_SOURCES']

PERM_INVENTORY_ADMIN  = 'admin'
PERM_INVENTORY_READ   = 'read'
PERM_INVENTORY_WRITE  = 'write'
PERM_INVENTORY_DEPLOY = 'run'
PERM_INVENTORY_CHECK  = 'check'

JOB_TYPE_CHOICES = [
    (PERM_INVENTORY_DEPLOY, _('Run')),
    (PERM_INVENTORY_CHECK, _('Check')),
]

PERMISSION_TYPE_CHOICES = [
    (PERM_INVENTORY_READ, _('Read Inventory')),
    (PERM_INVENTORY_WRITE, _('Edit Inventory')),
    (PERM_INVENTORY_ADMIN, _('Administrate Inventory')),
    (PERM_INVENTORY_DEPLOY, _('Deploy To Inventory')),
    (PERM_INVENTORY_CHECK, _('Deploy To Inventory (Dry Run)')),
]

TASK_STATUS_CHOICES = [
    ('new', _('New')),                  # Job has been created, but not started.
    ('pending', _('Pending')),          # Job has been queued, but is not yet running.
    ('waiting', _('Waiting')),          # Job is waiting on an update/dependency.
    ('running', _('Running')),          # Job is currently running.
    ('successful', _('Successful')),    # Job completed successfully.
    ('failed', _('Failed')),            # Job completed, but with failures.
    ('error', _('Error')),              # The job was unable to run.
    ('canceled', _('Canceled')),        # The job was canceled before completion.
]

CLOUD_INVENTORY_SOURCES = ['ec2', 'rax']


class VarsDictProperty(object):
    '''
    Retrieve a string of variables in YAML or JSON as a dictionary.
    '''

    def __init__(self, field='variables', key_value=False):
        self.field = field
        self.key_value = key_value

    def __get__(self, obj, type=None):
        if obj is None:
            return self
        v = getattr(obj, self.field).encode('utf-8')
        d = None
        try:
            d = json.loads(v.strip() or '{}')
        except ValueError:
            pass
        if d is None:
            try:
                d = yaml.safe_load(v)
            except yaml.YAMLError:
                pass
        if d is None and self.key_value:
            d = {}
            for kv in [x.decode('utf-8') for x in shlex.split(v, posix=True)]:
                if '=' in kv:
                    k, v = kv.split('=', 1)
                    d[k] = v
        return d if hasattr(d, 'items') else {}

    def __set__(self, obj, value):
        raise AttributeError('readonly property')


class BaseModel(models.Model):
    '''
    Base model class with common methods for all models.
    '''

    class Meta:
        abstract = True

    def __unicode__(self):
        if hasattr(self, 'name'):
            return u'%s-%s' % (self.name, self.id)
        else:
            return u'%s-%s' % (self._meta.verbose_name, self.id)

    def clean_fields(self, exclude=None):
        '''
        Override default clean_fields to support methods for cleaning
        individual model fields.
        '''
        exclude = exclude or []
        errors = {}
        try:
            super(BaseModel, self).clean_fields(exclude)
        except ValidationError, e:
            errors = e.update_error_dict(errors)
        for f in self._meta.fields:
            if f.name in exclude:
                continue
            if hasattr(self, 'clean_%s' % f.name):
                try:
                    setattr(self, f.name, getattr(self, 'clean_%s' % f.name)())
                except ValidationError, e:
                    errors[f.name] = e.messages
        if errors:
             raise ValidationError(errors)        

    def update_fields(self, **kwargs):
        save = kwargs.pop('save', True)
        update_fields = []
        for field, value in kwargs.items():
            if getattr(self, field) != value:
                setattr(self, field, value)
                update_fields.append(field)
        if save and update_fields:
            self.save(update_fields=update_fields)
        return update_fields

    def save(self, *args, **kwargs):
        # For compatibility with Django 1.4.x, attempt to handle any calls to
        # save that pass update_fields.
        try:
            super(BaseModel, self).save(*args, **kwargs)
        except TypeError:
            if 'update_fields' not in kwargs:
                raise
            kwargs.pop('update_fields')
            super(BaseModel, self).save(*args, **kwargs)


class CreatedModifiedModel(BaseModel):
    
    class Meta:
        abstract = True

    created = models.DateTimeField(
        #auto_now_add=True, # FIXME: Disabled temporarily for data migration.
        default=None,
        editable=False,
    )
    modified = models.DateTimeField(
        #auto_now=True, # FIXME: Disabled temporarily for data migration.
        #default=now,
        default=None,
        editable=False,
    )

    def save(self, *args, **kwargs):
        update_fields = kwargs.get('update_fields', [])
        # Manually perform auto_now_add and auto_now logic (for unified jobs migration).
        if not self.pk and not self.created:
            self.created = now()
            if 'created' not in update_fields:
                update_fields.append('created')
        if 'modified' not in update_fields or not self.modified:
            self.modified = now() # FIXME: Moved temporarily for unified jobs migration.
            update_fields.append('modified')
        super(CreatedModifiedModel, self).save(*args, **kwargs)


class PrimordialModel(CreatedModifiedModel):
    '''
    common model for all object types that have these standard fields
    must use a subclass CommonModel or CommonModelNameNotUnique though
    as this lacks a name field.
    '''

    class Meta:
        abstract = True

    description = models.TextField(
        blank=True,
        default='',
    )
    created_by = models.ForeignKey(
        'auth.User',
        related_name='%s(class)s_created+',
        default=None,
        null=True,
        editable=False,
        on_delete=models.SET_NULL,
    )
    modified_by = models.ForeignKey(
        'auth.User',
        related_name='%s(class)s_modified+',
        default=None,
        null=True,
        editable=False,
        on_delete=models.SET_NULL,
    )
    active = models.BooleanField(
        default=True,
        editable=False,
    )

    tags = TaggableManager(blank=True)

    def mark_inactive(self, save=True, update_fields=None):
        '''Use instead of delete to rename and mark inactive.'''
        update_fields = update_fields or []
        if self.active:
            dtnow = now()
            if 'name' in self._meta.get_all_field_names():
                self.name   = "_deleted_%s_%s" % (dtnow.isoformat(), self.name)
                if 'name' not in update_fields:
                    update_fields.append('name')
            self.active = False
            if 'active' not in update_fields:
                update_fields.append('active')
            if save:
                self.save(update_fields=update_fields)
        return update_fields

    def clean_description(self):
        # Description should always be empty string, never null.
        return self.description or ''


class CommonModel(PrimordialModel):
    ''' a base model where the name is unique '''

    class Meta:
        abstract = True

    name = models.CharField(
        max_length=512,
        unique=True,
    )


class CommonModelNameNotUnique(PrimordialModel):
    ''' a base model where the name is not unique '''

    class Meta:
        abstract = True

    name = models.CharField(
        max_length=512,
        unique=False,
    )


class CommonTask(PrimordialModel):

    class Meta:
        abstract = True
