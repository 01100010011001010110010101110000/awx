# Copyright (c) 2013 AnsibleWorks, Inc.
#
# This file is part of Ansible Commander.
# 
# Ansible Commander is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, version 3 of the License. 
#
# Ansible Commander is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
# GNU General Public License for more details.
# 
# You should have received a copy of the GNU General Public License
# along with Ansible Commander. If not, see <http://www.gnu.org/licenses/>.


import os
import shlex
from django.conf import settings
from django.db import models, DatabaseError
from django.db.models import CASCADE, SET_NULL, PROTECT
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils.translation import ugettext_lazy as _
from django.core.urlresolvers import reverse
from django.contrib.auth.models import User
from django.utils.timezone import now
from jsonfield import JSONField
from djcelery.models import TaskMeta
from rest_framework.authtoken.models import Token
import yaml

# TODO: reporting model TBD

PERM_INVENTORY_ADMIN  = 'admin'
PERM_INVENTORY_READ   = 'read'
PERM_INVENTORY_WRITE  = 'write'
PERM_INVENTORY_DEPLOY = 'run'
PERM_INVENTORY_CHECK  = 'check'

JOB_TYPE_CHOICES = [
    (PERM_INVENTORY_DEPLOY, _('Run')),
    (PERM_INVENTORY_CHECK, _('Check')),
]

PERMISSION_TYPES = [
    PERM_INVENTORY_ADMIN,
    PERM_INVENTORY_READ,
    PERM_INVENTORY_WRITE,
    PERM_INVENTORY_DEPLOY,
    PERM_INVENTORY_CHECK,
]

PERMISSION_TYPES_ALLOWING_INVENTORY_READ = [
    PERM_INVENTORY_ADMIN,
    PERM_INVENTORY_WRITE,
    PERM_INVENTORY_READ,
]

PERMISSION_TYPES_ALLOWING_INVENTORY_WRITE = [
    PERM_INVENTORY_ADMIN,
    PERM_INVENTORY_WRITE,
]

PERMISSION_TYPES_ALLOWING_INVENTORY_ADMIN = [
    PERM_INVENTORY_ADMIN,
]

# FIXME: TODO: make sure all of these are used and consistent
PERMISSION_TYPE_CHOICES = [
    (PERM_INVENTORY_READ, _('Read Inventory')),
    (PERM_INVENTORY_WRITE, _('Edit Inventory')),
    (PERM_INVENTORY_ADMIN, _('Administrate Inventory')),
    (PERM_INVENTORY_DEPLOY, _('Deploy To Inventory')),
    (PERM_INVENTORY_CHECK, _('Deploy To Inventory (Dry Run)')),
]

class EditHelper(object):

    @classmethod
    def illegal_changes(cls, request, obj, model_class):
        ''' have any illegal changes been made (for a PUT request)? '''
        from lib.main.access import check_user_access
        #can_admin = model_class.can_user_administrate(request.user, obj, request.DATA)
        can_admin = check_user_access(request.user, User, 'change', obj, request.DATA)
        if (not can_admin) or (can_admin == 'partial'):
            check_fields = model_class.admin_only_edit_fields
            changed = cls.fields_changed(check_fields, obj, request.DATA)
            if len(changed.keys()) > 0:
                return True
        return False

    @classmethod
    def fields_changed(cls, fields, obj, data):
        ''' return the fields that would be changed by a prospective PUT operation '''
        changed = {}
        for f in fields:
            left = getattr(obj, f, None)
            if left is None:
                raise Exception("internal error, %s is not a member of %s" % (f, obj))
            right = data.get(f, None)
            if (right is not None) and (left != right):
                changed[f] = (left, right)
        return changed

class UserHelper(object):

    # fields that the user themselves cannot edit, but are not actually read only
    admin_only_edit_fields = ('last_name', 'first_name', 'username', 'is_active', 'is_superuser')

class PrimordialModel(models.Model):
    '''
    common model for all object types that have these standard fields
    must use a subclass CommonModel or CommonModelNameNotUnique though
    as this lacks a name field.
    '''

    class Meta:
        abstract = True

    description   = models.TextField(blank=True, default='')
    created_by    = models.ForeignKey('auth.User', on_delete=SET_NULL, null=True, related_name='%s(class)s_created', editable=False) # not blank=False on purpose for admin!
    created       = models.DateTimeField(auto_now_add=True)
    tags          = models.ManyToManyField('Tag', related_name='%(class)s_by_tag', blank=True)
    audit_trail   = models.ManyToManyField('AuditTrail', related_name='%(class)s_by_audit_trail', blank=True)
    active        = models.BooleanField(default=True)

    def __unicode__(self):
        return unicode("%s-%s"% (self.name, self.id))

class CommonModel(PrimordialModel):
    ''' a base model where the name is unique '''

    class Meta:
        abstract = True

    name          = models.CharField(max_length=512, unique=True)

class CommonModelNameNotUnique(PrimordialModel):
    ''' a base model where the name is not unique '''

    class Meta:
        abstract = True

    name          = models.CharField(max_length=512, unique=False)

class Tag(models.Model):
    '''
    any type of object can be given a search tag
    '''

    class Meta:
        app_label = 'main'

    name = models.CharField(max_length=512)

    def __unicode__(self):
        return unicode(self.name)

    def get_absolute_url(self):
        return reverse('main:tags_detail', args=(self.pk,))

class AuditTrail(models.Model):
    '''
    changing any object records the change
    '''

    class Meta:
        app_label = 'main'

    resource_type = models.CharField(max_length=64)
    modified_by   = models.ForeignKey('auth.User', on_delete=SET_NULL, null=True, blank=True)
    delta         = models.TextField() # FIXME: switch to JSONField
    detail        = models.TextField()
    comment       = models.TextField()

    # FIXME: this looks like this should be a ManyToMany
    tag           = models.ForeignKey('Tag', on_delete=SET_NULL, null=True, blank=True)

class Organization(CommonModel):
    '''
    organizations are the basic unit of multi-tenancy divisions
    '''

    class Meta:
        app_label = 'main'

    users    = models.ManyToManyField('auth.User', blank=True, related_name='organizations')
    admins   = models.ManyToManyField('auth.User', blank=True, related_name='admin_of_organizations')
    projects = models.ManyToManyField('Project', blank=True, related_name='organizations')

    def get_absolute_url(self):
        return reverse('main:organizations_detail', args=(self.pk,))

    def __unicode__(self):
        return self.name

class Inventory(CommonModel):
    '''
    an inventory source contains lists and hosts.
    '''

    class Meta:
        app_label = 'main'
        verbose_name_plural = _('inventories')
        unique_together = (("name", "organization"),)

    organization = models.ForeignKey(Organization, null=False, related_name='inventories')

    def get_absolute_url(self):
        return reverse('main:inventory_detail', args=(self.pk,))

class Host(CommonModelNameNotUnique):
    '''
    A managed node
    '''

    class Meta:
        app_label = 'main'
        unique_together = (("name", "inventory"),)

    variable_data           = models.OneToOneField('VariableData', null=True, default=None, blank=True, on_delete=SET_NULL, related_name='host')
    inventory               = models.ForeignKey('Inventory', null=False, related_name='hosts')
    last_job                = models.ForeignKey('Job', blank=True, null=True, default=None, on_delete=models.SET_NULL, related_name='hosts_as_last_job+')
    last_job_host_summary   = models.ForeignKey('JobHostSummary', blank=True, null=True, default=None, on_delete=models.SET_NULL, related_name='hosts_as_last_job_summary+')

    def __unicode__(self):
        return self.name

    def get_absolute_url(self):
        return reverse('main:hosts_detail', args=(self.pk,))

    # Use .job_host_summaries.all() to get jobs affecting this host.
    # Use .job_events.all() to get events affecting this host.
    # Use .job_host_summaries.order_by('-pk')[0] to get the last result.

class Group(CommonModelNameNotUnique):
    '''
    A group of managed nodes.  May belong to multiple groups
    '''

    class Meta:
        app_label = 'main'
        unique_together = (("name", "inventory"),)

    inventory     = models.ForeignKey('Inventory', null=False, related_name='groups')
    parents       = models.ManyToManyField('self', symmetrical=False, related_name='children', blank=True)
    variable_data = models.OneToOneField('VariableData', null=True, default=None, blank=True, on_delete=SET_NULL, related_name='group')
    hosts         = models.ManyToManyField('Host', related_name='groups', blank=True)

    def __unicode__(self):
        return self.name

    def get_absolute_url(self):
        return reverse('main:groups_detail', args=(self.pk,))

    @property
    def all_hosts(self):
        qs = self.hosts.distinct()
        for group in self.children.exclude(pk=self.pk):
            qs = qs | group.all_hosts
        return qs

    @property
    def job_host_summaries(self):
        return JobHostSummary.objects.filter(host__in=self.all_hosts)

    @property
    def job_events(self):
        return JobEvent.objects.filter(host__in=self.all_hosts)

# FIXME: audit nullables
# FIXME: audit cascades

class VariableData(CommonModelNameNotUnique):
    '''
    A set of host or group variables
    '''

    class Meta:
        app_label = 'main'
        verbose_name_plural = _('variable data')

    #host  = models.OneToOneField('Host', null=True, default=None, blank=True, on_delete=SET_NULL, related_name='variable_data')
    #group = models.OneToOneField('Group', null=True, default=None, blank=True, on_delete=SET_NULL, related_name='variable_data')
    data  = models.TextField(default='')

    def __unicode__(self):
        return '%s = %s' % (self.name, self.data)

    def get_absolute_url(self):
        return reverse('main:variable_detail', args=(self.pk,))

class Credential(CommonModelNameNotUnique):
    '''
    A credential contains information about how to talk to a remote set of hosts
    Usually this is a SSH key location, and possibly an unlock password.
    If used with sudo, a sudo password should be set if required.
    '''

    class Meta:
        app_label = 'main'

    user            = models.ForeignKey('auth.User', null=True, default=None, blank=True, on_delete=SET_NULL, related_name='credentials')
    team            = models.ForeignKey('Team', null=True, default=None, blank=True, on_delete=SET_NULL, related_name='credentials')

    ssh_username = models.CharField(
        blank=True,
        default='',
        max_length=1024,
        verbose_name=_('SSH username'),
        help_text=_('SSH username for a job using this credential.'),
    )
    ssh_password = models.CharField(
        blank=True,
        default='',
        max_length=1024,
        verbose_name=_('SSH password'),
        help_text=_('SSH password (or "ASK" to prompt the user).'),
    )
    ssh_key_data = models.TextField(
        blank=True,
        default='',
        verbose_name=_('SSH private key'),
        help_text=_('RSA or DSA private key to be used instead of password.'),
    )
    ssh_key_unlock = models.CharField(
        max_length=1024,
        blank=True,
        default='',
        verbose_name=_('SSH key unlock'),
        help_text=_('Passphrase to unlock SSH private key if encrypted (or '
                    '"ASK" to prompt the user).'),
    )
    sudo_username = models.CharField(
        max_length=1024,
        blank=True,
        default='',
        help_text=_('Sudo username for a job using this credential.'),
    )
    sudo_password = models.CharField(
        max_length=1024,
        blank=True,
        default='',
        help_text=_('Sudo password (or "ASK" to prompt the user).'),
    )

    @property
    def needs_ssh_password(self):
        return not self.ssh_key_data and self.ssh_password == 'ASK'

    @property
    def needs_ssh_key_unlock(self):
        return 'ENCRYPTED' in self.ssh_key_data and \
            (not self.ssh_key_unlock or self.ssh_key_unlock == 'ASK')

    @property
    def needs_sudo_password(self):
        return self.sudo_password == 'ASK'

    def get_absolute_url(self):
        return reverse('main:credentials_detail', args=(self.pk,))

class Team(CommonModel):
    '''
    A team is a group of users that work on common projects.
    '''

    class Meta:
        app_label = 'main'

    projects        = models.ManyToManyField('Project', blank=True, related_name='teams')
    users           = models.ManyToManyField('auth.User', blank=True, related_name='teams')
    organization    = models.ForeignKey('Organization', blank=False, null=True, on_delete=SET_NULL, related_name='teams')

    def get_absolute_url(self):
        return reverse('main:teams_detail', args=(self.pk,))

class Project(CommonModel):
    '''
    A project represents a playbook git repo that can access a set of inventories
    '''

    # this is not part of the project, but managed with perms
    # inventories      = models.ManyToManyField('Inventory', blank=True, related_name='projects')

    # Project files must be available on the server in folders directly
    # beneath the path specified by settings.PROJECTS_ROOT.  There is no way
    # via the API to upload/update a project or its playbooks; this must be
    # done by other means for now.

    @classmethod
    def get_local_path_choices(cls):
        if os.path.exists(settings.PROJECTS_ROOT):
            return [x for x in os.listdir(settings.PROJECTS_ROOT)
                    if os.path.isdir(os.path.join(settings.PROJECTS_ROOT, x))
                    and not x.startswith('.')]
        else:
            return []

    local_path = models.CharField(
        max_length=1024,
        # Not unique for now, otherwise "deletes" won't allow reusing the
        # same path for another active project.
        #unique=True,
        help_text=_('Local path (relative to PROJECTS_ROOT) containing '
                    'playbooks and related files for this project.')
    )
    #scm_type         = models.CharField(max_length=64)
    #default_playbook = models.CharField(max_length=1024)

    def get_absolute_url(self):
        return reverse('main:projects_detail', args=(self.pk,))

    def get_project_path(self):
        local_path = os.path.basename(self.local_path)
        if local_path and not local_path.startswith('.'):
            proj_path = os.path.join(settings.PROJECTS_ROOT, local_path)
            if os.path.exists(proj_path):
                return proj_path

    @property
    def playbooks(self):
        results = []
        project_path = self.get_project_path()
        if project_path:
            for dirpath, dirnames, filenames in os.walk(project_path):
                for filename in filenames:
                    if os.path.splitext(filename)[-1] != '.yml':
                        continue
                    playbook = os.path.join(dirpath, filename)
                    # Filter any invalid YAML files.
                    try:
                        data = yaml.safe_load(file(playbook).read())
                    except (IOError, yaml.YAMLError):
                        continue
                    # Filter files that do not have either hosts or top-level
                    # includes.
                    try:
                        if 'hosts' not in data[0] and 'include' not in data[0]:
                            continue
                    except (TypeError, IndexError, KeyError):
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

class Permission(CommonModelNameNotUnique):
    '''
    A permission allows a user, project, or team to be able to use an inventory source.
    '''

    class Meta:
        app_label = 'main'

    # permissions are granted to either a user or a team:
    user            = models.ForeignKey('auth.User', null=True, on_delete=SET_NULL, blank=True, related_name='permissions')
    team            = models.ForeignKey('Team', null=True, on_delete=SET_NULL, blank=True, related_name='permissions')

    # to be used against a project or inventory (or a project and inventory in conjunction):
    project         = models.ForeignKey('Project', null=True, on_delete=SET_NULL, blank=True, related_name='permissions')
    inventory       = models.ForeignKey('Inventory', null=True, on_delete=SET_NULL, related_name='permissions')

    # permission system explanation:
    #
    # for example, user A on inventory X has write permissions                 (PERM_INVENTORY_WRITE)
    #              team C on inventory X has read permissions                  (PERM_INVENTORY_READ)
    #              team C on inventory X and project Y has launch permissions  (PERM_INVENTORY_DEPLOY)
    #              team C on inventory X and project Z has dry run permissions (PERM_INVENTORY_CHECK)
    #
    # basically for launching, permissions can be awarded to the whole inventory source or just the inventory source
    # in context of a given project.
    #
    # the project parameter is not used when dealing with READ, WRITE, or ADMIN permissions.

    permission_type = models.CharField(max_length=64, choices=PERMISSION_TYPE_CHOICES)

    def __unicode__(self):
        return unicode("Permission(name=%s,ON(user=%s,team=%s),FOR(project=%s,inventory=%s,type=%s))" % (
            self.name,
            self.user,
            self.team,
            self.project,
            self.inventory,
            self.permission_type
        ))

    def get_absolute_url(self):
        return reverse('main:permissions_detail', args=(self.pk,))

# TODO: other job types (later)

class JobTemplate(CommonModel):
    '''
    A job template is a reusable job definition for applying a project (with
    playbook) to an inventory source with a given credential.
    '''

    class Meta:
        app_label = 'main'

    job_type = models.CharField(
        max_length=64,
        choices=JOB_TYPE_CHOICES,
    )
    inventory = models.ForeignKey(
        'Inventory',
        related_name='job_templates',
        null=True,
        on_delete=models.SET_NULL,
    )
    project = models.ForeignKey(
        'Project',
        related_name='job_templates',
        null=True,
        on_delete=models.SET_NULL,
    )
    playbook = models.CharField(
        max_length=1024,
        default='',
    )
    credential = models.ForeignKey(
        'Credential',
        related_name='job_templates',
        blank=True,
        null=True,
        default=None,
        on_delete=models.SET_NULL,
    )
    forks = models.PositiveIntegerField(
        blank=True,
        default=0,
    )
    limit = models.CharField(
        max_length=1024,
        blank=True,
        default='',
    )
    verbosity = models.PositiveIntegerField(
        blank=True,
        default=0,
    )
    extra_vars = models.TextField(
        blank=True,
        default='',
    )

    def create_job(self, **kwargs):
        '''
        Create a new job based on this template.
        '''
        save_job = kwargs.pop('save', True)
        kwargs['job_template'] = self
        kwargs.setdefault('name', '%s %s' % (self.name, now().isoformat()))
        kwargs.setdefault('description', self.description)
        kwargs.setdefault('job_type', self.job_type)
        kwargs.setdefault('inventory', self.inventory)
        kwargs.setdefault('project', self.project)
        kwargs.setdefault('playbook', self.playbook)
        kwargs.setdefault('credential', self.credential)
        kwargs.setdefault('forks', self.forks)
        kwargs.setdefault('limit', self.limit)
        kwargs.setdefault('verbosity', self.verbosity)
        kwargs.setdefault('extra_vars', self.extra_vars)
        job = Job(**kwargs)
        if save_job:
            job.save()
        return job

    def get_absolute_url(self):
        return reverse('main:job_template_detail', args=(self.pk,))

class Job(CommonModel):
    '''
    A job applies a project (with playbook) to an inventory source with a given
    credential.  It represents a single invocation of ansible-playbook with the
    given parameters.
    '''

    STATUS_CHOICES = [
        ('new', _('New')),                  # Job has been created, but not started.
        ('pending', _('Pending')),          # Job has been queued, but is not yet running.
        ('running', _('Running')),          # Job is currently running.
        ('successful', _('Successful')),    # Job completed successfully.
        ('failed', _('Failed')),            # Job completed, but with failures.
        ('error', _('Error')),              # The job was unable to run.
        ('canceled', _('Canceled')),        # The job was canceled before completion.
    ]

    class Meta:
        app_label = 'main'

    job_template = models.ForeignKey(
        'JobTemplate',
        related_name='jobs',
        blank=True,
        null=True,
        default=None,
        on_delete=models.SET_NULL,
    )
    job_type = models.CharField(
        max_length=64,
        choices=JOB_TYPE_CHOICES,
    )
    inventory = models.ForeignKey(
        'Inventory',
        related_name='jobs',
        null=True,
        on_delete=models.SET_NULL,
    )
    credential = models.ForeignKey(
        'Credential',
        related_name='jobs',
        null=True,
        on_delete=models.SET_NULL,
    )
    project = models.ForeignKey(
        'Project',
        related_name='jobs',
        null=True,
        on_delete=models.SET_NULL,
    )
    playbook = models.CharField(
        max_length=1024,
    )
    forks = models.PositiveIntegerField(
        blank=True,
        default=0,
    )
    limit = models.CharField(
        max_length=1024,
        blank=True,
        default='',
    )
    verbosity = models.PositiveIntegerField(
        blank=True,
        default=0,
    )
    extra_vars = models.TextField(
        blank=True,
        default='',
    )
    cancel_flag = models.BooleanField(
        blank=True,
        default=False,
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='new',
        editable=False,
    )
    failed = models.BooleanField(
        default=False,
        editable=False,
    )
    result_stdout = models.TextField(
        blank=True,
        default='',
        editable=False,
    )
    result_traceback = models.TextField(
        blank=True,
        default='',
        editable=False,
    )
    celery_task_id = models.CharField(
        max_length=100,
        blank=True,
        default='',
        editable=False,
    )
    hosts = models.ManyToManyField(
        'Host',
        related_name='jobs',
        blank=True,
        editable=False,
        through='JobHostSummary',
    )

    def get_absolute_url(self):
        return reverse('main:job_detail', args=(self.pk,))

    def save(self, *args, **kwargs):
        self.failed = bool(self.status in ('failed', 'error', 'canceled'))
        super(Job, self).save(*args, **kwargs)

    @property
    def extra_vars_dict(self):
        '''Return extra_vars key=value pairs as a dictionary.'''
        d = {}
        extra_vars = self.extra_vars.encode('utf-8')
        for kv in [x.decode('utf-8') for x in shlex.split(extra_vars, posix=True)]:
            if '=' in kv:
                k, v = kv.split('=', 1)
                d[k] = v
        return d

    @property
    def celery_task(self):
        try:
            if self.celery_task_id:
                return TaskMeta.objects.get(task_id=self.celery_task_id)
        except TaskMeta.DoesNotExist:
            pass

    def get_passwords_needed_to_start(self):
        '''Return list of password field names needed to start the job.'''
        needed = []
        for field in ('ssh_password', 'sudo_password', 'ssh_key_unlock'):
            if self.credential and getattr(self.credential, 'needs_%s' % field):
                needed.append(field)
        return needed

    @property
    def can_start(self):
        return bool(self.status == 'new')

    def start(self, **kwargs):
        from lib.main.tasks import RunJob
        if not self.can_start:
            return False
        needed = self.get_passwords_needed_to_start()
        opts = dict([(field, kwargs.get(field, '')) for field in needed])
        if not all(opts.values()):
            return False
        self.status = 'pending'
        self.save(update_fields=['status'])
        task_result = RunJob().delay(self.pk, **opts)
        # The TaskMeta instance in the database isn't created until the worker
        # starts processing the task, so we can only store the task ID here.
        self.celery_task_id = task_result.task_id
        self.save(update_fields=['celery_task_id'])
        return True

    @property
    def can_cancel(self):
        return bool(self.status in ('pending', 'running'))

    def cancel(self):
        if self.can_cancel:
            if not self.cancel_flag:
                self.cancel_flag = True
                self.save(update_fields=['cancel_flag'])
        return self.cancel_flag

    @property
    def successful_hosts(self):
        return Host.objects.filter(job_host_summaries__job__pk=self.pk,
                                   job_host_summaries__ok__gt=0)

    @property
    def failed_hosts(self):
        return Host.objects.filter(job_host_summaries__job__pk=self.pk,
                                   job_host_summaries__failures__gt=0)

    @property
    def changed_hosts(self):
        return Host.objects.filter(job_host_summaries__job__pk=self.pk,
                                   job_host_summaries__changed__gt=0)

    @property
    def dark_hosts(self):
        return Host.objects.filter(job_host_summaries__job__pk=self.pk,
                                   job_host_summaries__dark__gt=0)

    @property
    def unreachable_hosts(self):
        return self.dark_hosts

    @property
    def skipped_hosts(self):
        return Host.objects.filter(job_host_summaries__job__pk=self.pk,
                                   job_host_summaries__skipped__gt=0)

    @property
    def processed_hosts(self):
        return Host.objects.filter(job_host_summaries__job__pk=self.pk,
                                   job_host_summaries__processed__gt=0)

class JobHostSummary(models.Model):
    '''
    Per-host statistics for each job.
    '''

    class Meta:
        unique_together = [('job', 'host')]
        verbose_name_plural = _('Job Host Summaries')
        ordering = ('-pk',)

    job = models.ForeignKey(
        'Job',
        related_name='job_host_summaries',
        on_delete=models.CASCADE,
    )
    host = models.ForeignKey('Host',
        related_name='job_host_summaries',
        on_delete=models.CASCADE,
    )

    changed = models.PositiveIntegerField(default=0)
    dark = models.PositiveIntegerField(default=0)
    failures = models.PositiveIntegerField(default=0)
    ok = models.PositiveIntegerField(default=0)
    processed = models.PositiveIntegerField(default=0)
    skipped = models.PositiveIntegerField(default=0)

    def __unicode__(self):
        return '%s changed=%d dark=%d failures=%d ok=%d processed=%d skipped=%s' % \
            (self.host.name, self.changed, self.dark, self.failures, self.ok,
             self.processed, self.skipped)

    def get_absolute_url(self):
        return reverse('main:job_host_summary_detail', args=(self.pk,))

    def save(self, *args, **kwargs):
        super(JobHostSummary, self).save(*args, **kwargs)
        self.update_host_last_job_summary()

    def update_host_last_job_summary(self):
        update_fields = []
        if self.host.last_job != self.job:
            self.host.last_job = self.job
            update_fields.append('last_job')
        if self.host.last_job_host_summary != self:
            self.host.last_job_host_summary = self
            update_fields.append('last_job_host_summary')
        if update_fields:
            self.host.save(update_fields=update_fields)

class JobEvent(models.Model):
    '''
    An event/message logged from the callback when running a job.
    '''

    EVENT_TYPES = [
        ('runner_on_failed', _('Runner on Failed')),
        ('runner_on_ok', _('Runner on OK')),
        ('runner_on_error', _('Runner on Error')),
        ('runner_on_skipped', _('Runner on Skipped')),
        ('runner_on_unreachable', _('Runner on Unreachable')),
        ('runner_on_no_hosts', _('Runner on No Hosts')),
        ('runner_on_async_poll', _('Runner on Async Poll')),
        ('runner_on_async_ok', _('Runner on Async OK')),
        ('runner_on_async_failed', _('Runner on Async Failed')),
        ('playbook_on_start', _('Playbook on Start')),
        ('playbook_on_notify', _('Playbook on Notify')),
        ('playbook_on_task_start', _('Playbook on Task Start')),
        ('playbook_on_vars_prompt', _('Playbook on Vars Prompt')),
        ('playbook_on_setup', _('Playbook on Setup')),
        ('playbook_on_import_for_host', _('Playbook on Import for Host')),
        ('playbook_on_not_import_for_host', _('Playbook on Not Import for Host')),
        ('playbook_on_play_start', _('Playbook on Play Start')),
        ('playbook_on_stats', _('Playbook on Stats')),
    ]

    FAILED_EVENTS = [
        'runner_on_failed',
        'runner_on_error',
        'runner_on_unreachable',
        'runner_on_async_failed',
    ]

    class Meta:
        app_label = 'main'
        ordering = ('pk',)

    job = models.ForeignKey(
        'Job',
        related_name='job_events',
        on_delete=models.CASCADE,
    )
    created = models.DateTimeField(
        auto_now_add=True,
    )
    event = models.CharField(
        max_length=100,
        choices=EVENT_TYPES,
    )
    event_data = JSONField(
        blank=True,
        default={},
    )
    failed = models.BooleanField(
        default=False,
    )
    host = models.ForeignKey(
        'Host',
        related_name='job_events',
        blank=True,
        null=True,
        default=None,
        on_delete=models.SET_NULL,
    )

    def get_absolute_url(self):
        return reverse('main:job_event_detail', args=(self.pk,))

    def __unicode__(self):
        return u'%s @ %s' % (self.get_event_display(), self.created.isoformat())

    def save(self, *args, **kwargs):
        try:
            if not self.host and self.event_data.get('host', ''):
                self.host = self.job.inventory.hosts.get(name=self.event_data['host'])
        except (Host.DoesNotExist, AttributeError):
            pass
        self.failed = bool(self.event in self.FAILED_EVENTS)
        super(JobEvent, self).save(*args, **kwargs)
        self.update_host_summary_from_stats()
        self.update_host_last_job()

    def update_host_last_job(self):
        if self.host:
            update_fields = []
            if self.host.last_job != self.job:
                self.host.last_job = self.job
                update_fields.append('last_job')
            if update_fields:
                self.host.save(update_fields=update_fields)

    def update_host_summary_from_stats(self):
        if self.event != 'playbook_on_stats':
            return
        hostnames = set()
        try:
            for v in self.event_data.values():
                hostnames.update(v.keys())
        except AttributeError: # In case event_data or v isn't a dict.
            pass
        for hostname in hostnames:
            try:
                host = self.job.inventory.hosts.get(name=hostname)
            except Host.DoesNotExist:
                continue
            host_summary = self.job.job_host_summaries.get_or_create(host=host)[0]
            host_summary_changed = False
            for stat in ('changed', 'dark', 'failures', 'ok', 'processed', 'skipped'):
                try:
                    value = self.event_data.get(stat, {}).get(hostname, 0)
                    if getattr(host_summary, stat) != value:
                        setattr(host_summary, stat, value)
                        host_summary_changed = True
                except AttributeError: # in case event_data[stat] isn't a dict.
                    pass
            if host_summary_changed:
                host_summary.save()

# TODO: reporting (MPD)

@receiver(post_save, sender=User)
def create_auth_token_for_user(sender, **kwargs):
    instance = kwargs.get('instance', None)
    if instance:
        try:
            Token.objects.get_or_create(user=instance)
        except DatabaseError:
            pass    
    # Only fails when creating a new superuser from syncdb on a
    # new database (before migrate has been called).
