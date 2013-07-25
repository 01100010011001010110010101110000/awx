# Copyright (c) 2013 AnsibleWorks, Inc.
# All Rights Reserved.

import json

from django.contrib.auth.models import User
import django.test
from django.test.client import Client
from django.core.urlresolvers import reverse

from awx.main.models import *
from awx.main.tests.base import BaseTest

class UsersTest(BaseTest):

    def collection(self):
        return reverse('main:user_list')

    def setUp(self):
        super(UsersTest, self).setUp()
        self.setup_users()
        self.organizations = self.make_organizations(self.super_django_user, 1)
        self.organizations[0].admins.add(self.normal_django_user)
        self.organizations[0].users.add(self.other_django_user)
        self.organizations[0].users.add(self.normal_django_user)
 
    def test_only_super_user_or_org_admin_can_add_users(self):
        url = reverse('main:user_list')
        new_user = dict(username='blippy')
        new_user2 = dict(username='blippy2')
        self.post(url, expect=401, data=new_user, auth=None)
        self.post(url, expect=401, data=new_user, auth=self.get_invalid_credentials())
        self.post(url, expect=403, data=new_user, auth=self.get_other_credentials())
        self.post(url, expect=201, data=new_user, auth=self.get_super_credentials())
        self.post(url, expect=400, data=new_user, auth=self.get_super_credentials())
        self.post(url, expect=201, data=new_user2, auth=self.get_normal_credentials())
        self.post(url, expect=400, data=new_user2, auth=self.get_normal_credentials())

    def test_auth_token_login(self):
        auth_token_url = reverse('main:auth_token_view')

        # Always returns a 405 for any GET request, regardless of credentials.
        self.get(auth_token_url, expect=405, auth=None)
        self.get(auth_token_url, expect=405, auth=self.get_invalid_credentials())
        self.get(auth_token_url, expect=405, auth=self.get_normal_credentials())
        
        # Posting without username/password fields or invalid username/password
        # returns a 400 error.
        data = {}
        self.post(auth_token_url, data, expect=400)
        data = dict(zip(('username', 'password'), self.get_invalid_credentials()))
        self.post(auth_token_url, data, expect=400)

        # A valid username/password should give us an auth token.
        data = dict(zip(('username', 'password'), self.get_normal_credentials()))
        result = self.post(auth_token_url, data, expect=200, auth=None)
        self.assertTrue('token' in result)
        self.assertEqual(result['token'], self.normal_django_user.auth_token.key)
        auth_token = result['token']

        # Verify we can access our own user information with the auth token.
        data = self.get(reverse('main:user_me_list'), expect=200, auth=auth_token)
        self.assertEquals(data['results'][0]['username'], 'normal')
        self.assertEquals(data['count'], 1)

    def test_ordinary_user_can_modify_some_fields_about_himself_but_not_all_and_passwords_work(self):

        detail_url = reverse('main:user_detail', args=(self.other_django_user.pk,))
        data = self.get(detail_url, expect=200, auth=self.get_other_credentials())

        # can't change first_name, last_name, etc
        data['last_name'] = "NewLastName"
        self.put(detail_url, data, expect=403, auth=self.get_other_credentials())

        # can't change username
        data['username'] = 'newUsername'
        self.put(detail_url, data, expect=403, auth=self.get_other_credentials())

        # if superuser, CAN change lastname and username and such
        self.put(detail_url, data, expect=200, auth=self.get_super_credentials())
        
        # and user can still login
        creds = self.get_other_credentials()
        creds = ('newUsername', creds[1])
        data = self.get(detail_url, expect=200, auth=creds)

        # user can change their password (submit as text) and can still login
        # and password is not stored as plaintext

        data['password'] = 'newPassWord1234Changed'
        changed = self.put(detail_url, data, expect=200, auth=creds)
        creds = (creds[0], data['password'])
        self.get(detail_url, expect=200, auth=creds)
       
        # make another nobody user, and make sure they can't send any edits
        obj = User.objects.create(username='new_user')
        obj.set_password('new_user')
        obj.save()
        hacked = dict(password='asdf')
        changed = self.put(detail_url, hacked, expect=403, auth=('new_user', 'new_user'))
        hacked = dict(username='asdf')
        changed = self.put(detail_url, hacked, expect=403, auth=('new_user', 'new_user'))

        # password is not stored in plaintext
        self.assertTrue(User.objects.get(pk=self.normal_django_user.pk).password != data['password'])

    def test_user_created_with_password_can_login(self):

        # this is something an org admin can do...
        url = reverse('main:user_list')
        data  = dict(username='username',  password='password')
        data2 = dict(username='username2', password='password2')
        data = self.post(url, expect=201, data=data, auth=self.get_normal_credentials())

        # verify that the login works...
        self.get(url, expect=200, auth=('username', 'password'))

        # but a regular user cannot        
        data = self.post(url, expect=403, data=data2, auth=self.get_other_credentials())
        
        # a super user can also create new users   
        data = self.post(url, expect=201, data=data2, auth=self.get_super_credentials())

        # verify that the login works
        self.get(url, expect=200, auth=('username2', 'password2'))

        # verify that if you post a user with a pk, you do not alter that user's password info
        mod = dict(id=self.super_django_user.pk, username='change', password='change')
        data = self.post(url, expect=201, data=mod, auth=self.get_super_credentials())
        orig = User.objects.get(pk=self.super_django_user.pk)
        self.assertTrue(orig.username != 'change')
 
    def test_password_not_shown_in_get_operations_for_list_or_detail(self):
        url = reverse('main:user_detail', args=(self.super_django_user.pk,))
        data = self.get(url, expect=200, auth=self.get_super_credentials())
        self.assertTrue('password' not in data)

        url = reverse('main:user_list')
        data = self.get(url, expect=200, auth=self.get_super_credentials())
        self.assertTrue('password' not in data['results'][0])

    def test_user_list_filtered(self):
        url = reverse('main:user_list')
        data3 = self.get(url, expect=200, auth=self.get_super_credentials())
        self.assertEquals(data3['count'], 3)
        data2 = self.get(url, expect=200, auth=self.get_normal_credentials())
        self.assertEquals(data2['count'], 2)
        data1 = self.get(url, expect=200, auth=self.get_other_credentials())
        self.assertEquals(data1['count'], 1)

    def test_super_user_can_delete_a_user_but_only_marked_inactive(self):
        user_pk = self.normal_django_user.pk
        url = reverse('main:user_detail', args=(user_pk,))
        data = self.delete(url, expect=204, auth=self.get_super_credentials())
        data = self.get(url, expect=404, auth=self.get_super_credentials())
        obj = User.objects.get(pk=user_pk)
        self.assertEquals(obj.is_active, False)
 
    def test_non_org_admin_user_cannot_delete_any_user_including_himself(self):
        url1 = reverse('main:user_detail', args=(self.super_django_user.pk,))
        url2 = reverse('main:user_detail', args=(self.normal_django_user.pk,))
        url3 = reverse('main:user_detail', args=(self.other_django_user.pk,))
        data = self.delete(url1, expect=403, auth=self.get_other_credentials())
        data = self.delete(url2, expect=403, auth=self.get_other_credentials())
        data = self.delete(url3, expect=403, auth=self.get_other_credentials())

    def test_there_exists_an_obvious_url_where_a_user_may_find_his_user_record(self):
        url = reverse('main:user_me_list')
        data = self.get(url, expect=401, auth=None)
        data = self.get(url, expect=401, auth=self.get_invalid_credentials())
        data = self.get(url, expect=200, auth=self.get_normal_credentials())
        self.assertEquals(data['results'][0]['username'], 'normal')
        self.assertEquals(data['count'], 1)
        data = self.get(url, expect=200, auth=self.get_other_credentials())
        self.assertEquals(data['results'][0]['username'], 'other')
        self.assertEquals(data['count'], 1)
        data = self.get(url, expect=200, auth=self.get_super_credentials())
        self.assertEquals(data['results'][0]['username'], 'admin')
        self.assertEquals(data['count'], 1)

    def test_superuser_can_change_admin_only_fields_about_himself(self):
        url = reverse('main:user_detail', args=(self.super_django_user.pk,))
        data = self.get(url, expect=200, auth=self.get_super_credentials())
        data['username'] += '2'
        data['first_name'] += ' Awesome'
        data['last_name'] += ', Jr.'
        response = self.put(url, data, expect=200,
                            auth=self.get_super_credentials())
        # FIXME: Test if super user mark himself as no longer a super user, or
        # delete himself.

    def test_user_related_resources(self):

        # organizations the user is a member of, should be 1
        url = reverse('main:user_organizations_list',
                      args=(self.normal_django_user.pk,))
        data = self.get(url, expect=200, auth=self.get_normal_credentials())
        self.assertEquals(data['count'], 1) 
        # also accessible via superuser
        data = self.get(url, expect=200, auth=self.get_super_credentials())
        self.assertEquals(data['count'], 1) 
        # but not by other user
        data = self.get(url, expect=403, auth=self.get_other_credentials())

        # organizations the user is an admin of, should be 1
        url = reverse('main:user_admin_of_organizations_list',
                      args=(self.normal_django_user.pk,))
        data = self.get(url, expect=200, auth=self.get_normal_credentials())
        self.assertEquals(data['count'], 1)
        # also accessible via superuser
        data = self.get(url, expect=200, auth=self.get_super_credentials())
        self.assertEquals(data['count'], 1)
        # but not by other user
        data = self.get(url, expect=403, auth=self.get_other_credentials())
 
        # teams the user is on, should be 0
        url = reverse('main:user_teams_list', args=(self.normal_django_user.pk,))
        data = self.get(url, expect=200, auth=self.get_normal_credentials())
        self.assertEquals(data['count'], 0)
        # also accessible via superuser
        data = self.get(url, expect=200, auth=self.get_super_credentials())
        self.assertEquals(data['count'], 0)
        # but not by other user
        data = self.get(url, expect=403, auth=self.get_other_credentials())

        # verify org admin can still read other user data too
        url = reverse('main:user_organizations_list',
                      args=(self.other_django_user.pk,))
        data = self.get(url, expect=200, auth=self.get_normal_credentials())
        self.assertEquals(data['count'], 1)
        url = reverse('main:user_admin_of_organizations_list',
                      args=(self.other_django_user.pk,))
        data = self.get(url, expect=200, auth=self.get_normal_credentials())
        self.assertEquals(data['count'], 0)
        url = reverse('main:user_teams_list',
                      args=(self.other_django_user.pk,))
        data = self.get(url, expect=200, auth=self.get_normal_credentials())
        self.assertEquals(data['count'], 0)

        # FIXME: add test that shows posting a user w/o id to /organizations/2/users/ can create a new one & associate
        # FIXME: add test that shows posting a user w/o id to /organizations/2/admins/ can create a new one & associate
        # FIXME: add test that shows posting a projects w/o id to /organizations/2/projects/ can create a new one & associate


