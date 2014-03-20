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
import urlparse
import uuid

# PyYAML
import yaml

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
from awx.lib.compat import slugify
from awx.main.models.base import *
from awx.main.models.unified_jobs import *
from awx.main.utils import update_scm_url

__all__ = ['Project', 'ProjectUpdate']

class ProjectOptions(models.Model):

    SCM_TYPE_CHOICES = [
        ('', _('Manual')),
        ('git', _('Git')),
        ('hg', _('Mercurial')),
        ('svn', _('Subversion')),
    ]
    
    class Meta:
        abstract = True

    # Project files must be available on the server in folders directly
    # beneath the path specified by settings.PROJECTS_ROOT.  There is no way
    # via the API to upload/update a project or its playbooks; this must be
    # done by other means for now.

    @classmethod
    def get_local_path_choices(cls):
        if os.path.exists(settings.PROJECTS_ROOT):
            paths = [x for x in os.listdir(settings.PROJECTS_ROOT)
                     if os.path.isdir(os.path.join(settings.PROJECTS_ROOT, x))
                     and not x.startswith('.') and not x.startswith('_')]
            qs = Project.objects.filter(active=True)
            used_paths = qs.values_list('local_path', flat=True)
            return [x for x in paths if x not in used_paths]
        else:
            return []

    local_path = models.CharField(
        max_length=1024,
        blank=True,
        help_text=_('Local path (relative to PROJECTS_ROOT) containing '
                    'playbooks and related files for this project.')
    )

    scm_type = models.CharField(
        max_length=8,
        choices=SCM_TYPE_CHOICES,
        blank=True,
        default='',
        verbose_name=_('SCM Type'),
    )
    scm_url = models.CharField(
        max_length=1024,
        blank=True,
        default='',
        verbose_name=_('SCM URL'),
    )
    scm_branch = models.CharField(
        max_length=256,
        blank=True,
        default='',
        verbose_name=_('SCM Branch'),
        help_text=_('Specific branch, tag or commit to checkout.'),
    )
    scm_clean = models.BooleanField(
        default=False,
    )
    scm_delete_on_update = models.BooleanField(
        default=False,
    )
    credential = models.ForeignKey(
        'Credential',
        related_name='%(class)ss',
        blank=True,
        null=True,
        default=None,
    )

    def clean_scm_type(self):
        return self.scm_type or ''

    def clean_scm_url(self):
        scm_url = unicode(self.scm_url or '')
        if not self.scm_type:
            return ''
        try:
            scm_url = update_scm_url(self.scm_type, scm_url,
                                     check_special_cases=False)
        except ValueError, e:
            raise ValidationError((e.args or ('Invalid SCM URL',))[0])
        scm_url_parts = urlparse.urlsplit(scm_url)
        if self.scm_type and not any(scm_url_parts):
            raise ValidationError('SCM URL is required')
        return unicode(self.scm_url or '')

    def clean_credential(self):
        if not self.scm_type:
            return None
        cred = self.credential
        if cred:
            if cred.kind != 'scm':
                raise ValidationError('Credential kind must be "scm"')
            try:
                scm_url = update_scm_url(self.scm_type, self.scm_url,
                                         check_special_cases=False)
                scm_url_parts = urlparse.urlsplit(scm_url)
                # Prefer the username/password in the URL, if provided.
                scm_username = scm_url_parts.username or cred.username or ''
                if scm_url_parts.password or cred.password:
                    scm_password = '********'
                else:
                    scm_password = ''
                try:
                    update_scm_url(self.scm_type, self.scm_url, scm_username,
                                   scm_password)
                except ValueError, e:
                    raise ValidationError((e.args or ('Invalid credential',))[0])
            except ValueError:
                pass
        return cred


class ProjectBase(ProjectOptions):
    '''
    A project represents a playbook git repo that can access a set of inventories
    '''

    class Meta:
        app_label = 'main'
        abstract = True

    # this is not part of the project, but managed with perms
    # inventories      = models.ManyToManyField('Inventory', blank=True, related_name='projects')

    scm_delete_on_next_update = models.BooleanField(
        default=False,
        editable=False,
    )
    scm_update_on_launch = models.BooleanField(
        default=False,
    )
    scm_update_cache_timeout = models.PositiveIntegerField(
        default=0,
    )


class ProjectBaseMethods(object):

    def save(self, *args, **kwargs):
        new_instance = not bool(self.pk)
        # If update_fields has been specified, add our field names to it,
        # if it hasn't been specified, then we're just doing a normal save.
        update_fields = kwargs.get('update_fields', [])
        # Check if scm_type or scm_url changes.
        if self.pk:
            project_before = self.__class__.objects.get(pk=self.pk)
            if project_before.scm_type != self.scm_type or project_before.scm_url != self.scm_url:
                self.scm_delete_on_next_update = True
                if 'scm_delete_on_next_update' not in update_fields:
                    update_fields.append('scm_delete_on_next_update')
        # Create auto-generated local path if project uses SCM.
        if self.pk and self.scm_type and not self.local_path.startswith('_'):
            slug_name = slugify(unicode(self.name)).replace(u'-', u'_')
            self.local_path = u'_%d__%s' % (self.pk, slug_name)
            if 'local_path' not in update_fields:
                update_fields.append('local_path')
        # Do the actual save.
        super(ProjectBaseMethods, self).save(*args, **kwargs)
        if new_instance:
            update_fields=[]
            # Generate local_path for SCM after initial save (so we have a PK).
            if self.scm_type and not self.local_path.startswith('_'):
                update_fields.append('local_path')
            if update_fields:
                self.save(update_fields=update_fields)
        # If we just created a new project with SCM, start the initial update.
        if new_instance and self.scm_type:
            self.update()

    def _get_current_status(self):
        if self.scm_type:
            if self.current_update:
                return 'updating'
            elif not self.last_job:
                return 'never updated'
            elif self.last_job_failed:
                return 'failed'
            elif not self.get_project_path():
                return 'missing'
            else:
                return 'successful'
        elif not self.get_project_path():
            return 'missing'
        else:
            return 'ok'

    def _get_last_job_run(self):
        if self.scm_type and self.last_job:
            return self.last_job.finished
        else:
            project_path = self.get_project_path()
            if project_path:
                try:
                    mtime = os.path.getmtime(project_path)
                    dt = datetime.datetime.fromtimestamp(mtime)
                    return make_aware(dt, get_default_timezone())
                except os.error:
                    pass

    def _can_update(self):
        # FIXME: Prevent update when another one is active!
        return bool(self.scm_type)# and not self.current_update)

    def update_signature(self, **kwargs):
        if self.can_update:
            project_update = self.project_updates.create() # FIXME: Copy options to ProjectUpdate
            project_update_sig = project_update.start_signature()
            return (project_update, project_update_sig)

    def update(self, **kwargs):
        if self.can_update:
            project_update = self.project_updates.create() # FIXME: Copy options to ProjectUpdate
            project_update.start()
            return project_update

    def get_absolute_url(self):
        return reverse('api:project_detail', args=(self.pk,))

    def get_project_path(self, check_if_exists=True):
        local_path = os.path.basename(self.local_path)
        if local_path and not local_path.startswith('.'):
            proj_path = os.path.join(settings.PROJECTS_ROOT, local_path)
            if not check_if_exists or os.path.exists(proj_path):
                return proj_path

    @property
    def playbooks(self):
        valid_re = re.compile(r'^\s*?-?\s*?(?:hosts|include):\s*?.*?$')
        results = []
        project_path = self.get_project_path()
        if project_path:
            for dirpath, dirnames, filenames in os.walk(project_path):
                for filename in filenames:
                    if os.path.splitext(filename)[-1] not in ['.yml', '.yaml']:
                        continue
                    playbook = os.path.join(dirpath, filename)
                    # Filter files that do not have either hosts or top-level
                    # includes. Use regex to allow files with invalid YAML to
                    # show up.
                    matched = False
                    try:
                        for line in file(playbook):
                            if valid_re.match(line):
                                matched = True
                    except IOError:
                        continue
                    if not matched:
                        continue
                    playbook = os.path.relpath(playbook, project_path)
                    # Filter files in a roles subdirectory.
                    if 'roles' in playbook.split(os.sep):
                        continue
                    # Filter files in a tasks subdirectory.
                    if 'tasks' in playbook.split(os.sep):
                        continue
                    results.append(playbook)
        return results


if getattr(settings, 'UNIFIED_JOBS_STEP') == 0:

    class Project(ProjectBaseMethods, CommonModel, ProjectBase):

        PROJECT_STATUS_CHOICES = [
            ('ok', 'OK'),
            ('missing', 'Missing'),
            ('never updated', 'Never Updated'),
            ('updating', 'Updating'),
            ('failed', 'Failed'),
            ('successful', 'Successful'),
        ]

        class Meta:
            app_label = 'main'

        current_update = models.ForeignKey(
            'ProjectUpdate',
            null=True,
            default=None,
            editable=False,
            related_name='project_as_current_update+',
        )
        last_update = models.ForeignKey(
            'ProjectUpdate',
            null=True,
            default=None,
            editable=False,
            related_name='project_as_last_update+',
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
            choices=PROJECT_STATUS_CHOICES,
            default='ok',
            editable=False,
            null=True, # FIXME: Remove
        )

if getattr(settings, 'UNIFIED_JOBS_STEP') in (0, 1):

    class ProjectNew(ProjectBaseMethods, UnifiedJobTemplate, ProjectBase):

        class Meta:
            app_label = 'main'

if getattr(settings, 'UNIFIED_JOBS_STEP') == 1:

    class Project(ProjectNew):

        class Meta:
            proxy = True

if getattr(settings, 'UNIFIED_JOBS_STEP') == 2:

    class Project(ProjectBaseMethods, UnifiedJobTemplate, ProjectBase):

        class Meta:
            app_label = 'main'


class ProjectUpdateBase(ProjectOptions):
    '''
    Internal job for tracking project updates from SCM.
    '''

    class Meta:
        app_label = 'main'
        abstract = True


class ProjectUpdateBaseMethods(object):

    def _get_parent_instance(self):
        return self.project

    def get_absolute_url(self):
        return reverse('api:project_update_detail', args=(self.pk,))

    def _get_task_class(self):
        from awx.main.tasks import RunProjectUpdate
        return RunProjectUpdate

    def _update_parent_instance(self):
        parent_instance = self._get_parent_instance()
        if parent_instance:
            if self.status in ('pending', 'waiting', 'running'):
                if parent_instance.current_job != self:
                    parent_instance.current_job = self
                    parent_instance.save(update_fields=['current_job'])
            elif self.status in ('successful', 'failed', 'error', 'canceled'):
                if parent_instance.current_job == self:
                    parent_instance.current_job = None
                parent_instance.last_job = self
                parent_instance.last_job_failed = self.failed
                if not self.failed and parent_instance.scm_delete_on_next_update:
                    parent_instance.scm_delete_on_next_update = False
                parent_instance.save(update_fields=['current_job',
                                                    'last_job',
                                                    'last_job_failed',
                                                    'scm_delete_on_next_update'])


if getattr(settings, 'UNIFIED_JOBS_STEP') == 0:

    class ProjectUpdate(ProjectUpdateBaseMethods, CommonTask, ProjectUpdateBase):

        class Meta:
            app_label = 'main'

        project = models.ForeignKey(
            'Project',
            related_name='project_updates',
            on_delete=models.CASCADE,
            editable=False,
        )

if getattr(settings, 'UNIFIED_JOBS_STEP') in (0, 1):

    class ProjectUpdateNew(ProjectUpdateBaseMethods, UnifiedJob, ProjectUpdateBase):

        class Meta:
            app_label = 'main'

        project = models.ForeignKey(
            'ProjectNew',
            related_name='project_updates',
            on_delete=models.CASCADE,
            editable=False,
        )

if getattr(settings, 'UNIFIED_JOBS_STEP') == 1:
    
    class ProjectUpdate(ProjectUpdateNew):

        class Meta:
            proxy = True

if getattr(settings, 'UNIFIED_JOBS_STEP') == 2:

    class ProjectUpdate(ProjectUpdateBaseMethods, UnifiedJob, ProjectUpdateBase):

        class Meta:
            app_label = 'main'

        project = models.ForeignKey(
            'Project',
            related_name='project_updates',
            on_delete=models.CASCADE,
            editable=False,
        )
