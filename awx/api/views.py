# Copyright (c) 2014 AnsibleWorks, Inc.
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
from django.db.models import Q

from django.db import IntegrityError
from django.shortcuts import get_object_or_404
from django.utils.datastructures import SortedDict
from django.utils.timezone import now

# Django REST Framework
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.exceptions import PermissionDenied, ParseError
from rest_framework.parsers import YAMLParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.renderers import YAMLRenderer
from rest_framework.response import Response
from rest_framework.settings import api_settings
from rest_framework.views import exception_handler
from rest_framework import status

# Ansi2HTML
from ansi2html import Ansi2HTMLConverter
from ansi2html.style import SCHEME

# AWX
from awx.main.task_engine import TaskSerializer
from awx.main.models import *
from awx.main.utils import *
from awx.main.access import get_user_queryset
from awx.api.authentication import JobTaskAuthentication
from awx.api.permissions import *
from awx.api.renderers import *
from awx.api.serializers import *
from awx.api.generics import *
from awx.api.generics import get_view_name


def api_exception_handler(exc):
    '''
    Override default API exception handler to catch IntegrityError exceptions.
    '''
    if isinstance(exc, IntegrityError):
        exc = ParseError(exc.args[0])
    return exception_handler(exc)


class ApiRootView(APIView):

    permission_classes = (AllowAny,)
    view_name = 'REST API'

    def get(self, request, format=None):
        ''' list supported API versions '''

        current = reverse('api:api_v1_root_view', args=[])
        data = dict(
           description = 'Ansible Tower REST API',
           current_version = current,
           available_versions = dict(
              v1 = current
           )
        )
        return Response(data)

class ApiV1RootView(APIView):

    permission_classes = (AllowAny,)
    view_name = 'Version 1'

    def get(self, request, format=None):
        ''' list top level resources '''

        data = SortedDict()
        data['authtoken'] = reverse('api:auth_token_view')
        data['config'] = reverse('api:api_v1_config_view')
        data['me'] = reverse('api:user_me_list')
        data['dashboard'] = reverse('api:dashboard_view')
        data['organizations'] = reverse('api:organization_list')
        data['users'] = reverse('api:user_list')
        data['projects'] = reverse('api:project_list')
        data['teams'] = reverse('api:team_list')
        data['credentials'] = reverse('api:credential_list')
        data['inventory'] = reverse('api:inventory_list')
        data['inventory_sources'] = reverse('api:inventory_source_list')
        data['groups'] = reverse('api:group_list')
        data['hosts'] = reverse('api:host_list')
        data['job_templates'] = reverse('api:job_template_list')
        data['jobs'] = reverse('api:job_list')
        data['schedules'] = reverse('api:schedule_list')
        data['unified_job_templates'] = reverse('api:unified_job_template_list')
        data['unified_jobs'] = reverse('api:unified_job_list')
        data['activity_stream'] = reverse('api:activity_stream_list')
        return Response(data)

class ApiV1ConfigView(APIView):

    permission_classes = (IsAuthenticated,)
    view_name = 'Configuration'

    def get(self, request, format=None):
        '''Return various sitewide configuration settings.'''

        license_reader = TaskSerializer()
        license_data   = license_reader.from_file()

        data = dict(
            time_zone=settings.TIME_ZONE,
            license_info=license_data,
            version=get_awx_version(),
            ansible_version=get_ansible_version(),
        )

        # If LDAP is enabled, user_ldap_fields will return a list of field
        # names that are managed by LDAP and should be read-only for users with
        # a non-empty ldap_dn attribute.
        if getattr(settings, 'AUTH_LDAP_SERVER_URI', None):
            user_ldap_fields = ['username', 'password']
            user_ldap_fields.extend(getattr(settings, 'AUTH_LDAP_USER_ATTR_MAP', {}).keys())
            user_ldap_fields.extend(getattr(settings, 'AUTH_LDAP_USER_FLAGS_BY_GROUP', {}).keys())
            data['user_ldap_fields'] = user_ldap_fields

        if request.user.is_superuser or request.user.admin_of_organizations.filter(active=True).count():
            data.update(dict(
                project_base_dir = settings.PROJECTS_ROOT,
                project_local_paths = Project.get_local_path_choices(),
            ))

        return Response(data)

class DashboardView(APIView):

    view_name = "Dashboard"
    new_in_14 = True

    def get(self, request, format=None):
        ''' Show Dashboard Details '''

        data = SortedDict()
        user_inventory = get_user_queryset(request.user, Inventory)
        inventory_with_failed_hosts = user_inventory.filter(hosts_with_active_failures__gt=0)
        user_inventory_external = user_inventory.filter(has_inventory_sources=True)
        failed_inventory = sum(i.inventory_sources_with_failures for i in user_inventory)
        data['inventories'] = {'url': reverse('api:inventory_list'),
                               'total': user_inventory.count(),
                               'total_with_inventory_source': user_inventory_external.count(),
                               'job_failed': inventory_with_failed_hosts.count(),
                               'inventory_failed': failed_inventory}
        user_inventory_sources = get_user_queryset(request.user, InventorySource)
        rax_inventory_sources = user_inventory_sources.filter(source='rax')
        rax_inventory_failed = rax_inventory_sources.filter(status='failed')
        ec2_inventory_sources = user_inventory_sources.filter(source='ec2')
        ec2_inventory_failed = ec2_inventory_sources.filter(status='failed')
        data['inventory_sources'] = {}
        data['inventory_sources']['rax'] = {'url': reverse('api:inventory_source_list') + "?source=rax",
                                            'label': 'Rackspace',
                                            'failures_url': reverse('api:inventory_source_list') + "?source=rax&status=failed",
                                            'total': rax_inventory_sources.count(),
                                            'failed': rax_inventory_failed.count()}
        data['inventory_sources']['ec2'] = {'url': reverse('api:inventory_source_list') + "?source=ec2",
                                            'failures_url': reverse('api:inventory_source_list') + "?source=ec2&status=failed",
                                            'label': 'Amazon EC2',
                                            'total': ec2_inventory_sources.count(),
                                            'failed': ec2_inventory_failed.count()}

        user_groups = get_user_queryset(request.user, Group)
        groups_job_failed = (Group.objects.filter(hosts_with_active_failures__gt=0) | Group.objects.filter(groups_with_active_failures__gt=0)).count()
        groups_inventory_failed = Group.objects.filter(inventory_sources__last_job_failed=True).count()
        data['groups'] = {'url': reverse('api:group_list'),
                          'failures_url': reverse('api:group_list') + "?has_active_failures=True",
                          'total': user_groups.count(),
                          'job_failed': groups_job_failed,
                          'inventory_failed': groups_inventory_failed}

        user_hosts = get_user_queryset(request.user, Host)
        user_hosts_failed = user_hosts.filter(has_active_failures=True)
        data['hosts'] = {'url': reverse('api:host_list'),
                         'failures_url': reverse('api:host_list') + "?has_active_failures=True",
                         'total': user_hosts.count(),
                         'failed': user_hosts_failed.count()}

        user_projects = get_user_queryset(request.user, Project)
        user_projects_failed = user_projects.filter(last_job_failed=True)
        data['projects'] = {'url': reverse('api:project_list'),
                            'failures_url': reverse('api:project_list') + "?last_job_failed=True",
                            'total': user_projects.count(),
                            'failed': user_projects_failed.count()}

        git_projects = user_projects.filter(scm_type='git')
        git_failed_projects = git_projects.filter(last_job_failed=True)
        svn_projects = user_projects.filter(scm_type='svn')
        svn_failed_projects = svn_projects.filter(last_job_failed=True)
        hg_projects = user_projects.filter(scm_type='hg')
        hg_failed_projects = hg_projects.filter(last_job_failed=True)
        data['scm_types'] = {}
        data['scm_types']['git'] = {'url': reverse('api:project_list') + "?scm_type=git",
                                    'label': 'Git',
                                    'failures_url': reverse('api:project_list') + "?scm_type=git&last_job_failed=True",
                                    'total': git_projects.count(),
                                    'failed': git_failed_projects.count()}
        data['scm_types']['svn'] = {'url': reverse('api:project_list') + "?scm_type=svn",
                                    'label': 'Subversion',
                                    'failures_url': reverse('api:project_list') + "?scm_type=svn&last_job_failed=True",
                                    'total': svn_projects.count(),
                                    'failed': svn_failed_projects.count()}
        data['scm_types']['hg'] = {'url': reverse('api:project_list') + "?scm_type=hg",
                                   'label': 'Mercurial',
                                   'failures_url': reverse('api:project_list') + "?scm_type=hg&last_job_failed=True",
                                   'total': hg_projects.count(),
                                   'failed': hg_failed_projects.count()}

        user_jobs = get_user_queryset(request.user, Job)
        user_failed_jobs = user_jobs.filter(failed=True)
        data['jobs'] = {'url': reverse('api:job_list'),
                        'failure_url': reverse('api:job_list') + "?failed=True",
                        'total': user_jobs.count(),
                        'failed': user_failed_jobs.count()}

        user_list = get_user_queryset(request.user, User)
        team_list = get_user_queryset(request.user, Team)
        credential_list = get_user_queryset(request.user, Credential)
        job_template_list = get_user_queryset(request.user, JobTemplate)
        organization_list = get_user_queryset(request.user, Organization)
        data['users'] = {'url': reverse('api:user_list'),
                         'total': user_list.count()}
        data['organizations'] = {'url': reverse('api:organization_list'),
                                 'total': organization_list.count()}
        data['teams'] = {'url': reverse('api:team_list'),
                        'total': team_list.count()}
        data['credentials'] = {'url': reverse('api:credential_list'),
                               'total': credential_list.count()}
        data['job_templates'] = {'url': reverse('api:job_template_list'),
                                 'total': job_template_list.count()}
        return Response(data)

class ScheduleList(ListAPIView):

    view_name = "Schedules"
    model = Schedule
    serializer_class = ScheduleSerializer
    new_in_148 = True

class ScheduleDetail(RetrieveUpdateDestroyAPIView):

    model = Schedule
    serializer_class = ScheduleSerializer
    new_in_148 = True

class ScheduleUnifiedJobsList(SubListAPIView):

    model = UnifiedJob
    serializer_class = UnifiedJobSerializer
    parent_model = Schedule
    relationship = 'unifiedjob_set'
    view_name = 'Schedule Jobs List'

class AuthTokenView(APIView):

    authentication_classes = []
    permission_classes = (AllowAny,)
    serializer_class = AuthTokenSerializer
    model = AuthToken

    def post(self, request):
        serializer = self.serializer_class(data=request.DATA)
        if serializer.is_valid():
            request_hash = AuthToken.get_request_hash(self.request)
            try:
                token = AuthToken.objects.filter(user=serializer.object['user'],
                                                 request_hash=request_hash,
                                                 expires__gt=now())[0]
                token.refresh()
            except IndexError:
                token = AuthToken.objects.create(user=serializer.object['user'],
                                                 request_hash=request_hash)
            return Response({'token': token.key, 'expires': token.expires})
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

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

class OrganizationActivityStreamList(SubListAPIView):

    model = ActivityStream
    serializer_class = ActivityStreamSerializer
    parent_model = Organization
    relationship = 'activitystream_set'
    new_in_145 = True

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
        # FIXME: Default get_queryset should handle this.
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

class TeamActivityStreamList(SubListAPIView):

    model = ActivityStream
    serializer_class = ActivityStreamSerializer
    parent_model = Team
    relationship = 'activitystream_set'
    new_in_145 = True

    def get_queryset(self):
        parent = self.get_parent_object()
        self.check_parent_access(parent)
        qs = self.request.user.get_queryset(self.model)
        return qs.filter(Q(team=parent) |
                         Q(project__in=parent.projects.all()) |
                         Q(credential__in=parent.credentials.all()) |
                         Q(permission__in=parent.permissions.all()))


class ProjectList(ListCreateAPIView):

    model = Project
    serializer_class = ProjectSerializer

    def get(self, request, *args, **kwargs):
        # Not optimal, but make sure the project status and last_updated fields
        # are up to date here...
        projects_qs = Project.objects.filter(active=True)
        projects_qs = projects_qs.select_related('current_update', 'last_updated')
        for project in projects_qs:
            project._set_status_and_last_job_run()
        return super(ProjectList, self).get(request, *args, **kwargs)

class ProjectDetail(RetrieveUpdateDestroyAPIView):

    model = Project
    serializer_class = ProjectSerializer

class ProjectPlaybooks(RetrieveAPIView):

    model = Project
    serializer_class = ProjectPlaybooksSerializer

class ProjectOrganizationsList(SubListCreateAPIView):

    model = Organization
    serializer_class = OrganizationSerializer
    parent_model = Project
    relationship = 'organizations'

class ProjectTeamsList(SubListCreateAPIView):

    model = Team
    serializer_class = TeamSerializer
    parent_model = Project
    relationship = 'teams'

class ProjectSchedulesList(SubListCreateAPIView):

    view_name = "Project Schedules"

    model = Schedule
    serializer_class = ScheduleSerializer
    parent_model = Project
    relationship = 'schedules'
    parent_key = 'unified_job_template'
    new_in_148 = True

class ProjectActivityStreamList(SubListAPIView):

    model = ActivityStream
    serializer_class = ActivityStreamSerializer
    parent_model = Project
    relationship = 'activitystream_set'
    new_in_145 = True

    def get_queryset(self):
        parent = self.get_parent_object()
        self.check_parent_access(parent)
        qs = self.request.user.get_queryset(self.model)
        return qs.filter(Q(project=parent) | Q(credential__in=parent.credential))


class ProjectUpdatesList(SubListAPIView):

    model = ProjectUpdate
    serializer_class = ProjectUpdateSerializer
    parent_model = Project
    relationship = 'project_updates'
    new_in_13 = True

class ProjectUpdateView(GenericAPIView):

    model = Project
    new_in_13 = True

    def get(self, request, *args, **kwargs):
        obj = self.get_object()
        data = dict(
            can_update=obj.can_update,
        )
        return Response(data)

    def post(self, request, *args, **kwargs):
        obj = self.get_object()
        if obj.can_update:
            project_update = obj.update()
            if not project_update:
                return Response({}, status=status.HTTP_400_BAD_REQUEST)
            else:
                headers = {'Location': project_update.get_absolute_url()}
                return Response(dict(project_update=project_update.id), status=status.HTTP_202_ACCEPTED, headers=headers)
        else:
            return self.http_method_not_allowed(request, *args, **kwargs)

class ProjectUpdateDetail(RetrieveDestroyAPIView):

    model = ProjectUpdate
    serializer_class = ProjectUpdateSerializer
    new_in_13 = True

class ProjectUpdateCancel(GenericAPIView):

    model = ProjectUpdate
    is_job_cancel = True
    new_in_13 = True

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

class UserList(ListCreateAPIView):

    model = User
    serializer_class = UserSerializer

class UserMeList(ListAPIView):

    model = User
    serializer_class = UserSerializer
    view_name = 'Me'

    def get_queryset(self):
        return self.model.objects.filter(pk=self.request.user.pk)

class UserTeamsList(SubListAPIView):

    model = Team
    serializer_class = TeamSerializer
    parent_model = User
    relationship = 'teams'

class UserPermissionsList(SubListCreateAPIView):

    model = Permission
    serializer_class = PermissionSerializer
    parent_model = User
    relationship = 'permissions'
    parent_key = 'user'

class UserProjectsList(SubListAPIView):

    model = Project
    serializer_class = ProjectSerializer
    parent_model = User
    relationship = 'projects'

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

class UserOrganizationsList(SubListAPIView):

    model = Organization
    serializer_class = OrganizationSerializer
    parent_model = User
    relationship = 'organizations'

class UserAdminOfOrganizationsList(SubListAPIView):

    model = Organization
    serializer_class = OrganizationSerializer
    parent_model = User
    relationship = 'admin_of_organizations'

class UserActivityStreamList(SubListAPIView):

    model = ActivityStream
    serializer_class = ActivityStreamSerializer
    parent_model = User
    relationship = 'activitystream_set'
    new_in_145 = True

    def get_queryset(self):
        parent = self.get_parent_object()
        self.check_parent_access(parent)
        qs = self.request.user.get_queryset(self.model)
        return qs.filter(Q(actor=parent) | Q(user__in=[parent]))


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

class CredentialList(ListCreateAPIView):

    model = Credential
    serializer_class = CredentialSerializer

class CredentialDetail(RetrieveUpdateDestroyAPIView):

    model = Credential
    serializer_class = CredentialSerializer

class CredentialActivityStreamList(SubListAPIView):

    model = ActivityStream
    serializer_class = ActivityStreamSerializer
    parent_model = Credential
    relationship = 'activitystream_set'
    new_in_145 = True

class PermissionDetail(RetrieveUpdateDestroyAPIView):

    model = Permission
    serializer_class = PermissionSerializer

class InventoryList(ListCreateAPIView):

    model = Inventory
    serializer_class = InventorySerializer

class InventoryDetail(RetrieveUpdateDestroyAPIView):

    model = Inventory
    serializer_class = InventorySerializer

    def destroy(self, request, *args, **kwargs):
        with ignore_inventory_computed_fields():
            with ignore_inventory_group_removal():
                return super(InventoryDetail, self).destroy(request, *args, **kwargs)

class InventoryActivityStreamList(SubListAPIView):

    model = ActivityStream
    serializer_class = ActivityStreamSerializer
    parent_model = Inventory
    relationship = 'activitystream_set'
    new_in_145 = True

    def get_queryset(self):
        parent = self.get_parent_object()
        self.check_parent_access(parent)
        qs = self.request.user.get_queryset(self.model)
        return qs.filter(Q(inventory=parent) | Q(host__in=parent.hosts.all()) | Q(group__in=parent.groups.all()))


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
    parent_key = 'inventory'

class HostGroupsList(SubListCreateAPIView):
    ''' the list of groups a host is directly a member of '''

    model = Group
    serializer_class = GroupSerializer
    parent_model = Host
    relationship = 'groups'

class HostAllGroupsList(SubListAPIView):
    ''' the list of all groups of which the host is directly or indirectly a member '''

    model = Group
    serializer_class = GroupSerializer
    parent_model = Host
    relationship = 'groups'

    def get_queryset(self):
        parent = self.get_parent_object()
        self.check_parent_access(parent)
        qs = self.request.user.get_queryset(self.model)
        sublist_qs = parent.all_groups.distinct()
        return qs & sublist_qs

class HostInventorySourcesList(SubListAPIView):

    model = InventorySource
    serializer_class = InventorySourceSerializer
    parent_model = Host
    relationship = 'inventory_sources'
    new_in_148 = True

class HostActivityStreamList(SubListAPIView):

    model = ActivityStream
    serializer_class = ActivityStreamSerializer
    parent_model = Host
    relationship = 'activitystream_set'
    new_in_145 = True

    def get_queryset(self):
        parent = self.get_parent_object()
        self.check_parent_access(parent)
        qs = self.request.user.get_queryset(self.model)
        return qs.filter(Q(host=parent) | Q(inventory=parent.inventory))


class GroupList(ListCreateAPIView):

    model = Group
    serializer_class = GroupSerializer

class GroupChildrenList(SubListCreateAPIView):

    model = Group
    serializer_class = GroupSerializer
    parent_model = Group
    relationship = 'children'

    def _unattach(self, request, *args, **kwargs): # FIXME: Disabled for now for UI support.
        '''
        Special case for disassociating a child group from the parent. If the
        child group has no more parents, then automatically mark it inactive.
        '''
        sub_id = request.DATA.get('id', None)
        if not sub_id:
            data = dict(msg='"id" is required to disassociate')
            return Response(data, status=status.HTTP_400_BAD_REQUEST)

        parent = self.get_parent_object()
        parent_key = getattr(self, 'parent_key', None)
        relationship = getattr(parent, self.relationship)
        sub = get_object_or_400(self.model, pk=sub_id)

        if not request.user.can_access(self.parent_model, 'unattach', parent,
                                       sub, self.relationship):
            raise PermissionDenied()

        if sub.parents.filter(active=True).exclude(pk=parent.pk).count() == 0:
            sub.mark_inactive()
        else:
            relationship.remove(sub)

        return Response(status=status.HTTP_204_NO_CONTENT)

class GroupChildrenRemove(DestroyAPIView):

    model = Group
    serializer_class = GroupSerializer
    view_name = 'Remove a subgroup recursively'

    def destroy(self, request, *args, **kwargs):
        parent_group = self.get_object()
        group = Group.objects.get(id=kwargs['subgroup_pk'])
        group.mark_inactive_recursive(parent_group)
        return Response()        

class GroupPotentialChildrenList(SubListAPIView):

    model = Group
    serializer_class = GroupSerializer
    parent_model = Group
    new_in_14 = True

    def get_queryset(self):
        parent = self.get_parent_object()
        self.check_parent_access(parent)
        qs = self.request.user.get_queryset(self.model)
        qs = qs.filter(inventory__pk=parent.inventory.pk)
        except_pks = set([parent.pk])
        except_pks.update(parent.all_parents.values_list('pk', flat=True))
        except_pks.update(parent.all_children.values_list('pk', flat=True))
        return qs.exclude(pk__in=except_pks)

class GroupHostsList(SubListCreateAPIView):
    ''' the list of hosts directly below a group '''

    model = Host
    serializer_class = HostSerializer
    parent_model = Group
    relationship = 'hosts'

class GroupAllHostsList(SubListAPIView):
    ''' the list of all hosts below a group, even including subgroups '''

    model = Host
    serializer_class = HostSerializer
    parent_model = Group
    relationship = 'hosts'

    def get_queryset(self):
        parent = self.get_parent_object()
        self.check_parent_access(parent)
        qs = self.request.user.get_queryset(self.model)
        sublist_qs = parent.all_hosts.distinct()
        return qs & sublist_qs

class GroupInventorySourcesList(SubListAPIView):

    model = InventorySource
    serializer_class = InventorySourceSerializer
    parent_model = Group
    relationship = 'inventory_sources'
    new_in_148 = True

class GroupActivityStreamList(SubListAPIView):

    model = ActivityStream
    serializer_class = ActivityStreamSerializer
    parent_model = Group
    relationship = 'activitystream_set'
    new_in_145 = True

    def get_queryset(self):
        parent = self.get_parent_object()
        self.check_parent_access(parent)
        qs = self.request.user.get_queryset(self.model)
        return qs.filter(Q(group=parent) | Q(host__in=parent.hosts.all()))

class GroupDetail(RetrieveUpdateDestroyAPIView):

    model = Group
    serializer_class = GroupSerializer

class InventoryGroupsList(SubListCreateAPIView):

    model = Group
    serializer_class = GroupSerializer
    parent_model = Inventory
    relationship = 'groups'
    parent_key = 'inventory'

class InventoryRootGroupRemove(DestroyAPIView):

    model = Group
    serializer_class = GroupSerializer
    view_name = 'Inventory Group Subgroup'

    def destroy(self, request, *args, **kwargs):
        group = Group.objects.get(id=kwargs['group_pk'])
        group.mark_inactive_recursive()
        return Response()        

class InventoryRootGroupsList(SubListCreateAPIView):

    model = Group
    serializer_class = GroupSerializer
    parent_model = Inventory
    relationship = 'groups'
    parent_key = 'inventory'

    def get_queryset(self):
        parent = self.get_parent_object()
        self.check_parent_access(parent)
        qs = self.request.user.get_queryset(self.model)
        return qs & parent.root_groups

class BaseVariableData(RetrieveUpdateAPIView):

    parser_classes = api_settings.DEFAULT_PARSER_CLASSES + [YAMLParser]
    renderer_classes = api_settings.DEFAULT_RENDERER_CLASSES + [YAMLRenderer]
    is_variable_data = True # Special flag for permissions check.
    
class InventoryVariableData(BaseVariableData):

    model = Inventory
    serializer_class = InventoryVariableDataSerializer

class HostVariableData(BaseVariableData):

    model = Host
    serializer_class = HostVariableDataSerializer

class GroupVariableData(BaseVariableData):

    model = Group
    serializer_class = GroupVariableDataSerializer

class InventoryScriptView(RetrieveAPIView):

    model = Inventory
    authentication_classes = [JobTaskAuthentication] + \
                             api_settings.DEFAULT_AUTHENTICATION_CLASSES
    permission_classes = (JobTaskPermission,)
    filter_backends = ()

    def retrieve(self, request, *args, **kwargs):
        self.object = self.get_object()
        hostname = request.QUERY_PARAMS.get('host', '')
        hostvars = bool(request.QUERY_PARAMS.get('hostvars', ''))
        show_all = bool(request.QUERY_PARAMS.get('all', ''))
        if show_all:
            hosts_q = dict(active=True)
        else:
            hosts_q = dict(active=True, enabled=True)
        if hostname:
            host = get_object_or_404(self.object.hosts, name=hostname, **hosts_q)
            data = host.variables_dict
        else:
            data = SortedDict()
            if self.object.variables_dict:
                data['all'] = SortedDict()
                data['all']['vars'] = self.object.variables_dict

            for group in self.object.groups.filter(active=True):
                hosts = group.hosts.filter(**hosts_q)
                children = group.children.filter(active=True)
                group_info = SortedDict()
                group_info['hosts'] = list(hosts.values_list('name', flat=True))
                group_info['children'] = list(children.values_list('name', flat=True))
                group_info['vars'] = group.variables_dict
                data[group.name] = group_info

            if hostvars:
                data.setdefault('_meta', SortedDict())
                data['_meta'].setdefault('hostvars', SortedDict())
                for host in self.object.hosts.filter(**hosts_q):
                    data['_meta']['hostvars'][host.name] = host.variables_dict

            # workaround for Ansible inventory bug (github #3687), localhost
            # must be explicitly listed in the all group for dynamic inventory
            # scripts to pick it up.
            localhost_names = ('localhost', '127.0.0.1', '::1')
            localhosts_qs = self.object.hosts.filter(name__in=localhost_names,
                                                     **hosts_q)
            localhosts = list(localhosts_qs.values_list('name', flat=True))
            if localhosts:
                data.setdefault('all', SortedDict())
                data['all']['hosts'] = localhosts

        return Response(data)

class InventoryTreeView(RetrieveAPIView):

    model = Inventory
    filter_backends = ()
    new_in_13 = True

    def retrieve(self, request, *args, **kwargs):
        inventory = self.get_object()
        groups_qs = inventory.root_groups.filter(active=True)
        groups_qs = groups_qs.select_related('inventory')
        groups_qs = groups_qs.prefetch_related('inventory_source')
        data = GroupTreeSerializer(groups_qs, many=True).data
        return Response(data)

    def get_description_context(self):
        d = super(InventoryTreeView, self).get_description_context()
        d.update({
            'serializer_fields': GroupTreeSerializer().metadata(),
        })
        return d

class InventoryInventorySourcesList(SubListAPIView):

    model = InventorySource
    serializer_class = InventorySourceSerializer
    parent_model = Inventory
    relationship = None # Not defined since using get_queryset().
    view_name = 'Inventory Source List'
    new_in_14 = True

    def get_queryset(self):
        parent = self.get_parent_object()
        self.check_parent_access(parent)
        qs = self.request.user.get_queryset(self.model)
        return qs.filter(Q(inventory__pk=parent.pk) |
                         Q(group__inventory__pk=parent.pk))

class InventorySourceList(ListAPIView):

     model = InventorySource
     serializer_class = InventorySourceSerializer
     new_in_14 = True

class InventorySourceDetail(RetrieveUpdateAPIView):

    model = InventorySource
    serializer_class = InventorySourceSerializer
    new_in_14 = True

class InventorySourceSchedulesList(SubListCreateAPIView):

    view_name = "Inventory Source Schedules"

    model = Schedule
    serializer_class = ScheduleSerializer
    parent_model = InventorySource
    relationship = 'schedules'
    parent_key = 'unified_job_template'
    new_in_148 = True

class InventorySourceActivityStreamList(SubListAPIView):

    model = ActivityStream
    serializer_class = ActivityStreamSerializer
    parent_model = InventorySource
    relationship = 'activitystream_set'
    new_in_145 = True

class InventorySourceHostsList(SubListAPIView):

    model = Host
    serializer_class = HostSerializer
    parent_model = InventorySource
    relationship = 'hosts'
    new_in_148 = True

class InventorySourceGroupsList(SubListAPIView):

    model = Group
    serializer_class = GroupSerializer
    parent_model = InventorySource
    relationship = 'groups'
    new_in_148 = True

class InventorySourceUpdatesList(SubListAPIView):

    model = InventoryUpdate
    serializer_class = InventoryUpdateSerializer
    parent_model = InventorySource
    relationship = 'inventory_updates'
    new_in_14 = True

class InventorySourceUpdateView(GenericAPIView):

    model = InventorySource
    is_job_start = True
    new_in_14 = True

    def get(self, request, *args, **kwargs):
        obj = self.get_object()
        data = dict(
            can_update=obj.can_update,
        )
        return Response(data)

    def post(self, request, *args, **kwargs):
        obj = self.get_object()
        if obj.can_update:
            inventory_update = obj.update()
            if not inventory_update:
                return Response({}, status=status.HTTP_400_BAD_REQUEST)
            else:
                headers = {'Location': inventory_update.get_absolute_url()}
                return Response(dict(inventory_update=inventory_update.id), status=status.HTTP_202_ACCEPTED, headers=headers)
        else:
            return self.http_method_not_allowed(request, *args, **kwargs)

class InventoryUpdateDetail(RetrieveDestroyAPIView):

    model = InventoryUpdate
    serializer_class = InventoryUpdateSerializer
    new_in_14 = True

class InventoryUpdateCancel(GenericAPIView):

    model = InventoryUpdate
    is_job_cancel = True
    new_in_14 = True

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

class JobTemplateList(ListCreateAPIView):

    model = JobTemplate
    serializer_class = JobTemplateSerializer

class JobTemplateDetail(RetrieveUpdateDestroyAPIView):

    model = JobTemplate
    serializer_class = JobTemplateSerializer

class JobTemplateSchedulesList(SubListCreateAPIView):

    view_name = "Job Template Schedules"

    model = Schedule
    serializer_class = ScheduleSerializer
    parent_model = JobTemplate
    relationship = 'schedules'
    parent_key = 'unified_job_template'
    new_in_148 = True

class JobTemplateActivityStreamList(SubListAPIView):

    model = ActivityStream
    serializer_class = ActivityStreamSerializer
    parent_model = JobTemplate
    relationship = 'activitystream_set'
    new_in_145 = True

class JobTemplateCallback(GenericAPIView):

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
        limit = ':&'.join(filter(None, [job_template.limit, host.name]))
        job = job_template.create_job(limit=limit, launch_type='callback')
        result = job.signal_start()
        if not result:
            data = dict(msg='Error starting job!')
            return Response(data, status=status.HTTP_400_BAD_REQUEST)
        else:
            headers = {'Location': job.get_absolute_url()}
            return Response(status=status.HTTP_202_ACCEPTED, headers=headers)

class JobTemplateJobsList(SubListCreateAPIView):

    model = Job
    serializer_class = JobListSerializer
    parent_model = JobTemplate
    relationship = 'jobs'
    parent_key = 'job_template'

class JobList(ListCreateAPIView):

    model = Job
    serializer_class = JobListSerializer

class JobDetail(RetrieveUpdateDestroyAPIView):

    model = Job
    serializer_class = JobSerializer

    def update(self, request, *args, **kwargs):
        obj = self.get_object()
        # Only allow changes (PUT/PATCH) when job status is "new".
        if obj.status != 'new':
            return self.http_method_not_allowed(request, *args, **kwargs)
        return super(JobDetail, self).update(request, *args, **kwargs)

class JobActivityStreamList(SubListAPIView):

    model = ActivityStream
    serializer_class = ActivityStreamSerializer
    parent_model = Job
    relationship = 'activitystream_set'
    new_in_145 = True

class JobStart(GenericAPIView):

    model = Job
    is_job_start = True

    def get(self, request, *args, **kwargs):
        obj = self.get_object()
        data = dict(
            can_start=obj.can_start,
        )
        if obj.can_start:
            data['passwords_needed_to_start'] = obj.passwords_needed_to_start
        return Response(data)

    def post(self, request, *args, **kwargs):
        obj = self.get_object()
        if obj.can_start:
            result = obj.signal_start(**request.DATA)
            if not result:
                data = dict(passwords_needed_to_start=obj.passwords_needed_to_start)
                return Response(data, status=status.HTTP_400_BAD_REQUEST)
            else:
                return Response(status=status.HTTP_202_ACCEPTED)
        else:
            return self.http_method_not_allowed(request, *args, **kwargs)

class JobCancel(GenericAPIView):

    model = Job
    is_job_cancel = True

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
    view_name = 'Job Host Summaries List'

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
    view_name = 'Job Events List'

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

class UnifiedJobTemplateList(ListAPIView):

    model = UnifiedJobTemplate
    serializer_class = UnifiedJobTemplateSerializer
    new_in_148 = True

class UnifiedJobList(ListAPIView):

    model = UnifiedJob
    serializer_class = UnifiedJobListSerializer
    new_in_148 = True

class UnifiedJobStdout(RetrieveAPIView):
    
    serializer_class = UnifiedJobStdoutSerializer
    renderer_classes = [BrowsableAPIRenderer, renderers.StaticHTMLRenderer,
                        PlainTextRenderer, AnsiTextRenderer,
                        renderers.JSONRenderer]
    filter_backends = ()
    new_in_148 = True

    def retrieve(self, request, *args, **kwargs):
        unified_job = self.get_object()
        if request.accepted_renderer.format in ('html', 'api'):
            scheme = request.QUERY_PARAMS.get('scheme', None)
            if scheme not in SCHEME:
                scheme = 'ansi2html'
            dark_val = request.QUERY_PARAMS.get('dark', '')
            dark = bool(dark_val and dark_val[0].lower() in ('1', 't', 'y'))
            content_only = bool(request.accepted_renderer.format == 'api')
            dark_bg = (content_only and dark) or (not content_only and (dark or not dark_val))
            conv = Ansi2HTMLConverter(scheme=scheme, dark_bg=dark_bg,
                                      title=get_view_name(self.__class__))
            if content_only:
                headers = conv.produce_headers()
                body = conv.convert(unified_job.result_stdout_raw, full=False)
                data = '\n'.join([headers, body])
                data = '<div class="nocode body_foreground body_background">%s</div>' % data
            else:
                data = conv.convert(unified_job.result_stdout_raw)
            # Fix ugly grey background used by default.
            data = data.replace('.body_background { background-color: #AAAAAA; }',
                                '.body_background { background-color: #f5f5f5; }')
            return Response(data)
        elif request.accepted_renderer.format == 'ansi':
            return Response(unified_job.result_stdout_raw)
        else:
            return super(UnifiedJobStdout, self).retrieve(request, *args, **kwargs)

class ProjectUpdateStdout(UnifiedJobStdout):

    model = ProjectUpdate

class InventoryUpdateStdout(UnifiedJobStdout):

    model = InventoryUpdate

class JobStdout(UnifiedJobStdout):

    model = Job

class ActivityStreamList(SimpleListAPIView):

    model = ActivityStream
    serializer_class = ActivityStreamSerializer
    new_in_145 = True

class ActivityStreamDetail(RetrieveAPIView):

    model = ActivityStream
    serializer_class = ActivityStreamSerializer
    new_in_145 = True

# Create view functions for all of the class-based views to simplify inclusion
# in URL patterns and reverse URL lookups, converting CamelCase names to
# lowercase_with_underscore (e.g. MyView.as_view() becomes my_view).
this_module = sys.modules[__name__]
for attr, value in locals().items():
    if isinstance(value, type) and issubclass(value, APIView):
        name = camelcase_to_underscore(attr)
        view = value.as_view()
        setattr(this_module, name, view)
