# Copyright (c) 2013 AnsibleWorks, Inc.
# All Rights Reserved.

import datetime
import json
import os
import tempfile

from django.conf import settings
from django.contrib.auth.models import User
import django.test
from django.test.client import Client
from django.core.urlresolvers import reverse

from awx.main.models import *
from awx.main.tests.base import BaseTest

TEST_PLAYBOOK = '''- hosts: mygroup
  gather_facts: false
  tasks:
  - name: woohoo
    command: test 1 = 1
'''

class ProjectsTest(BaseTest):

    # tests for users, projects, and teams

    def collection(self):
        return reverse('main:project_list')

    def setUp(self):
        super(ProjectsTest, self).setUp()
        self.setup_users()

        self.organizations = self.make_organizations(self.super_django_user, 10)
        self.projects      = self.make_projects(self.normal_django_user, 10, TEST_PLAYBOOK)

        # add projects to organizations in a more or less arbitrary way
        for project in self.projects[0:2]:
            self.organizations[0].projects.add(project)
        for project in self.projects[3:8]:
            self.organizations[1].projects.add(project)
        for project in self.projects[9:10]:
            self.organizations[2].projects.add(project)
        self.organizations[0].projects.add(self.projects[-1])
        self.organizations[9].projects.add(self.projects[-2])

        # get the URL for various organization records
        self.a_detail_url  = "%s%s" % (self.collection(), self.organizations[0].pk)
        self.b_detail_url  = "%s%s" % (self.collection(), self.organizations[1].pk)
        self.c_detail_url  = "%s%s" % (self.collection(), self.organizations[2].pk)

        # configuration:
        #   admin_user is an admin and regular user in all organizations
        #   other_user is all organizations
        #   normal_user is a user in organization 0, and an admin of organization 1

        for x in self.organizations:
            # NOTE: superuser does not have to be explicitly added to admin group
            # x.admins.add(self.super_django_user)
            x.users.add(self.super_django_user)

        self.organizations[0].users.add(self.normal_django_user)
        self.organizations[1].admins.add(self.normal_django_user)

        self.team1 = Team.objects.create(
            name = 'team1', organization = self.organizations[0]
        )

        self.team2 = Team.objects.create(
            name = 'team2', organization = self.organizations[0]
        )

        # create some teams in the first org
        self.team1.projects.add(self.projects[0])
        self.team2.projects.add(self.projects[1])
        self.team2.projects.add(self.projects[2])
        self.team2.projects.add(self.projects[3])
        self.team2.projects.add(self.projects[4])
        self.team2.projects.add(self.projects[5])
        self.team1.save()
        self.team2.save()
        self.team1.users.add(self.normal_django_user)
        self.team2.users.add(self.other_django_user)

    def test_playbooks(self):
        def write_test_file(project, name, content):
            full_path = os.path.join(project.get_project_path(), name)
            if not os.path.exists(os.path.dirname(full_path)):
                os.makedirs(os.path.dirname(full_path))
            f = file(full_path, 'wb')
            f.write(content)
            f.close()
        # Invalid local_path
        project = self.projects[0]
        project.local_path = 'path_does_not_exist'
        project.save()
        self.assertFalse(project.get_project_path())
        self.assertEqual(len(project.playbooks), 0)
        # Simple playbook
        project = self.projects[1]
        self.assertEqual(len(project.playbooks), 1)
        write_test_file(project, 'foo.yml', TEST_PLAYBOOK)
        self.assertEqual(len(project.playbooks), 2)
        # Other files
        project = self.projects[2]
        self.assertEqual(len(project.playbooks), 1)
        write_test_file(project, 'foo.txt', 'not a playbook')
        self.assertEqual(len(project.playbooks), 1)
        # Empty playbook
        project = self.projects[3]
        self.assertEqual(len(project.playbooks), 1)
        write_test_file(project, 'blah.yml', '')
        self.assertEqual(len(project.playbooks), 1)
        # Invalid YAML
        project = self.projects[4]
        self.assertEqual(len(project.playbooks), 1)
        write_test_file(project, 'blah.yml', TEST_PLAYBOOK + '----')
        self.assertEqual(len(project.playbooks), 1)
        # No hosts or includes
        project = self.projects[5]
        self.assertEqual(len(project.playbooks), 1)
        playbook_content = TEST_PLAYBOOK.replace('hosts', 'hoists')
        write_test_file(project, 'blah.yml', playbook_content)
        self.assertEqual(len(project.playbooks), 1)
        # Playbook in roles folder
        project = self.projects[6]
        self.assertEqual(len(project.playbooks), 1)
        write_test_file(project, 'roles/blah.yml', TEST_PLAYBOOK)
        self.assertEqual(len(project.playbooks), 1)
        # Playbook in tasks folder
        project = self.projects[7]
        self.assertEqual(len(project.playbooks), 1)
        write_test_file(project, 'tasks/blah.yml', TEST_PLAYBOOK)
        self.assertEqual(len(project.playbooks), 1)

    def test_api_config(self):
        # superuser can read all config data.
        url = reverse('main:api_v1_config_view')
        response = self.get(url, expect=200, auth=self.get_super_credentials())
        self.assertTrue('project_base_dir' in response)
        self.assertEqual(response['project_base_dir'], settings.PROJECTS_ROOT)
        self.assertTrue('project_local_paths' in response)
        self.assertEqual(set(response['project_local_paths']),
                         set(Project.get_local_path_choices()))

        # return local paths are only the ones not used by any active project.
        qs = Project.objects.filter(active=True)
        used_paths = qs.values_list('local_path', flat=True)
        self.assertFalse(set(response['project_local_paths']) & set(used_paths))
        for project in self.projects:
            local_path = project.local_path
            response = self.get(url, expect=200, auth=self.get_super_credentials())
            self.assertTrue(local_path not in response['project_local_paths'])
            project.mark_inactive()
            response = self.get(url, expect=200, auth=self.get_super_credentials())
            self.assertTrue(local_path in response['project_local_paths'])

        # org admin can read config and will get project fields.
        response = self.get(url, expect=200, auth=self.get_normal_credentials())
        self.assertTrue('project_base_dir' in response)
        self.assertTrue('project_local_paths' in response)

        # regular user can read configuration, but won't have project fields.
        response = self.get(url, expect=200, auth=self.get_nobody_credentials())
        self.assertFalse('project_base_dir' in response)
        self.assertFalse('project_local_paths' in response)

        # anonymous/invalid user can't access config.
        self.get(url, expect=401)
        self.get(url, expect=401, auth=self.get_invalid_credentials())

    def test_mainline(self):

        # =====================================================================
        # PROJECTS - LISTING

        # can get projects list
        projects = reverse('main:project_list')
        # invalid auth
        self.get(projects, expect=401)
        self.get(projects, expect=401, auth=self.get_invalid_credentials())
        # super user
        results = self.get(projects, expect=200, auth=self.get_super_credentials())
        self.assertEquals(results['count'], 10)
        # org admin
        results = self.get(projects, expect=200, auth=self.get_normal_credentials())
        self.assertEquals(results['count'], 10)
        # user on a team
        results = self.get(projects, expect=200, auth=self.get_other_credentials())
        self.assertEquals(results['count'], 5)
        # user not on any teams
        results = self.get(projects, expect=200, auth=self.get_nobody_credentials())
        self.assertEquals(results['count'], 0)

        # can add projects (super user)
        project_dir = tempfile.mkdtemp(dir=settings.PROJECTS_ROOT)
        self._temp_project_dirs.append(project_dir)
        project_data = {
            'name': 'My Test Project',
            'description': 'Does amazing things',
            'local_path': os.path.basename(project_dir),
        }
        response = self.post(projects, project_data, expect=201,
                             auth=self.get_super_credentials())

        # can edit project using same local path.
        project_detail = reverse('main:project_detail', args=(response['id'],))
        project_data = self.get(project_detail, expect=200,
                                auth=self.get_super_credentials())
        response = self.put(project_detail, project_data, expect=200,
                            auth=self.get_super_credentials())
        
        # cannot update using local_path from another project.
        project_data['local_path'] = self.projects[2].local_path
        response = self.put(project_detail, project_data, expect=400,
                            auth=self.get_super_credentials())

        # cannot update using a path that doesn't exist.
        project_data['local_path'] = 'my_secret_invisible_project_path'
        response = self.put(project_detail, project_data, expect=400,
                            auth=self.get_super_credentials())

        # =====================================================================
        # PROJECTS - ACCESS
        project = reverse('main:project_detail', args=(self.projects[3].pk,))
        self.get(project, expect=200, auth=self.get_super_credentials())
        self.get(project, expect=200, auth=self.get_normal_credentials())
        self.get(project, expect=200, auth=self.get_other_credentials())
        self.get(project, expect=403, auth=self.get_nobody_credentials())

        # can delete projects
        self.delete(project, expect=204, auth=self.get_normal_credentials())
        self.get(project, expect=404, auth=self.get_normal_credentials())

        # can list playbooks for projects
        proj_playbooks = reverse('main:project_detail_playbooks', args=(self.projects[2].pk,))
        got = self.get(proj_playbooks, expect=200, auth=self.get_super_credentials())
        self.assertEqual(got, self.projects[2].playbooks)

        # can list member organizations for projects
        proj_orgs = reverse('main:project_organizations_list', args=(self.projects[0].pk,))
        # only usable as superuser
        got = self.get(proj_orgs, expect=403, auth=self.get_normal_credentials())
        got = self.get(proj_orgs, expect=200, auth=self.get_super_credentials())
        self.assertEquals(got['count'], 1)
        self.assertEquals(got['results'][0]['url'], reverse('main:organization_detail', args=(self.organizations[0].pk,)))

        # post to create new org associated with this project.
        self.post(proj_orgs, data={'name': 'New Org'}, expect=201, auth=self.get_super_credentials())
        got = self.get(proj_orgs, expect=200, auth=self.get_super_credentials())
        self.assertEquals(got['count'], 2)

        # =====================================================================
        # TEAMS

        all_teams = reverse('main:team_list')
        team1 = reverse('main:team_detail', args=(self.team1.pk,))

        # can list teams
        got = self.get(all_teams, expect=200, auth=self.get_super_credentials())
        self.assertEquals(got['count'], 2)
        # FIXME: for other accounts, also check filtering

        # can get teams
        got = self.get(team1, expect=200, auth=self.get_super_credentials())
        self.assertEquals(got['url'], reverse('main:team_detail', args=(self.team1.pk,)))
        got = self.get(team1, expect=200, auth=self.get_normal_credentials())
        got = self.get(team1, expect=403, auth=self.get_other_credentials())
        self.team1.users.add(User.objects.get(username='other'))
        self.team1.save()
        got = self.get(team1, expect=200, auth=self.get_other_credentials())
        got = self.get(team1, expect=403, auth=self.get_nobody_credentials())

        new_team  = dict(name='newTeam',  description='blarg', organization=self.organizations[0].pk)
        new_team2 = dict(name='newTeam2', description='blarg', organization=self.organizations[0].pk)
        new_team3 = dict(name='newTeam3', description='bad wolf', organization=self.organizations[0].pk)

        # can add teams
        posted1 = self.post(all_teams, data=new_team, expect=201, auth=self.get_super_credentials())
        posted2 = self.post(all_teams, data=new_team, expect=400, auth=self.get_super_credentials())
        # normal user is not an admin of organizations[0], but is for [1].
        posted3 = self.post(all_teams, data=new_team2, expect=403, auth=self.get_normal_credentials())
        new_team2['organization'] = self.organizations[1].pk
        posted3 = self.post(all_teams, data=new_team2, expect=201, auth=self.get_normal_credentials())
        posted4 = self.post(all_teams, data=new_team2, expect=400, auth=self.get_normal_credentials())
        posted5 = self.post(all_teams, data=new_team3, expect=403, auth=self.get_other_credentials())
        url1 = posted1['url']
        url3 = posted3['url']
        url5 = posted1['url']

        new_team = Team.objects.create(name='newTeam4', organization=self.organizations[1])
        url = reverse('main:team_detail', args=(new_team.pk,))

        # can delete teams
        self.delete(url, expect=401)
        self.delete(url, expect=403, auth=self.get_nobody_credentials())
        self.delete(url, expect=403, auth=self.get_other_credentials())
        self.delete(url, expect=204, auth=self.get_normal_credentials())
        self.delete(url3, expect=204, auth=self.get_super_credentials())

        # =====================================================================
        # ORGANIZATION TEAMS

        # can list organization teams (filtered by user) -- this is an org admin function
        org_teams = reverse('main:organization_teams_list', args=(self.organizations[1].pk,))
        data1 = self.get(org_teams, expect=401)
        data2 = self.get(org_teams, expect=403, auth=self.get_nobody_credentials())
        data3 = self.get(org_teams, expect=403, auth=self.get_other_credentials())
        data4 = self.get(org_teams, expect=200, auth=self.get_normal_credentials())
        data5 = self.get(org_teams, expect=200, auth=self.get_super_credentials())

        # can add teams to organizations
        new_team1 = dict(name='super new team A')
        # also tests that sub posts overwrite the related field:
        new_team2 = dict(name='super new team B', organization=34567)
        new_team3 = dict(name='super new team C')

        data1 = self.post(org_teams, new_team1, expect=401)
        data1 = self.post(org_teams, new_team1, expect=403, auth=self.get_nobody_credentials())
        data1 = self.post(org_teams, new_team1, expect=403, auth=self.get_other_credentials())
        data2 = self.post(org_teams, new_team2, expect=201, auth=self.get_normal_credentials())
        data3 = self.post(org_teams, new_team3, expect=201, auth=self.get_super_credentials())

        # can remove teams from organizations
        data2['disassociate'] = 1
        url = data2['url']
        deleted = self.post(org_teams, data2, expect=204, auth=self.get_normal_credentials())
        got = self.get(url, expect=404, auth=self.get_normal_credentials())


        # =====================================================================
        # TEAM PROJECTS
 
        team = Team.objects.filter(organization__pk=self.organizations[1].pk)[0]
        team_projects = reverse('main:team_projects_list', args=(team.pk,))
      
        p1 = self.projects[0]
        team.projects.add(p1)
        team.save()
 
        got = self.get(team_projects, expect=200, auth=self.get_super_credentials())

        # FIXME: project postablility tests somewhat incomplete.
        # add tests to show we can create new projects on the subresource and so on.

        self.assertEquals(got['count'], 1)

        # =====================================================================
        # TEAMS USER MEMBERSHIP

        team = Team.objects.filter(active=True, organization__pk=self.organizations[1].pk)[0]
        team_users = reverse('main:team_users_list', args=(team.pk,))
        for x in team.users.all():
            team.users.remove(x)
        team.save()

        # can list uses on teams
        self.get(team_users, expect=401)
        self.get(team_users, expect=401, auth=self.get_invalid_credentials())
        self.get(team_users, expect=403, auth=self.get_nobody_credentials())
        self.get(team_users, expect=403, auth=self.get_other_credentials())
        self.get(team_users, expect=200, auth=self.get_normal_credentials())
        self.get(team_users, expect=200, auth=self.get_super_credentials())

        # can add users to teams (but only users I can see)
        all_users = self.get(reverse('main:user_list'), expect=200, auth=self.get_normal_credentials())
        for x in all_users['results']:
            self.post(team_users, data=x, expect=403, auth=self.get_nobody_credentials())
            self.post(team_users, data=x, expect=204, auth=self.get_normal_credentials())

        self.assertEqual(Team.objects.get(pk=team.pk).users.count(), 3)

        # can remove users from teams
        for x in all_users['results']:
            y = dict(id=x['id'], disassociate=1)
            self.post(team_users, data=y, expect=403, auth=self.get_nobody_credentials())
            self.post(team_users, data=y, expect=204, auth=self.get_normal_credentials())

        self.assertEquals(Team.objects.get(pk=team.pk).users.count(), 0)

        # =====================================================================
        # USER TEAMS

        # from a user, can see what teams they are on (related resource)
        other = User.objects.get(username = 'other')
        url = reverse('main:user_teams_list', args=(other.pk,))
        self.get(url, expect=401)
        self.get(url, expect=401, auth=self.get_invalid_credentials())
        self.get(url, expect=403, auth=self.get_nobody_credentials())
        other.organizations.add(Organization.objects.get(pk=self.organizations[1].pk))
        # Normal user can only see some teams that other user is a part of,
        # since normal user is not an admin of that organization.
        my_teams1 = self.get(url, expect=200, auth=self.get_normal_credentials())
        self.assertEqual(my_teams1['count'], 1)
        # Other user should be able to see all his own teams.
        my_teams2 = self.get(url, expect=200, auth=self.get_other_credentials())
        self.assertEqual(my_teams2['count'], 2)

        # =====================================================================
        # USER PROJECTS

        url = reverse('main:user_projects_list', args=(other.pk,))

        # from a user, can see what projects they can see based on team association
        # though this resource doesn't do anything else
        got = self.get(url, expect=200, auth=self.get_other_credentials())
        self.assertEquals(got['count'], 5)
        got = self.get(url, expect=403, auth=self.get_nobody_credentials())
        got = self.get(url, expect=401, auth=self.get_invalid_credentials())
        got = self.get(url, expect=401)
        got = self.get(url, expect=200, auth=self.get_super_credentials())

        # =====================================================================
        # CREDENTIALS

        other_creds = reverse('main:user_credentials_list', args=(other.pk,))
        team_creds = reverse('main:team_credentials_list', args=(team.pk,))

        new_credentials = dict(
            name = 'credential',
            project = Project.objects.order_by('pk')[0].pk,
            default_username = 'foo',
            ssh_key_data = 'bar',
            ssh_key_unlock = 'baz',
            ssh_password = 'narf',
            sudo_password = 'troz'
        )

        # can add credentials to a user (if user or org admin or super user)
        self.post(other_creds, data=new_credentials, expect=401)
        self.post(other_creds, data=new_credentials, expect=401, auth=self.get_invalid_credentials())
        self.post(other_creds, data=new_credentials, expect=201, auth=self.get_super_credentials())
        self.post(other_creds, data=new_credentials, expect=201, auth=self.get_normal_credentials())
        result = self.post(other_creds, data=new_credentials, expect=201, auth=self.get_other_credentials())
        self.post(other_creds, data=new_credentials, expect=403, auth=self.get_nobody_credentials())
        cred_user = result['id']


        # can add credentials to a team
        self.post(team_creds, data=new_credentials, expect=401)
        self.post(team_creds, data=new_credentials, expect=401, auth=self.get_invalid_credentials())
        self.post(team_creds, data=new_credentials, expect=201, auth=self.get_super_credentials())
        result = self.post(team_creds, data=new_credentials, expect=201, auth=self.get_normal_credentials())
        self.post(team_creds, data=new_credentials, expect=403, auth=self.get_other_credentials())
        self.post(team_creds, data=new_credentials, expect=403, auth=self.get_nobody_credentials())
        cred_team = result['id']

        # can list credentials on a user
        self.get(other_creds, expect=401)
        self.get(other_creds, expect=401, auth=self.get_invalid_credentials())
        self.get(other_creds, expect=200, auth=self.get_super_credentials())
        self.get(other_creds, expect=200, auth=self.get_normal_credentials())
        self.get(other_creds, expect=200, auth=self.get_other_credentials())
        self.get(other_creds, expect=403, auth=self.get_nobody_credentials())

        # can list credentials on a team
        self.get(team_creds, expect=401)
        self.get(team_creds, expect=401, auth=self.get_invalid_credentials())
        self.get(team_creds, expect=200, auth=self.get_super_credentials())
        self.get(team_creds, expect=200, auth=self.get_normal_credentials())
        self.get(team_creds, expect=403, auth=self.get_other_credentials())
        self.get(team_creds, expect=403, auth=self.get_nobody_credentials())

        # Check /api/v1/credentials (GET)
        url = reverse('main:credential_list')
        with self.current_user(self.super_django_user):
            self.options(url)
            self.head(url)
            response = self.get(url)
        qs = Credential.objects.all()
        self.check_pagination_and_size(response, qs.count())
        self.check_list_ids(response, qs)

        # POST should fail for all users.
        with self.current_user(self.super_django_user):
            data = dict(name='xyz', user=self.super_django_user.pk)
            self.post(url, data, expect=405)
    
        # FIXME: Check list as other users.

        # can edit a credential
        cred_user = Credential.objects.get(pk=cred_user)
        cred_team = Credential.objects.get(pk=cred_team)
        d_cred_user = dict(id=cred_user.pk, name='x', sudo_password='blippy', user=cred_user.user.pk)
        d_cred_user2 = dict(id=cred_user.pk, name='x', sudo_password='blippy', user=self.super_django_user.pk)
        d_cred_team = dict(id=cred_team.pk, name='x', sudo_password='blippy', team=cred_team.team.pk)
        edit_creds1 = reverse('main:credential_detail', args=(cred_user.pk,))
        edit_creds2 = reverse('main:credential_detail', args=(cred_team.pk,))

        self.put(edit_creds1, data=d_cred_user, expect=401)
        self.put(edit_creds1, data=d_cred_user, expect=401, auth=self.get_invalid_credentials())
        self.put(edit_creds1, data=d_cred_user, expect=200, auth=self.get_super_credentials())
        self.put(edit_creds1, data=d_cred_user, expect=200, auth=self.get_normal_credentials())
        # editing a credential to edit the user record is not legal, this is a test of the .validate
        # method on the serializer to allow 'write once' fields
        self.put(edit_creds1, data=d_cred_user2, expect=403, auth=self.get_normal_credentials())
        cred_put_u = self.put(edit_creds1, data=d_cred_user, expect=200, auth=self.get_other_credentials())

        self.put(edit_creds2, data=d_cred_team, expect=401)
        self.put(edit_creds2, data=d_cred_team, expect=401, auth=self.get_invalid_credentials())
        self.put(edit_creds2, data=d_cred_team, expect=200, auth=self.get_super_credentials())
        cred_put_t = self.put(edit_creds2, data=d_cred_team, expect=200, auth=self.get_normal_credentials())
        self.put(edit_creds2, data=d_cred_team, expect=403, auth=self.get_other_credentials())

        cred_put_t['disassociate'] = 1
        team_url = reverse('main:team_credentials_list', args=(cred_put_t['team'],))
        self.post(team_url, data=cred_put_t, expect=204, auth=self.get_normal_credentials())

        # can remove credentials from a user (via disassociate) - this will delete the credential.
        cred_put_u['disassociate'] = 1
        url = cred_put_u['url']
        user_url = reverse('main:user_credentials_list', args=(cred_put_u['user'],))
        self.post(user_url, data=cred_put_u, expect=204, auth=self.get_normal_credentials())

        # can delete a credential directly -- probably won't be used too often
        #data = self.delete(url, expect=204, auth=self.get_other_credentials())
        data = self.delete(url, expect=404, auth=self.get_other_credentials())

        # =====================================================================
        # PERMISSIONS

        user         = self.other_django_user
        team         = Team.objects.order_by('pk')[0]
        organization = Organization.objects.order_by('pk')[0]
        inventory    = Inventory.objects.create(
            name         = 'test inventory', 
            organization = organization,
            created_by   = self.super_django_user
        )
        project = Project.objects.order_by('pk')[0]

        # can add permissions to a user

        user_permission = dict(
            name='user can deploy a certain project to a certain inventory', 
            # user=user.pk, # no need to specify, this will be automatically filled in
            inventory=inventory.pk, 
            project=project.pk, 
            permission_type=PERM_INVENTORY_DEPLOY
        )
        team_permission = dict(
            name='team can deploy a certain project to a certain inventory',
            # team=team.pk, # no need to specify, this will be automatically filled in
            inventory=inventory.pk,
            project=project.pk,
            permission_type=PERM_INVENTORY_DEPLOY
        )

        url = reverse('main:user_permissions_list', args=(user.pk,))
        posted = self.post(url, user_permission, expect=201, auth=self.get_super_credentials())
        url2 = posted['url']
        got = self.get(url2, expect=200, auth=self.get_other_credentials())

        # cannot add permissions that apply to both team and user
        url = reverse('main:user_permissions_list', args=(user.pk,))
        user_permission['name'] = 'user permission 2'
        user_permission['team'] = team.pk
        self.post(url, user_permission, expect=400, auth=self.get_super_credentials())

        # cannot set admin/read/write permissions when a project is involved.
        user_permission.pop('team')
        user_permission['name'] = 'user permission 3'
        user_permission['permission_type'] = PERM_INVENTORY_ADMIN
        self.post(url, user_permission, expect=400, auth=self.get_super_credentials())

        # project is required for a deployment permission
        user_permission['name'] = 'user permission 4'
        user_permission['permission_type'] = PERM_INVENTORY_DEPLOY
        user_permission.pop('project')
        self.post(url, user_permission, expect=400, auth=self.get_super_credentials())

        # can add permissions on a team
        url = reverse('main:team_permissions_list', args=(team.pk,))
        posted = self.post(url, team_permission, expect=201, auth=self.get_super_credentials())
        url2 = posted['url']
        # check we can get that permission back
        got = self.get(url2, expect=200, auth=self.get_other_credentials())

        # cannot add permissions that apply to both team and user
        url = reverse('main:team_permissions_list', args=(team.pk,))
        team_permission['name'] += '2'
        team_permission['user'] = user.pk
        self.post(url, team_permission, expect=400, auth=self.get_super_credentials())

        # can list permissions on a user
        url = reverse('main:user_permissions_list', args=(user.pk,))
        got = self.get(url, expect=200, auth=self.get_super_credentials())
        got = self.get(url, expect=200, auth=self.get_other_credentials())
        got = self.get(url, expect=403, auth=self.get_nobody_credentials())

        # can list permissions on a team
        url = reverse('main:team_permissions_list', args=(team.pk,))
        got = self.get(url, expect=200, auth=self.get_super_credentials())
        got = self.get(url, expect=200, auth=self.get_other_credentials())
        got = self.get(url, expect=403, auth=self.get_nobody_credentials())

        # can edit a permission -- reducing the permission level
        team_permission['permission_type'] = PERM_INVENTORY_CHECK
        self.put(url2, team_permission, expect=200, auth=self.get_super_credentials())
        self.put(url2, team_permission, expect=403, auth=self.get_other_credentials())

        # can remove permissions
        # do need to disassociate, just delete it
        self.delete(url2, expect=403, auth=self.get_other_credentials())
        self.delete(url2, expect=204, auth=self.get_super_credentials())
        self.delete(url2, expect=404, auth=self.get_other_credentials())
