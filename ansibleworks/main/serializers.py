# Copyright (c) 2013 AnsibleWorks, Inc.
# All Rights Reserved.

# Python
import json

# Django
from django.contrib.auth.models import User
from django.core.urlresolvers import reverse
from django.core.exceptions import ObjectDoesNotExist

# Django REST framework
from rest_framework import serializers, pagination
from rest_framework.templatetags.rest_framework import replace_query_param

# AnsibleWorks
from ansibleworks.main.models import *

BASE_FIELDS = ('id', 'url', 'related', 'summary_fields', 'created',
               'creation_date', 'name', 'description')

class NextPageField(pagination.NextPageField):
    ''' makes the pagination relative URL not full URL '''

    def to_native(self, value):
        if not value.has_next():
            return None
        page = value.next_page_number()
        request = self.context.get('request')
        url = request and request.get_full_path() or ''
        return replace_query_param(url, self.page_field, page)

class PreviousPageField(pagination.NextPageField):
    ''' makes the pagination relative URL not full URL '''

    def to_native(self, value):
        if not value.has_previous():
            return None
        page = value.previous_page_number()
        request = self.context.get('request')
        url = request and request.get_full_path() or ''
        return replace_query_param(url, self.page_field, page)

class PaginationSerializer(pagination.BasePaginationSerializer):
    '''
    Custom pagination serializer to output only URL path (without host/port).
    '''

    count = serializers.Field(source='paginator.count')
    next = NextPageField(source='*')
    previous = PreviousPageField(source='*')

# objects that if found we should add summary info for them
SUMMARIZABLE_FKS = ( 
   'organization', 'host', 'group', 'inventory', 'project', 'team', 'job', 'job_template',
   'credential', 'permission' 
)
# fields that should be summarized regardless of object type
SUMMARIZABLE_FIELDS = (
   'name', 'username', 'first_name', 'last_name', 'description'
)

class BaseSerializer(serializers.ModelSerializer):

    # add the URL and related resources
    url            = serializers.SerializerMethodField('get_absolute_url')
    related        = serializers.SerializerMethodField('get_related')
    summary_fields = serializers.SerializerMethodField('get_summary_fields')

    # make certain fields read only
    created       = serializers.SerializerMethodField('get_created')
    creation_date = serializers.SerializerMethodField('get_creation_date') # FIXME: temporarily left this field in case anything uses it.. should be removed.
    active        = serializers.SerializerMethodField('get_active')

    def get_absolute_url(self, obj):
        if isinstance(obj, User):
            return reverse('main:users_detail', args=(obj.pk,))
        else:
            return obj.get_absolute_url()

    def get_related(self, obj):
        res = dict()
        if getattr(obj, 'created_by', None):
            res['created_by'] = reverse('main:users_detail', args=(obj.created_by.pk,))
        return res

    def get_summary_fields(self, obj):
        # return the names (at least) for various fields, so we don't have to write this
        # method for each object.
        summary_fields = {}
        for fk in SUMMARIZABLE_FKS:
            try:
                fkval = getattr(obj, fk, None)
                if fkval is not None:
                    summary_fields[fk] = {}
                    for field in SUMMARIZABLE_FIELDS:
                        fval = getattr(fkval, field, None)
                        if fval is not None:
                            summary_fields[fk][field] = fval
            # Can be raised by the reverse accessor for a OneToOneField.
            except ObjectDoesNotExist:
                pass
        return summary_fields 

    def get_creation_date(self, obj):
        if isinstance(obj, User):
            return obj.date_joined.date()
        else:
            return obj.created.date()

    def get_created(self, obj):
        if isinstance(obj, User):
            return obj.date_joined
        else:
            return obj.created

    def get_active(self, obj):
        if isinstance(obj, User):
            return obj.is_active
        else:
            return obj.active

class OrganizationSerializer(BaseSerializer):

    class Meta:
        model = Organization
        fields = BASE_FIELDS

    def get_related(self, obj):
        res = super(OrganizationSerializer, self).get_related(obj)
        res.update(dict(
            #audit_trail = reverse('main:organizations_audit_trail_list',    args=(obj.pk,)),
            projects    = reverse('main:organizations_projects_list',       args=(obj.pk,)),
            inventories = reverse('main:organizations_inventories_list',    args=(obj.pk,)),
            users       = reverse('main:organizations_users_list',          args=(obj.pk,)),
            admins      = reverse('main:organizations_admins_list',         args=(obj.pk,)),
            #tags        = reverse('main:organizations_tags_list',           args=(obj.pk,)),
            teams       = reverse('main:organizations_teams_list',          args=(obj.pk,)),
        ))
        return res

class ProjectSerializer(BaseSerializer):

    playbooks = serializers.Field(source='playbooks')
    local_path_choices = serializers.SerializerMethodField('get_local_path_choices')

    class Meta:
        model = Project
        fields = BASE_FIELDS + ('local_path', 'local_path_choices')
                                # 'default_playbook', 'scm_type')

    def get_related(self, obj):
        res = super(ProjectSerializer, self).get_related(obj)
        res.update(dict(
            organizations = reverse('main:projects_organizations_list', args=(obj.pk,)),
            playbooks = reverse('main:projects_detail_playbooks', args=(obj.pk,)),
        ))
        return res

    def get_local_path_choices(self, obj):
        return Project.get_local_path_choices()

class ProjectPlaybooksSerializer(ProjectSerializer):

    class Meta:
        model = Project
        fields = ('playbooks',)

    def to_native(self, obj):
        ret = super(ProjectPlaybooksSerializer, self).to_native(obj)
        return ret.get('playbooks', [])
    
class InventorySerializer(BaseSerializer):

    class Meta:
        model = Inventory
        fields = BASE_FIELDS + ('organization', 'variables',
                                'has_active_failures')

    def get_related(self, obj):
        res = super(InventorySerializer, self).get_related(obj)
        res.update(dict(
            hosts         = reverse('main:inventory_hosts_list',        args=(obj.pk,)),
            groups        = reverse('main:inventory_groups_list',       args=(obj.pk,)),
            root_groups   = reverse('main:inventory_root_groups_list',  args=(obj.pk,)),
            variable_data = reverse('main:inventory_variable_detail',   args=(obj.pk,)),
            organization  = reverse('main:organizations_detail',        args=(obj.organization.pk,)),
        ))
        return res

class HostSerializer(BaseSerializer):

    class Meta:
        model = Host
        fields = BASE_FIELDS + ('inventory', 'variables', 'has_active_failures')

    def get_related(self, obj):
        res = super(HostSerializer, self).get_related(obj)
        res.update(dict(
            variable_data = reverse('main:hosts_variable_detail', args=(obj.pk,)),
            inventory     = reverse('main:inventory_detail',      args=(obj.inventory.pk,)),
            job_events    = reverse('main:host_job_event_list',   args=(obj.pk,)),
            job_host_summaries = reverse('main:host_job_host_summary_list', args=(obj.pk,)),
        ))
        if obj.last_job:
            res['last_job'] = reverse('main:job_detail', args=(obj.last_job.pk,))
        if obj.last_job_host_summary:
            res['last_job_host_summary'] = reverse('main:job_host_summary_detail', args=(obj.last_job_host_summary.pk,))
        # NICE TO HAVE: possible reverse resource to show what groups the host is in
        return res

class GroupSerializer(BaseSerializer):

    class Meta:
        model = Group
        fields = BASE_FIELDS + ('inventory', 'variables', 'has_active_failures')

    def get_related(self, obj):
        res = super(GroupSerializer, self).get_related(obj)
        res.update(dict(
            variable_data = reverse('main:groups_variable_detail', args=(obj.pk,)),
            hosts         = reverse('main:groups_hosts_list',      args=(obj.pk,)),
            children      = reverse('main:groups_children_list',   args=(obj.pk,)),
            all_hosts     = reverse('main:groups_all_hosts_list',  args=(obj.pk,)),
            inventory     = reverse('main:inventory_detail',       args=(obj.inventory.pk,)),
            job_events    = reverse('main:group_job_event_list',   args=(obj.pk,)),
            job_host_summaries = reverse('main:group_job_host_summary_list', args=(obj.pk,)),
        ))
        return res

class BaseVariableDataSerializer(BaseSerializer):

    def to_native(self, obj):
        ret = super(BaseVariableDataSerializer, self).to_native(obj)
        return json.loads(ret.get('variables', '') or '{}')

    def from_native(self, data, files):
        data = {'variables': json.dumps(data)}
        return super(BaseVariableDataSerializer, self).from_native(data, files)

class InventoryVariableDataSerializer(BaseVariableDataSerializer):

    class Meta:
        model = Inventory
        fields = ('variables',)

class HostVariableDataSerializer(BaseVariableDataSerializer):

    class Meta:
        model = Host
        fields = ('variables',)

class GroupVariableDataSerializer(BaseVariableDataSerializer):

    class Meta:
        model = Group
        fields = ('variables',)

class TeamSerializer(BaseSerializer):

    class Meta:
        model = Team
        fields = BASE_FIELDS + ('organization',)

    def get_related(self, obj):
        res = super(TeamSerializer, self).get_related(obj)
        res.update(dict(
            projects     = reverse('main:teams_projects_list',    args=(obj.pk,)),
            users        = reverse('main:teams_users_list',       args=(obj.pk,)),
            credentials  = reverse('main:teams_credentials_list', args=(obj.pk,)),
            organization = reverse('main:organizations_detail',   args=(obj.organization.pk,)),
            permissions  = reverse('main:teams_permissions_list', args=(obj.pk,)),
        ))
        return res

class PermissionSerializer(BaseSerializer):

    class Meta:
        model = Permission
        fields = BASE_FIELDS + ('user', 'team', 'project', 'inventory',
                                'permission_type',)
         
    def get_related(self, obj):
        res = super(PermissionSerializer, self).get_related(obj)
        if obj.user:
            res['user']        = reverse('main:users_detail', args=(obj.user.pk,))
        if obj.team:
            res['team']        = reverse('main:teams_detail', args=(obj.team.pk,))
        if obj.project:
            res['project']     = reverse('main:projects_detail', args=(obj.project.pk,)) 
        if obj.inventory:
            res['inventory']   = reverse('main:inventory_detail', args=(obj.inventory.pk,))
        return res

class CredentialSerializer(BaseSerializer):

    # FIXME: may want to make some of these filtered based on user accessing

    class Meta:
        model = Credential
        fields = BASE_FIELDS + ('ssh_username', 'ssh_password', 'ssh_key_data',
                                'ssh_key_unlock', 'sudo_username',
                                'sudo_password', 'user', 'team',)

    def get_related(self, obj):
        res = super(CredentialSerializer, self).get_related(obj)
        if obj.user:
            res['user'] = reverse('main:users_detail', args=(obj.user.pk,))
        if obj.team:
            res['team'] = reverse('main:teams_detail', args=(obj.team.pk,))
        return res

    def validate(self, attrs):
        ''' some fields cannot be changed once written '''
        if self.object is not None:
            # this is an update
            if self.object.user != attrs['user']:
                raise serializers.ValidationError("user cannot be changed")
            if self.object.team != attrs['team']:
                raise serializers.ValidationError("team cannot be changed")
        return attrs

class UserSerializer(BaseSerializer):

    class Meta:
        model = User
        fields = ('id', 'url', 'related', 'created', 'creation_date',
                  'username', 'first_name', 'last_name', 'email', 'is_active',
                  'is_superuser',)

    def get_related(self, obj):
        res = super(UserSerializer, self).get_related(obj)
        res.update(dict(
            teams                  = reverse('main:users_teams_list',               args=(obj.pk,)),
            organizations          = reverse('main:users_organizations_list',       args=(obj.pk,)),
            admin_of_organizations = reverse('main:users_admin_organizations_list', args=(obj.pk,)),
            projects               = reverse('main:users_projects_list',            args=(obj.pk,)),
            credentials            = reverse('main:users_credentials_list',         args=(obj.pk,)),
            permissions            = reverse('main:users_permissions_list',         args=(obj.pk,)),
        ))
        return res

class JobTemplateSerializer(BaseSerializer):

    class Meta:
        model = JobTemplate
        fields = BASE_FIELDS + ('job_type', 'inventory', 'project', 'playbook',
                                'credential', 'forks', 'limit', 'verbosity',
                                'extra_vars', 'job_tags')

    def get_related(self, obj):
        res = super(JobTemplateSerializer, self).get_related(obj)
        res.update(dict(
            inventory   = reverse('main:inventory_detail',   args=(obj.inventory.pk,)),
            project     = reverse('main:projects_detail',    args=(obj.project.pk,)),
            jobs        = reverse('main:job_template_job_list', args=(obj.pk,)),
        ))
        if obj.credential:
            res['credential'] = reverse('main:credentials_detail', args=(obj.credential.pk,))
        return res

    def validate_playbook(self, attrs, source):
        project = attrs.get('project', None)
        playbook = attrs.get('playbook', '')
        if project and playbook and playbook not in project.playbooks:
            raise serializers.ValidationError('Playbook not found for project')
        return attrs

class JobSerializer(BaseSerializer):

    passwords_needed_to_start = serializers.Field(source='get_passwords_needed_to_start')

    class Meta:
        model = Job
        fields = BASE_FIELDS + ('job_template', 'job_type', 'inventory',
                                'project', 'playbook', 'credential',
                                'forks', 'limit', 'verbosity', 'extra_vars',
                                'job_tags', 'status', 'failed', 'result_stdout',
                                'result_traceback',
                                'passwords_needed_to_start')

    def get_related(self, obj):
        res = super(JobSerializer, self).get_related(obj)
        res.update(dict(
            inventory   = reverse('main:inventory_detail',   args=(obj.inventory.pk,)),
            project     = reverse('main:projects_detail',    args=(obj.project.pk,)),
            credential  = reverse('main:credentials_detail', args=(obj.credential.pk,)),
            job_events  = reverse('main:job_job_event_list', args=(obj.pk,)),
            job_host_summaries = reverse('main:job_job_host_summary_list', args=(obj.pk,)),
        ))
        if obj.job_template:
            res['job_template'] = reverse('main:job_template_detail', args=(obj.job_template.pk,))
        if obj.can_start or True:
            res['start'] = reverse('main:job_start', args=(obj.pk,))
        if obj.can_cancel or True:
            res['cancel'] = reverse('main:job_cancel', args=(obj.pk,))
        return res

    def from_native(self, data, files):
        # When creating a new job and a job template is specified, populate any
        # fields not provided in data from the job template.
        if not self.object and isinstance(data, dict) and 'job_template' in data:
            try:
                job_template = JobTemplate.objects.get(pk=data['job_template'])
            except JobTemplate.DoesNotExist:
                self._errors = {'job_template': 'Invalid job template'}
                return
            # Don't auto-populate name or description.
            data.setdefault('job_type', job_template.job_type)
            data.setdefault('inventory', job_template.inventory.pk)
            data.setdefault('project', job_template.project.pk)
            data.setdefault('playbook', job_template.playbook)
            if job_template.credential:
                data.setdefault('credential', job_template.credential.pk)
            data.setdefault('forks', job_template.forks)
            data.setdefault('limit', job_template.limit)
            data.setdefault('verbosity', job_template.verbosity)
            data.setdefault('extra_vars', job_template.extra_vars)
            data.setdefault('job_tags', job_template.job_tags)
        return super(JobSerializer, self).from_native(data, files)

class JobHostSummarySerializer(BaseSerializer):

    class Meta:
        model = JobHostSummary
        fields = ('id', 'url', 'job', 'host', 'summary_fields', 'related',
                  'changed', 'dark', 'failures', 'ok', 'processed', 'skipped',
                  'failed')

    def get_related(self, obj):
        res = super(JobHostSummarySerializer, self).get_related(obj)
        res.update(dict(
            job=reverse('main:job_detail', args=(obj.job.pk,)),
            host=reverse('main:hosts_detail', args=(obj.host.pk,))
        ))
        return res

class JobEventSerializer(BaseSerializer):

    event_display = serializers.Field(source='get_event_display')

    class Meta:
        model = JobEvent
        fields = ('id', 'url', 'created', 'job', 'event', 'event_display',
                  'event_data', 'failed', 'host', 'related', 'summary_fields')

    def get_related(self, obj):
        res = super(JobEventSerializer, self).get_related(obj)
        res.update(dict(
            job = reverse('main:job_detail', args=(obj.job.pk,)),
        ))
        if obj.host:
            res['host'] = reverse('main:hosts_detail', args=(obj.host.pk,))
        return res
