# Copyright (c) 2015 Ansible, Inc. (formerly AnsibleWorks, Inc.)
# All Rights Reserved.

from django.core.urlresolvers import reverse
from awx.main.models import * # noqa
from awx.main.tests.base import BaseTest

class OrganizationsTest(BaseTest):

    def collection(self):
        return reverse('api:organization_list')

    def setUp(self):
        super(OrganizationsTest, self).setUp()
        self.setup_instances()
        # TODO: Test non-enterprise license
        self.create_test_license_file()
        self.setup_users()
 
        self.organizations = self.make_organizations(self.super_django_user, 10)
        self.projects      = self.make_projects(self.normal_django_user, 10)

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
        #   nobody_user is a user not a member of any organizations

        for x in self.organizations:
            x.admins.add(self.super_django_user)
            x.users.add(self.super_django_user)
            x.users.add(self.other_django_user)
 
        self.organizations[0].users.add(self.normal_django_user)
        self.organizations[1].admins.add(self.normal_django_user)

    def test_get_organization_list(self):
        url = reverse('api:organization_list')

        # no credentials == 401
        self.options(url, expect=401)
        self.head(url, expect=401)
        self.get(url, expect=401)

        # wrong credentials == 401
        with self.current_user(self.get_invalid_credentials()):
            self.options(url, expect=401)
            self.head(url, expect=401)
            self.get(url, expect=401)

        # superuser credentials == 200, full list
        with self.current_user(self.super_django_user):
            self.options(url, expect=200)
            self.head(url, expect=200)
            response = self.get(url, expect=200)
            self.check_pagination_and_size(response, 10, previous=None, next=None)
            self.assertEqual(len(response['results']),
                             Organization.objects.count())
            for field in ['id', 'url', 'name', 'description', 'created']:
                self.assertTrue(field in response['results'][0],
                                'field %s not in result' % field)

        # check that the related URL functionality works
        related = response['results'][0]['related']
        for x in ['projects', 'users', 'admins']:
            self.assertTrue(x in related and related[x].endswith("/%s/" % x), "looking for %s in related" % x)

        # normal credentials == 200, get only organizations of which user is a member
        with self.current_user(self.normal_django_user):
            self.options(url, expect=200)
            self.head(url, expect=200)
            response = self.get(url, expect=200)
            self.check_pagination_and_size(response, 2, previous=None, next=None)

        # no admin rights? get empty list
        with self.current_user(self.other_django_user):
            response = self.get(url, expect=200)
            self.check_pagination_and_size(response, self.other_django_user.organizations.count(), previous=None, next=None)

        # not a member of any orgs? get empty list
        with self.current_user(self.nobody_django_user):
            response = self.get(url, expect=200)
            self.check_pagination_and_size(response, 0, previous=None, next=None)

    def test_get_item(self):

        # first get all the URLs
        data = self.get(self.collection(), expect=200, auth=self.get_super_credentials())
        urls = [item['url'] for item in data['results']]

        # make sure super user can fetch records
        data = self.get(urls[0], expect=200, auth=self.get_super_credentials())
        [self.assertTrue(key in data) for key in ['name', 'description', 'url']]

        # make sure invalid user cannot
        data = self.get(urls[0], expect=401, auth=self.get_invalid_credentials())

        # normal user should be able to get org 0 and org 1 but not org 9 (as he's not a user or admin of it)
        data = self.get(urls[0], expect=200, auth=self.get_normal_credentials())
        data = self.get(urls[1], expect=200, auth=self.get_normal_credentials())
        data = self.get(urls[9], expect=403, auth=self.get_normal_credentials())

        # other user is a member, but not admin, can access org
        data = self.get(urls[0], expect=200, auth=self.get_other_credentials())

        # nobody user is not a member, cannot access org
        data = self.get(urls[0], expect=403, auth=self.get_nobody_credentials())

    def test_get_item_subobjects_projects(self):

        # first get all the orgs
        orgs = self.get(self.collection(), expect=200, auth=self.get_super_credentials())

        # find projects attached to the first org
        projects0_url = orgs['results'][0]['related']['projects']
        projects1_url = orgs['results'][1]['related']['projects']
        projects9_url = orgs['results'][9]['related']['projects']

        self.get(projects0_url, expect=401, auth=None)
        self.get(projects0_url, expect=401, auth=self.get_invalid_credentials())

        # normal user is just a member of the first org, so can see all projects under the org
        self.get(projects0_url, expect=200, auth=self.get_normal_credentials())

        # however in the second org, he's an admin and should see all of them
        projects1a = self.get(projects1_url, expect=200, auth=self.get_normal_credentials())
        self.assertEquals(projects1a['count'], 5)

        # but the non-admin cannot access the list of projects in the org.  He should use /projects/ instead!
        self.get(projects1_url, expect=200, auth=self.get_other_credentials())

        # superuser should be able to read anything
        projects9a = self.get(projects9_url, expect=200, auth=self.get_super_credentials())
        self.assertEquals(projects9a['count'], 1)

        # nobody user is not a member of any org, so can't see projects...
        self.get(projects0_url, expect=403, auth=self.get_nobody_credentials())
        projects1a = self.get(projects1_url, expect=403, auth=self.get_nobody_credentials())

    def test_get_item_subobjects_users(self):

        # see if we can list the users added to the organization
        orgs = self.get(self.collection(), expect=200, auth=self.get_super_credentials())
        org1_users_url = orgs['results'][1]['related']['users']
        org1_users = self.get(org1_users_url, expect=200, auth=self.get_normal_credentials())
        self.assertEquals(org1_users['count'], 2)
        org1_users = self.get(org1_users_url, expect=200, auth=self.get_super_credentials())
        self.assertEquals(org1_users['count'], 2)
        org1_users = self.get(org1_users_url, expect=200, auth=self.get_other_credentials())
        self.assertEquals(org1_users['count'], 2)

    def test_get_item_subobjects_admins(self):

        # see if we can list the users added to the organization
        orgs = self.get(self.collection(), expect=200, auth=self.get_super_credentials())
        org1_users_url = orgs['results'][1]['related']['admins']
        org1_users = self.get(org1_users_url, expect=200, auth=self.get_normal_credentials())
        self.assertEquals(org1_users['count'], 2)
        org1_users = self.get(org1_users_url, expect=200, auth=self.get_super_credentials())
        self.assertEquals(org1_users['count'], 2)

    def test_get_organization_inventories_list(self):
        pass

    def _test_get_item_subobjects_tags(self):
        # FIXME: Update to support taggit!

        # put some tags on the org
        org1 = Organization.objects.get(pk=2)
        tag1 = Tag.objects.create(name='atag')
        tag2 = Tag.objects.create(name='btag')
        org1.tags.add(tag1)
        org1.tags.add(tag2)

        # see if we can list the users added to the organization
        orgs = self.get(self.collection(), expect=200, auth=self.get_super_credentials())
        org1_tags_url = orgs['results'][1]['related']['tags']
        org1_tags = self.get(org1_tags_url, expect=200, auth=self.get_normal_credentials())
        self.assertEquals(org1_tags['count'], 2)
        org1_tags = self.get(org1_tags_url, expect=200, auth=self.get_super_credentials())
        self.assertEquals(org1_tags['count'], 2)
        org1_tags = self.get(org1_tags_url, expect=403, auth=self.get_other_credentials())

    def _test_get_item_subobjects_audit_trail(self):
        # FIXME: Update to support whatever audit trail framework is used.
        url = '/api/v1/organizations/2/audit_trail/'
        self.get(url, expect=200, auth=self.get_normal_credentials())
        # FIXME: verify that some audit trail records are auto-created on save AND post

    def test_post_item(self):

        new_org = dict(name='magic test org', description='8675309')
        
        # need to be a valid user
        self.post(self.collection(), new_org, expect=401, auth=None)
        self.post(self.collection(), new_org, expect=401, auth=self.get_invalid_credentials())
        
        # only super users can create organizations
        self.post(self.collection(), new_org, expect=403, auth=self.get_normal_credentials())
        self.post(self.collection(), new_org, expect=403, auth=self.get_other_credentials())
        data1 = self.post(self.collection(), new_org, expect=201, auth=self.get_super_credentials())

        # duplicate post results in 400
        self.post(self.collection(), new_org, expect=400, auth=self.get_super_credentials())

        # look at what we got back from the post, make sure we added an org
        last_org = Organization.objects.order_by('-pk')[0]
        self.assertTrue(data1['url'].endswith("/%d/" % last_org.pk))

    def test_post_item_subobjects_projects(self):
        
        # first get all the orgs
        orgs = self.get(self.collection(), expect=200, auth=self.get_super_credentials())
        
        # find projects attached to the first org
        projects0_url = orgs['results'][0]['related']['projects']
        projects1_url = orgs['results'][1]['related']['projects']
        projects2_url = orgs['results'][2]['related']['projects']
        
        # get all the projects on the first org
        projects0 = self.get(projects0_url, expect=200, auth=self.get_super_credentials())
        a_project = projects0['results'][-1]

        # attempt to add the project to the 7th org and see what happens
        self.post(projects1_url, a_project, expect=204, auth=self.get_super_credentials())
        projects1 = self.get(projects0_url, expect=200, auth=self.get_super_credentials())
        self.assertEquals(projects1['count'], 3)

        # make sure adding a project that does not exist, or a missing pk field, results in a 400
        self.post(projects1_url, dict(id=99999), expect=400, auth=self.get_super_credentials())
        self.post(projects1_url, dict(asdf=1234), expect=400, auth=self.get_super_credentials())

        # test that by posting a pk + disassociate: True we can remove a relationship
        projects1 = self.get(projects1_url, expect=200, auth=self.get_super_credentials())
        self.assertEquals(projects1['count'], 6)
        a_project['disassociate'] = True
        self.post(projects1_url, a_project, expect=204, auth=self.get_super_credentials())
        projects1 = self.get(projects1_url, expect=200, auth=self.get_super_credentials())
        self.assertEquals(projects1['count'], 5)
       
        a_project = projects1['results'][-1]
        a_project['disassociate'] = 1
        projects1 = self.get(projects1_url, expect=200, auth=self.get_super_credentials())
        self.post(projects1_url, a_project, expect=204, auth=self.get_normal_credentials())
        projects1 = self.get(projects1_url, expect=200, auth=self.get_super_credentials())
        self.assertEquals(projects1['count'], 4)

        new_project_a = self.make_projects(self.normal_django_user, 1)[0]
        new_project_b = self.make_projects(self.other_django_user, 1)[0]

        # admin of org can add projects that he can read
        self.post(projects1_url, dict(id=new_project_a.pk), expect=204, auth=self.get_normal_credentials())
        # but not those he cannot
        self.post(projects1_url, dict(id=new_project_b.pk), expect=403, auth=self.get_normal_credentials())

        # and can't post a project he can read to an org he cannot
        # self.post(projects2_url, dict(id=new_project_a.pk), expect=403, auth=self.get_normal_credentials())

        # and can't do post a project he can read to an organization he cannot
        self.post(projects2_url, dict(id=new_project_a.pk), expect=403, auth=self.get_normal_credentials())
          

    def test_post_item_subobjects_users(self):

        url = reverse('api:organization_users_list', args=(self.organizations[1].pk,))
        users = self.get(url, expect=200, auth=self.get_normal_credentials())
        self.assertEqual(users['count'], 2)
        self.post(url, dict(id=self.normal_django_user.pk), expect=204, auth=self.get_normal_credentials())
        users = self.get(url, expect=200, auth=self.get_normal_credentials())
        self.assertEqual(users['count'], 3)
        self.post(url, dict(id=self.normal_django_user.pk, disassociate=True), expect=204, auth=self.get_normal_credentials())
        users = self.get(url, expect=200, auth=self.get_normal_credentials())
        self.assertEqual(users['count'], 2)

        # post a completely new user to verify we can add users to the subcollection directly
        new_user = dict(username='NewUser9000', password='NewPassword9000')
        which_org = self.normal_django_user.admin_of_organizations.all()[0]
        url = reverse('api:organization_users_list', args=(which_org.pk,))
        self.post(url, new_user, expect=201, auth=self.get_normal_credentials())

        all_users = self.get(url, expect=200, auth=self.get_normal_credentials())
        self.assertEqual(all_users['count'], 3)

    def test_post_item_subobjects_admins(self):

        url = reverse('api:organization_admins_list', args=(self.organizations[1].pk,))
        admins = self.get(url, expect=200, auth=self.get_normal_credentials())
        self.assertEqual(admins['count'], 2)
        self.post(url, dict(id=self.other_django_user.pk), expect=204, auth=self.get_normal_credentials())
        admins = self.get(url, expect=200, auth=self.get_normal_credentials())
        self.assertEqual(admins['count'], 3)
        self.post(url, dict(id=self.other_django_user.pk, disassociate=1), expect=204, auth=self.get_normal_credentials())
        admins = self.get(url, expect=200, auth=self.get_normal_credentials())
        self.assertEqual(admins['count'], 2)

    def _test_post_item_subobjects_tags(self):
        # FIXME: Update to support taggit!

        tag = Tag.objects.create(name='blippy')
        url = '/api/v1/organizations/2/tags/'
        tags = self.get(url, expect=200, auth=self.get_normal_credentials())
        self.assertEqual(tags['count'], 0)
        self.post(url, dict(id=tag.pk), expect=204, auth=self.get_normal_credentials())
        tags = self.get(url, expect=200, auth=self.get_normal_credentials())
        self.assertEqual(tags['count'], 1)
        self.assertEqual(tags['results'][0]['id'], tag.pk)
        self.post(url, dict(id=tag.pk, disassociate=1), expect=204, auth=self.get_normal_credentials())
        tags = self.get(url, expect=200, auth=self.get_normal_credentials())
        self.assertEqual(tags['count'], 0)

    def _test_post_item_subobjects_audit_trail(self):
        # FIXME: Update to support whatever audit trail framework is used.
        # audit trails are system things, and no user can post to them.
        url = '/api/v1/organizations/2/audit_trail/'
        self.post(url, dict(id=1), expect=405, auth=self.get_super_credentials())

    def test_put_item(self):

        # first get some urls and data to put back to them
        urls = self.get_urls(self.collection(), auth=self.get_super_credentials())
        self.get(urls[0], expect=200, auth=self.get_super_credentials())
        data1 = self.get(urls[1], expect=200, auth=self.get_super_credentials())

        # test that an unauthenticated user cannot do a put
        new_data1 = data1.copy()
        new_data1['description'] = 'updated description'
        self.put(urls[0], new_data1, expect=401, auth=None)
        self.put(urls[0], new_data1, expect=401, auth=self.get_invalid_credentials())

        # user normal is an admin of org 0 and a member of org 1 so should be able to put only org 1
        self.put(urls[0], new_data1, expect=403, auth=self.get_normal_credentials())
        self.put(urls[1], new_data1, expect=200, auth=self.get_normal_credentials())

        # get back org 1 and see if it changed
        get_result = self.get(urls[1], expect=200, auth=self.get_normal_credentials())
        self.assertEquals(get_result['description'], 'updated description')

        # super user can also put even though they aren't added to the org users or admins list
        self.put(urls[1], new_data1, expect=200, auth=self.get_super_credentials())

        # make sure posting to this URL is not supported
        self.post(urls[1], new_data1, expect=405, auth=self.get_super_credentials())

    def test_put_item_subobjects_projects(self):

        # any attempt to put a subobject should be a 405, edit the actual resource or POST with 'disassociate' to delete
        # this is against a collection URL anyway, so we really need not repeat this test for other object types
        # as a PUT against a collection doesn't make much sense.  
 
        orgs = self.get(self.collection(), expect=200, auth=self.get_super_credentials())
        projects0_url = orgs['results'][0]['related']['projects']
        sub_projects = self.get(projects0_url, expect=200, auth=self.get_super_credentials())
        self.assertEquals(sub_projects['count'], 3)
        first_sub_project = sub_projects['results'][0]
        self.put(projects0_url, first_sub_project, expect=405, auth=self.get_super_credentials())

    def test_delete_item(self):

        # first get some urls
        urls = self.get_urls(self.collection(), auth=self.get_super_credentials())
        urldata1 = self.get(urls[1], auth=self.get_super_credentials())
        
        # check authentication -- admins of the org and superusers can delete objects only
        self.delete(urls[0], expect=401, auth=None)
        self.delete(urls[0], expect=401, auth=self.get_invalid_credentials())
        self.delete(urls[8], expect=403, auth=self.get_normal_credentials())
        self.delete(urls[1], expect=204, auth=self.get_normal_credentials())
        self.delete(urls[0], expect=204, auth=self.get_super_credentials())
      
        # check that when we have deleted an object it comes back 404 via GET
        # but that it's still in the database as inactive
        self.get(urls[1], expect=404, auth=self.get_normal_credentials())
        org1 = Organization.objects.get(pk=urldata1['id'])
        self.assertEquals(org1.active, False)

        # also check that DELETE on the collection doesn't work
        self.delete(self.collection(), expect=405, auth=self.get_super_credentials())

    def test_invalid_post_data(self):
        url = reverse('api:organization_list')
        # API should gracefully handle data of an invalid type.
        self.post(url, expect=400, data=None, auth=self.get_super_credentials())
        self.post(url, expect=400, data=99, auth=self.get_super_credentials())
        self.post(url, expect=400, data='abcd', auth=self.get_super_credentials())
        self.post(url, expect=400, data=3.14, auth=self.get_super_credentials())
        self.post(url, expect=400, data=True, auth=self.get_super_credentials())
        self.post(url, expect=400, data=[1,2,3], auth=self.get_super_credentials())
        url = reverse('api:organization_users_list', args=(self.organizations[0].pk,))
        self.post(url, expect=400, data=None, auth=self.get_super_credentials())
        self.post(url, expect=400, data=99, auth=self.get_super_credentials())
        self.post(url, expect=400, data='abcd', auth=self.get_super_credentials())
        self.post(url, expect=400, data=3.14, auth=self.get_super_credentials())
        self.post(url, expect=400, data=True, auth=self.get_super_credentials())
        self.post(url, expect=400, data=[1,2,3], auth=self.get_super_credentials())

# TODO: tests for tag disassociation
