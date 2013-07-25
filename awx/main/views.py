# Copyright (c) 2013 AnsibleWorks, Inc.
# All Rights Reserved.

# Python
import datetime
import re
import socket
import sys

# Django
from django.conf import settings
from django.contrib.auth.models import User
from django.core.urlresolvers import reverse
from django.shortcuts import get_object_or_404, render_to_response
from django.template import RequestContext

# Django REST Framework
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.exceptions import PermissionDenied
from rest_framework import generics
from rest_framework.parsers import YAMLParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.renderers import YAMLRenderer
from rest_framework.response import Response
from rest_framework.settings import api_settings
from rest_framework.views import APIView

# AWX
from awx.main.authentication import JobTaskAuthentication
from awx.main.licenses import LicenseReader
from awx.main.base_views import *
from awx.main.models import *
from awx.main.permissions import *
from awx.main.serializers import *
from awx.main.utils import *

def handle_error(request, status=404):
    context = {}
    #print request.path, status
    if request.path.startswith('/admin/'):
        template_name = 'admin/%d.html' % status
    else:
        template_name = '%d.html' % status
    return render_to_response(template_name, context,
                              context_instance=RequestContext(request))

def handle_403(request):
    return handle_error(request, 403)

def handle_404(request):
    return handle_error(request, 404)

def handle_500(request):
    return handle_error(request, 500)

class ApiRootView(APIView):
    '''
    This resource is the root of the AWX REST API and provides
    information about the available API versions.
    '''

    permission_classes = (AllowAny,)
    view_name = 'REST API'

    def get(self, request, format=None):
        ''' list supported API versions '''

        current = reverse('main:api_v1_root_view', args=[])
        data = dict(
           description = 'AWX REST API',
           current_version = current,
           available_versions = dict(
              v1 = current
           )
        )
        return Response(data)

class ApiV1RootView(APIView):
    '''
    Version 1 of the REST API.

    Subject to change until the final 1.2 release.
    '''

    permission_classes = (AllowAny,)
    view_name = 'Version 1'

    def get(self, request, format=None):
        ''' list top level resources '''

        data = dict(
            organizations = reverse('main:organization_list'),
            users         = reverse('main:user_list'),
            projects      = reverse('main:project_list'),
            teams         = reverse('main:team_list'),
            credentials   = reverse('main:credential_list'),
            inventory     = reverse('main:inventory_list'),
            groups        = reverse('main:group_list'),
            hosts         = reverse('main:host_list'),
            job_templates = reverse('main:job_template_list'),
            jobs          = reverse('main:job_list'),
            authtoken     = reverse('main:auth_token_view'),
            me            = reverse('main:user_me_list'),
            config        = reverse('main:api_v1_config_view'),
        )
        return Response(data)

class ApiV1ConfigView(APIView):
    '''
    Various sitewide configuration settings (some may only be visible to
    superusers or organization admins):

    * `project_base_dir`: Path on the server where projects and playbooks are \
      stored.
    * `project_local_paths`: List of directories beneath `project_base_dir` to
      use when creating/editing a project.
    * `time_zone`: The configured time zone for the server.
    * `license_info`: Information about the current license.
    '''

    permission_classes = (IsAuthenticated,)
    view_name = 'Configuration'

    def get(self, request, format=None):
        '''Return various sitewide configuration settings.'''

        license_reader = LicenseReader()
        license_data   = license_reader.from_file()

        data = dict(
            time_zone = settings.TIME_ZONE,
            # FIXME: Special variables for inventory/group/host variable_data.
        )
        if request.user.is_superuser or request.user.admin_of_organizations.filter(active=True).count():
            data.update(dict(
                project_base_dir = settings.PROJECTS_ROOT,
                project_local_paths = Project.get_local_path_choices(),
            ))
        data['license_info'] = license_data

        return Response(data)

class AuthTokenView(ObtainAuthToken):
    '''
    POST username and password to this resource to obtain an authentication
    token for subsequent requests.
    
    Example JSON to post (application/json):

        {"username": "user", "password": "my pass"}

    Example form data to post (application/x-www-form-urlencoded):

        username=user&password=my%20pass

    If the username and password are valid, the response should be:

        {"token": "8f17825cf08a7efea124f2638f3896f6637f8745"}

    Otherwise, the response will indicate the error that occurred.

    For subsequent requests, pass the token via the HTTP request headers:

        Authenticate: Token 8f17825cf08a7efea124f2638f3896f6637f8745
    '''

    permission_classes = (AllowAny,)
    renderer_classes = api_settings.DEFAULT_RENDERER_CLASSES

class OrganizationList(ListCreateAPIView):

    model = Organization
    serializer_class = OrganizationSerializer

class OrganizationDetail(RetrieveUpdateDestroyAPIView):

    model = Organization
    serializer_class = OrganizationSerializer

class OrganizationInventoriesList(SubListAPIView):

    model = Inventory
    serializer_class = InventorySerializer
    parent_model = Organization
    relationship = 'inventories'

class OrganizationUsersList(SubListCreateAPIView):

    model = User
    serializer_class = UserSerializer
    parent_model = Organization
    relationship = 'users'

class OrganizationAdminsList(SubListCreateAPIView):

    model = User
    serializer_class = UserSerializer
    parent_model = Organization
    relationship = 'admins'

class OrganizationProjectsList(SubListCreateAPIView):

    model = Project
    serializer_class = ProjectSerializer
    parent_model = Organization
    relationship = 'projects'

class OrganizationTeamsList(SubListCreateAPIView):

    model = Team
    serializer_class = TeamSerializer
    parent_model = Organization
    relationship = 'teams'
    parent_key = 'organization'

class TeamList(ListCreateAPIView):

    model = Team
    serializer_class = TeamSerializer

class TeamDetail(RetrieveUpdateDestroyAPIView):

    model = Team
    serializer_class = TeamSerializer

class TeamUsersList(SubListCreateAPIView):

    model = User
    serializer_class = UserSerializer
    parent_model = Team
    relationship = 'users'

class TeamPermissionsList(SubListCreateAPIView):

    model = Permission
    serializer_class = PermissionSerializer
    parent_model = Team
    relationship = 'permissions'
    parent_key = 'team'

    def get_queryset(self):
        # FIXME
        team = Team.objects.get(pk=self.kwargs['pk'])
        base = Permission.objects.filter(team = team)
        #if Team.can_user_administrate(self.request.user, team, None):
        if self.request.user.can_access(Team, 'change', team, None):
            return base
        elif team.users.filter(pk=self.request.user.pk).count() > 0:
            return base
        raise PermissionDenied()

class TeamProjectsList(SubListCreateAPIView):

    model = Project
    serializer_class = ProjectSerializer
    parent_model = Team
    relationship = 'projects'

class TeamCredentialsList(SubListCreateAPIView):

    model = Credential
    serializer_class = CredentialSerializer
    parent_model = Team
    relationship = 'credentials'
    parent_key = 'team'

class ProjectList(ListCreateAPIView):

    model = Project
    serializer_class = ProjectSerializer

class ProjectDetail(RetrieveUpdateDestroyAPIView):

    model = Project
    serializer_class = ProjectSerializer

class ProjectDetailPlaybooks(RetrieveAPIView):

    model = Project
    serializer_class = ProjectPlaybooksSerializer

class ProjectOrganizationsList(SubListCreateAPIView):

    model = Organization
    serializer_class = OrganizationSerializer
    parent_model = Project
    relationship = 'organizations'

    def get_queryset(self):
        # FIXME
        project = Project.objects.get(pk=self.kwargs['pk'])
        if not self.request.user.is_superuser:
            raise PermissionDenied()
        return Organization.objects.filter(projects__in = [ project ])

class ProjectTeamsList(SubListCreateAPIView):

    model = Team
    serializer_class = TeamSerializer
    parent_model = Project
    relationship = 'teams'

    def get_queryset(self):
        project = Project.objects.get(pk=self.kwargs['pk'])
        if not self.request.user.is_superuser:
            raise PermissionDenied()
        return Team.objects.filter(projects__in = [ project ])

class UserList(ListCreateAPIView):

    model = User
    serializer_class = UserSerializer

    def create(self, request, *args, **kwargs):
        password = request.DATA.get('password', None)
        response = super(UserList, self).create(request, *args, **kwargs)
        if password:
            pk = response.data['id']
            user = User.objects.get(pk=pk)
            user.set_password(password)
            user.save()
        return response

class UserMeList(ListAPIView):

    model = User
    serializer_class = UserSerializer

    view_name = 'Me!'

    def get_queryset(self):
        return self.model.objects.filter(pk=self.request.user.pk)

class UserTeamsList(SubListAPIView):

    model = Team
    serializer_class = TeamSerializer
    parent_model = User
    relationship = 'teams'
    parent_access = 'read'

class UserPermissionsList(SubListCreateAPIView):

    model = Permission
    serializer_class = PermissionSerializer
    parent_model = User
    relationship = 'permissions'
    parent_key = 'user'
    parent_access = 'read'

class UserProjectsList(SubListAPIView):

    model = Project
    serializer_class = ProjectSerializer
    parent_model = User
    relationship = 'projects'
    parent_access = 'read'

    def get_queryset(self):
        parent = self.get_parent_object()
        self.check_parent_access(parent)
        qs = self.request.user.get_queryset(self.model)
        return qs.filter(teams__in=parent.teams.distinct())

class UserCredentialsList(SubListCreateAPIView):

    model = Credential
    serializer_class = CredentialSerializer
    parent_model = User
    relationship = 'credentials'
    parent_key = 'user'
    parent_access = 'read'

class UserOrganizationsList(SubListAPIView):

    model = Organization
    serializer_class = OrganizationSerializer
    parent_model = User
    relationship = 'organizations'
    parent_access = 'read'

class UserAdminOfOrganizationsList(SubListAPIView):

    model = Organization
    serializer_class = OrganizationSerializer
    parent_model = User
    relationship = 'admin_of_organizations'
    parent_access = 'read'

class UserDetail(RetrieveUpdateDestroyAPIView):

    model = User
    serializer_class = UserSerializer

    def update_filter(self, request, *args, **kwargs):
        ''' make sure non-read-only fields that can only be edited by admins, are only edited by admins '''
        obj = User.objects.get(pk=kwargs['pk'])
        can_change = request.user.can_access(User, 'change', obj, request.DATA)
        can_admin = request.user.can_access(User, 'admin', obj, request.DATA)
        if can_change and not can_admin:
            admin_only_edit_fields = ('last_name', 'first_name', 'username',
                                      'is_active', 'is_superuser')
            changed = {}
            for field in admin_only_edit_fields:
                left = getattr(obj, field, None)
                right = request.DATA.get(field, None)
                if left is not None and right is not None and left != right:
                    changed[field] = (left, right)
            if changed:
                raise PermissionDenied('Cannot change %s' % ', '.join(changed.keys()))

        new_password = request.DATA.get('password', '')
        if can_change and new_password:
            obj.set_password(new_password)
            obj.save()

class CredentialList(ListAPIView):

    model = Credential
    serializer_class = CredentialSerializer

class CredentialDetail(RetrieveUpdateDestroyAPIView):

    model = Credential
    serializer_class = CredentialSerializer

class PermissionDetail(RetrieveUpdateDestroyAPIView):

    model = Permission
    serializer_class = PermissionSerializer

class InventoryList(ListCreateAPIView):

    model = Inventory
    serializer_class = InventorySerializer

class InventoryDetail(RetrieveUpdateDestroyAPIView):

    model = Inventory
    serializer_class = InventorySerializer

class HostList(ListCreateAPIView):

    model = Host
    serializer_class = HostSerializer

class HostDetail(RetrieveUpdateDestroyAPIView):

    model = Host
    serializer_class = HostSerializer

class InventoryHostsList(SubListCreateAPIView):

    model = Host
    serializer_class = HostSerializer
    parent_model = Inventory
    relationship = 'hosts'
    parent_access = 'read'
    parent_key = 'inventory'

class HostGroupsList(SubListCreateAPIView):
    ''' the list of groups a host is directly a member of '''

    model = Group
    serializer_class = GroupSerializer
    parent_model = Host
    relationship = 'groups'
    parent_access = 'read'

class HostAllGroupsList(SubListAPIView):
    ''' the list of all groups of which the host is directly or indirectly a member '''

    model = Group
    serializer_class = GroupSerializer
    parent_model = Host
    relationship = 'groups'
    parent_access = 'read'

    def get_queryset(self):
        parent = self.get_parent_object()
        self.check_parent_access(parent)
        qs = self.request.user.get_queryset(self.model)
        sublist_qs = parent.all_groups.distinct()
        return qs & sublist_qs

class GroupList(ListCreateAPIView):

    model = Group
    serializer_class = GroupSerializer

class GroupChildrenList(SubListCreateAPIView):

    model = Group
    serializer_class = GroupSerializer
    parent_model = Group
    relationship = 'children'
    parent_access = 'read'

class GroupHostsList(SubListCreateAPIView):
    ''' the list of hosts directly below a group '''

    model = Host
    serializer_class = HostSerializer
    parent_model = Group
    relationship = 'hosts'
    parent_access = 'read'

class GroupAllHostsList(SubListAPIView):
    ''' the list of all hosts below a group, even including subgroups '''

    model = Host
    serializer_class = HostSerializer
    parent_model = Group
    relationship = 'hosts'
    parent_access = 'read'

    def get_queryset(self):
        parent = self.get_parent_object()
        self.check_parent_access(parent)
        qs = self.request.user.get_queryset(self.model)
        sublist_qs = parent.all_hosts.distinct()
        return qs & sublist_qs

class GroupDetail(RetrieveUpdateDestroyAPIView):

    model = Group
    serializer_class = GroupSerializer

class InventoryGroupsList(SubListCreateAPIView):

    model = Group
    serializer_class = GroupSerializer
    parent_model = Inventory
    relationship = 'groups'
    parent_access = 'read'
    parent_key = 'inventory'

class InventoryRootGroupsList(SubListCreateAPIView):

    model = Group
    serializer_class = GroupSerializer
    parent_model = Inventory
    relationship = 'groups'
    parent_access = 'read'
    parent_key = 'inventory'

    def get_queryset(self):
        parent = self.get_parent_object()
        self.check_parent_access(parent)
        qs = self.request.user.get_queryset(self.model)
        all_pks = parent.groups.values_list('pk', flat=True)
        sublist_qs = parent.groups.exclude(parents__pk__in=all_pks).distinct()
        return qs & sublist_qs

class BaseVariableDetail(RetrieveUpdateDestroyAPIView):

    parser_classes = api_settings.DEFAULT_PARSER_CLASSES + [YAMLParser]
    renderer_classes = api_settings.DEFAULT_RENDERER_CLASSES + [YAMLRenderer]
    is_variable_data = True # Special flag for permissions check.
    
class InventoryVariableDetail(BaseVariableDetail):

    model = Inventory
    serializer_class = InventoryVariableDataSerializer

class HostVariableDetail(BaseVariableDetail):

    model = Host
    serializer_class = HostVariableDataSerializer

class GroupVariableDetail(BaseVariableDetail):

    model = Group
    serializer_class = GroupVariableDataSerializer

class InventoryScriptView(RetrieveAPIView):
    '''
    Return inventory group and host data as needed for an inventory script.
    
    Without query parameters, return groups with hosts, children and vars
    (equivalent to the --list parameter to an inventory script).
    
    With ?host=HOSTNAME, return host vars for the given host (equivalent to the
    --host HOSTNAME parameter to an inventory script).
    '''

    model = Inventory
    authentication_classes = [JobTaskAuthentication] + \
                             api_settings.DEFAULT_AUTHENTICATION_CLASSES
    permission_classes = (JobTaskPermission,)
    filter_backends = ()

    def retrieve(self, request, *args, **kwargs):
        self.object = self.get_object()
        hostname = request.QUERY_PARAMS.get('host', '')
        if hostname:
            host = get_object_or_404(self.object.hosts, active=True,
                                     name=hostname)
            data = host.variables_dict
        else:
            data = {}
            for group in self.object.groups.filter(active=True):
                hosts = group.hosts.filter(active=True)
                children = group.children.filter(active=True)
                group_info = {
                    'hosts': list(hosts.values_list('name', flat=True)),
                    'children': list(children.values_list('name', flat=True)),
                    'vars': group.variables_dict,
                }
                group_info = dict(filter(lambda x: bool(x[1]),
                                         group_info.items()))
                if group_info.keys() in ([], ['hosts']):
                    data[group.name] = group_info.get('hosts', [])
                else:
                    data[group.name] = group_info
            if self.object.variables_dict:
                data['all'] = {
                    'vars': self.object.variables_dict,
                }
        return Response(data)

class JobTemplateList(ListCreateAPIView):

    model = JobTemplate
    serializer_class = JobTemplateSerializer

    def _get_queryset(self):
        return self.request.user.get_queryset(self.model)

class JobTemplateDetail(RetrieveUpdateDestroyAPIView):

    model = JobTemplate
    serializer_class = JobTemplateSerializer

class JobTemplateCallback(generics.GenericAPIView):
    '''
    The job template callback allows for empheral hosts to launch a new job.
    
    Configure a host to POST to this resource, passing the `host_config_key`
    parameter, to start a new job limited to only the requesting host.  In the
    examples below, replace the `N` parameter with the `id` of the job template
    and the `HOST_CONFIG_KEY` with the `host_config_key` associated with the
    job template.

    For example, using curl:

        curl --data-urlencode host_config_key=HOST_CONFIG_KEY http://server/api/v1/job_templates/N/callback/

    Or using wget:

        wget -O /dev/null --post-data="host_config_key=HOST_CONFIG_KEY" http://server/api/v1/job_templates/N/callback/
        
    The response will return status 202 if the request is valid, 403 for an
    invalid host config key, or 400 if the host cannot be determined from the
    address making the request.
    
    A GET request may be used to verify that the correct host will be selected.
    This request must authenticate as a valid user with permission to edit the
    job template.  For example:
    
        curl http://user:password@server/api/v1/job_templates/N/callback/
    
    The response will include the host config key as well as the host name(s)
    that would match the request:
    
        {
            "host_config_key": "HOST_CONFIG_KEY",
            "matching_hosts": ["hostname"]
        }

    '''

    model = JobTemplate
    permission_classes = (JobTemplateCallbackPermission,)

    def find_matching_hosts(self):
        '''
        Find the host(s) in the job template's inventory that match the remote
        host for the current request.
        '''
        # Find the list of remote host names/IPs to check.
        remote_hosts = set()
        for header in settings.REMOTE_HOST_HEADERS:
            value = self.request.META.get(header, '').strip()
            if value:
                remote_hosts.add(value)
        # Add the reverse lookup of IP addresses.
        for rh in list(remote_hosts):
            try:
                result = socket.gethostbyaddr(rh)
            except socket.herror:
                continue
            remote_hosts.add(result[0])
            remote_hosts.update(result[1])
        # Filter out any .arpa results.
        for rh in list(remote_hosts):
            if rh.endswith('.arpa'):
                remote_hosts.remove(rh)
        if not remote_hosts:
            return set()
        # Find the host objects to search for a match.
        obj = self.get_object()
        qs = obj.inventory.hosts.filter(active=True)
        # First try for an exact match on the name.
        try:
            return set([qs.get(name__in=remote_hosts)])
        except (Host.DoesNotExist, Host.MultipleObjectsReturned):
            pass
        # Next, try matching based on name or ansible_ssh_host variable.
        matches = set()
        for host in qs:
            ansible_ssh_host = host.variables_dict.get('ansible_ssh_host', '')
            if ansible_ssh_host in remote_hosts:
                matches.add(host)
            # FIXME: Not entirely sure if this statement will ever be needed?
            if host.name != ansible_ssh_host and host.name in remote_hosts:
                matches.add(host)
        if len(matches) == 1:
            return matches
        # Try to resolve forward addresses for each host to find matches.
        for host in qs:
            hostnames = set([host.name])
            ansible_ssh_host = host.variables_dict.get('ansible_ssh_host', '')
            if ansible_ssh_host:
                hostnames.add(ansible_ssh_host)
            for hostname in hostnames:
                try:
                    result = socket.getaddrinfo(hostname, None)
                    possible_ips = set(x[4][0] for x in result)
                    possible_ips.discard(hostname)
                    if possible_ips and possible_ips & remote_hosts:
                        matches.add(host)
                except socket.gaierror:
                    pass
        # Return all matches found.
        return matches

    def get(self, request, *args, **kwargs):
        job_template = self.get_object()
        matching_hosts = self.find_matching_hosts()
        data = dict(
            host_config_key=job_template.host_config_key,
            matching_hosts=[x.name for x in matching_hosts],
        )
        if settings.DEBUG:
            d = dict([(k,v) for k,v in request.META.items()
                      if k.startswith('HTTP_') or k.startswith('REMOTE_')])
            data['request_meta'] = d
        return Response(data)

    def post(self, request, *args, **kwargs):
        job_template = self.get_object()
        # Permission class should have already validated host_config_key.
        matching_hosts = self.find_matching_hosts()
        if not matching_hosts:
            data = dict(msg='No matching host could be found!')
            # FIXME: Log!
            return Response(data, status=status.HTTP_400_BAD_REQUEST)
        elif len(matching_hosts) > 1:
            data = dict(msg='Multiple hosts matched the request!')
            # FIXME: Log!
            return Response(data, status=status.HTTP_400_BAD_REQUEST)
        else:
            host = list(matching_hosts)[0]
        if not job_template.can_start_without_user_input():
            data = dict(msg='Cannot start automatically, user input required!')
            # FIXME: Log!
            return Response(data, status=status.HTTP_400_BAD_REQUEST)
        limit = ':'.join(filter(None, [job_template.limit, host.name]))
        job = job_template.create_job(limit=limit, launch_type='callback')
        result = job.start()
        if not result:
            data = dict(msg='Error starting job!')
            return Response(data, status=status.HTTP_400_BAD_REQUEST)
        else:
            return Response(status=status.HTTP_202_ACCEPTED)

class JobTemplateJobsList(SubListCreateAPIView):

    model = Job
    serializer_class = JobSerializer
    parent_model = JobTemplate
    relationship = 'jobs'
    parent_key = 'job_template'

class JobList(ListCreateAPIView):

    model = Job
    serializer_class = JobSerializer

    def _get_queryset(self):
        return self.model.objects.all() # FIXME

class JobDetail(RetrieveUpdateDestroyAPIView):

    model = Job
    serializer_class = JobSerializer

    def update(self, request, *args, **kwargs):
        obj = self.get_object()
        # Only allow changes (PUT/PATCH) when job status is "new".
        if obj.status != 'new':
            return self.http_method_not_allowed(request, *args, **kwargs)
        return super(JobDetail, self).update(request, *args, **kwargs)

class JobStart(generics.GenericAPIView):

    model = Job

    def get(self, request, *args, **kwargs):
        obj = self.get_object()
        data = dict(
            can_start=obj.can_start,
        )
        if obj.can_start:
            data['passwords_needed_to_start'] = obj.get_passwords_needed_to_start()
        return Response(data)

    def post(self, request, *args, **kwargs):
        obj = self.get_object()
        if obj.can_start:
            result = obj.start(**request.DATA)
            if not result:
                data = dict(passwords_needed_to_start=obj.get_passwords_needed_to_start())
                return Response(data, status=status.HTTP_400_BAD_REQUEST)
            else:
                return Response(status=status.HTTP_202_ACCEPTED)
        else:
            return self.http_method_not_allowed(request, *args, **kwargs)

class JobCancel(generics.GenericAPIView):

    model = Job

    def get(self, request, *args, **kwargs):
        obj = self.get_object()
        data = dict(
            can_cancel=obj.can_cancel,
        )
        return Response(data)

    def post(self, request, *args, **kwargs):
        obj = self.get_object()
        if obj.can_cancel:
            result = obj.cancel()
            return Response(status=status.HTTP_202_ACCEPTED)
        else:
            return self.http_method_not_allowed(request, *args, **kwargs)

class BaseJobHostSummariesList(SubListAPIView):

    model = JobHostSummary
    serializer_class = JobHostSummarySerializer
    parent_model = None # Subclasses must define this attribute.
    relationship = 'job_host_summaries'
    parent_access = 'read'

    view_name = 'Job Host Summary List'

class HostJobHostSummariesList(BaseJobHostSummariesList):

    parent_model = Host

class GroupJobHostSummariesList(BaseJobHostSummariesList):

    parent_model = Group

class JobJobHostSummariesList(BaseJobHostSummariesList):

    parent_model = Job

class JobHostSummaryDetail(RetrieveAPIView):

    model = JobHostSummary
    serializer_class = JobHostSummarySerializer

class JobEventList(ListAPIView):

    model = JobEvent
    serializer_class = JobEventSerializer

class JobEventDetail(RetrieveAPIView):

    model = JobEvent
    serializer_class = JobEventSerializer

class JobEventChildrenList(SubListAPIView):

    model = JobEvent
    serializer_class = JobEventSerializer
    parent_model = JobEvent
    relationship = 'children'

    view_name = 'Job Event Children List'

class JobEventHostsList(SubListAPIView):

    model = Host
    serializer_class = HostSerializer
    parent_model = JobEvent
    relationship = 'hosts'

    view_name = 'Job Event Hosts List'

class BaseJobEventsList(SubListAPIView):

    model = JobEvent
    serializer_class = JobEventSerializer
    parent_model = None # Subclasses must define this attribute.
    relationship = 'job_events'
    parent_access = 'read'

class HostJobEventsList(BaseJobEventsList):

    parent_model = Host

class GroupJobEventsList(BaseJobEventsList):

    parent_model = Group

class JobJobEventsList(BaseJobEventsList):

    parent_model = Job
    authentication_classes = [JobTaskAuthentication] + \
                             api_settings.DEFAULT_AUTHENTICATION_CLASSES
    permission_classes = (JobTaskPermission,)
    
    # Post allowed for job event callback only.
    def post(self, request, *args, **kwargs):
        parent_obj = get_object_or_404(self.parent_model, pk=self.kwargs['pk'])
        data = request.DATA.copy()
        data['job'] = parent_obj.pk
        serializer = self.get_serializer(data=data)
        if serializer.is_valid():
            self.pre_save(serializer.object)
            self.object = serializer.save(force_insert=True)
            self.post_save(self.object, created=True)
            headers = {'Location': serializer.data['url']}
            return Response(serializer.data, status=status.HTTP_201_CREATED,
                            headers=headers)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# Create view functions for all of the class-based views to simplify inclusion
# in URL patterns and reverse URL lookups, converting CamelCase names to
# lowercase_with_underscore (e.g. MyView.as_view() becomes my_view).
this_module = sys.modules[__name__]
for attr, value in locals().items():
    if isinstance(value, type) and issubclass(value, APIView):
        name = camelcase_to_underscore(attr)
        view = value.as_view()
        setattr(this_module, name, view)
