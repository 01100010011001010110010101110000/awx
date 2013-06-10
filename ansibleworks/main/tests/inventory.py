# Copyright (c) 2013 AnsibleWorks, Inc.
# All Rights Reserved.

import datetime
import json

from django.contrib.auth.models import User as DjangoUser
import django.test
from django.test.client import Client
from ansibleworks.main.models import *
from ansibleworks.main.tests.base import BaseTest

class InventoryTest(BaseTest):

    def setUp(self):

        super(InventoryTest, self).setUp()
        self.setup_users()
        self.organizations = self.make_organizations(self.super_django_user, 3)
        self.organizations[0].admins.add(self.normal_django_user)
        self.organizations[0].users.add(self.other_django_user)
        self.organizations[0].users.add(self.normal_django_user)

        self.inventory_a = Inventory.objects.create(name='inventory-a', description='foo', organization=self.organizations[0])
        self.inventory_b = Inventory.objects.create(name='inventory-b', description='bar', organization=self.organizations[1])
 
        # the normal user is an org admin of org 0

        # create a permission here on the 'other' user so they have edit access on the org
        # we may add another permission type later.
        self.perm_read = Permission.objects.create(
             inventory       = self.inventory_b,
             user            = self.other_django_user,
             permission_type = 'read'
        )

        # and make one more user that won't be a part of any org, just for negative-access testing

        self.nobody_django_user = User.objects.create(username='nobody')
        self.nobody_django_user.set_password('nobody')
        self.nobody_django_user.save()

    def get_nobody_credentials(self):
        # here is a user without any permissions...
        return ('nobody', 'nobody')

    def test_main_line(self):
       
        # some basic URLs... 
        inventories   = '/api/v1/inventories/'
        inventories_1 = '/api/v1/inventories/1/'
        inventories_2 = '/api/v1/inventories/2/'
        hosts         = '/api/v1/hosts/'
        groups        = '/api/v1/groups/'
        variables     = '/api/v1/variables/'

        # a super user can list inventories
        data = self.get(inventories, expect=200, auth=self.get_super_credentials())
        self.assertEquals(data['count'], 2)

        # an org admin can list inventories but is filtered to what he adminsters
        data = self.get(inventories, expect=200, auth=self.get_normal_credentials())
        self.assertEquals(data['count'], 1)

        # a user who is on a team who has a read permissions on an inventory can see filtered inventories
        data = self.get(inventories, expect=200, auth=self.get_other_credentials())
        self.assertEquals(data['count'], 1)      

        # a regular user not part of anything cannot see any inventories
        data = self.get(inventories, expect=200, auth=self.get_nobody_credentials())
        self.assertEquals(data['count'], 0)

        # a super user can get inventory records
        data = self.get(inventories_1, expect=200, auth=self.get_super_credentials())
        self.assertEquals(data['name'], 'inventory-a')

        # an org admin can get inventory records
        data = self.get(inventories_1, expect=200, auth=self.get_normal_credentials())
        self.assertEquals(data['name'], 'inventory-a')

        # a user who is on a team who has read permissions on an inventory can see inventory records
        data = self.get(inventories_1, expect=403, auth=self.get_other_credentials())
        data = self.get(inventories_2, expect=200, auth=self.get_other_credentials())
        self.assertEquals(data['name'], 'inventory-b')

        # a regular user cannot read any inventory records
        data = self.get(inventories_1, expect=403, auth=self.get_nobody_credentials())
        data = self.get(inventories_2, expect=403, auth=self.get_nobody_credentials())

        # a super user can create inventory
        new_inv_1 = dict(name='inventory-c', description='baz', organization=1)
        data = self.post(inventories, data=new_inv_1, expect=201, auth=self.get_super_credentials())
        self.assertEquals(data['id'], 3)

        # an org admin of any org can create inventory, if it is one of his organizations
        # the organization parameter is required!
        new_inv_incomplete = dict(name='inventory-d', description='baz')
        data = self.post(inventories, data=new_inv_incomplete, expect=400,  auth=self.get_normal_credentials())
        new_inv_not_my_org = dict(name='inventory-d', description='baz', organization=3)

        data = self.post(inventories, data=new_inv_not_my_org, expect=403,  auth=self.get_normal_credentials())
        new_inv_my_org = dict(name='inventory-d', description='baz', organization=1)
        data = self.post(inventories, data=new_inv_my_org, expect=201, auth=self.get_normal_credentials())

        # a regular user cannot create inventory
        new_inv_denied = dict(name='inventory-e', description='glorp', organization=1)
        data = self.post(inventories, data=new_inv_denied, expect=403, auth=self.get_other_credentials())

        # a super user can add hosts (but inventory ID is required)
        inv = Inventory.objects.create(
            name = 'test inventory',
            organization = self.organizations[0]
        )
        invalid      = dict(name='asdf0.example.com')
        new_host_a   = dict(name='asdf0.example.com', inventory=inv.pk)
        new_host_b   = dict(name='asdf1.example.com', inventory=inv.pk)
        new_host_c   = dict(name='asdf2.example.com', inventory=inv.pk)
        new_host_d   = dict(name='asdf3.example.com', inventory=inv.pk)
        new_host_e   = dict(name='asdf4.example.com', inventory=inv.pk)
        host_data0 = self.post(hosts, data=invalid, expect=400, auth=self.get_super_credentials())
        host_data0 = self.post(hosts, data=new_host_a, expect=201, auth=self.get_super_credentials())
 
        # an org admin can add hosts
        host_data1 = self.post(hosts, data=new_host_e, expect=201, auth=self.get_normal_credentials())

        # a normal user cannot add hosts
        host_data2 = self.post(hosts, data=new_host_b, expect=403, auth=self.get_nobody_credentials())

        # a normal user with inventory edit permissions (on any inventory) can create hosts
        edit_perm = Permission.objects.create(
             user            = self.other_django_user,
             inventory       = Inventory.objects.get(pk=inv.pk),
             permission_type = PERM_INVENTORY_WRITE
        )
        host_data3 = self.post(hosts, data=new_host_c, expect=201, auth=self.get_other_credentials())

        # hostnames must be unique inside an organization
        host_data4 = self.post(hosts, data=new_host_c, expect=400, auth=self.get_other_credentials())

        ###########################################
        # GROUPS

        invalid       = dict(name='web1')
        new_group_a   = dict(name='web2', inventory=inv.pk)
        new_group_b   = dict(name='web3', inventory=inv.pk)
        new_group_c   = dict(name='web4', inventory=inv.pk)
        new_group_d   = dict(name='web5', inventory=inv.pk)
        new_group_e   = dict(name='web6', inventory=inv.pk)
        groups = '/api/v1/groups/'

        data0 = self.post(groups, data=invalid, expect=400, auth=self.get_super_credentials())
        data0 = self.post(groups, data=new_group_a, expect=201, auth=self.get_super_credentials())

        # an org admin can add hosts
        group_data1 = self.post(groups, data=new_group_e, expect=201, auth=self.get_normal_credentials())

        # a normal user cannot add hosts
        group_data2 = self.post(groups, data=new_group_b, expect=403, auth=self.get_nobody_credentials())

        # a normal user with inventory edit permissions (on any inventory) can create hosts
        # already done!
        #edit_perm = Permission.objects.create(
        #     user            = self.other_django_user,
        #     inventory       = Inventory.objects.get(pk=inv.pk),
        #     permission_type = PERM_INVENTORY_WRITE
        #)       
        group_data3 = self.post(groups, data=new_group_c, expect=201, auth=self.get_other_credentials())
 
        # hostnames must be unique inside an organization
        group_data4 = self.post(groups, data=new_group_c, expect=400, auth=self.get_other_credentials())

        #################################################
        # HOSTS->inventories POST via subcollection
       
        url = '/api/v1/inventories/1/hosts/'
        new_host_a = dict(name='web100.example.com')
        new_host_b = dict(name='web101.example.com')
        new_host_c = dict(name='web102.example.com')
        new_host_d = dict(name='web103.example.com')
        new_host_e = dict(name='web104.example.com')

        # a super user can associate hosts with inventories
        added_by_collection_a = self.post(url, data=new_host_a, expect=201, auth=self.get_super_credentials())

        # an org admin can associate hosts with inventories
        added_by_collection_b = self.post(url, data=new_host_b, expect=201, auth=self.get_normal_credentials())

        # a normal user cannot associate hosts with inventories
        added_by_collection_c = self.post(url, data=new_host_c, expect=403, auth=self.get_nobody_credentials())

        # a normal user with edit permission on the inventory can associate hosts with inventories
        url5 = '/api/v1/inventories/5/hosts/'
        added_by_collection_d = self.post(url5, data=new_host_d, expect=201, auth=self.get_other_credentials())
        got = self.get(url5, expect=200, auth=self.get_other_credentials())
        self.assertEquals(got['count'], 4)

        # now remove the host from inventory (still keeps the record) 
        added_by_collection_d['disassociate'] = 1
        self.post(url5, data=added_by_collection_d, expect=204, auth=self.get_other_credentials())
        got = self.get(url5, expect=200, auth=self.get_other_credentials())
        self.assertEquals(got['count'], 3)


        ##################################################
        # GROUPS->inventories POST via subcollection
        
        root_groups = '/api/v1/inventories/1/root_groups/'
        
        url = '/api/v1/inventories/1/groups/'
        new_group_a = dict(name='web100')
        new_group_b = dict(name='web101')
        new_group_c = dict(name='web102')
        new_group_d = dict(name='web103')
        new_group_e = dict(name='web104')

        # a super user can associate groups with inventories
        added_by_collection = self.post(url, data=new_group_a, expect=201, auth=self.get_super_credentials())

        # an org admin can associate groups with inventories
        added_by_collection = self.post(url, data=new_group_b, expect=201, auth=self.get_normal_credentials())

        # a normal user cannot associate groups with inventories
        added_by_collection = self.post(url, data=new_group_c, expect=403, auth=self.get_nobody_credentials())

        # a normal user with edit permissions on the inventory can associate groups with inventories
        url5 = '/api/v1/inventories/5/groups/'
        added_by_collection = self.post(url5, data=new_group_d, expect=201, auth=self.get_other_credentials())
        # make sure duplicates give 400s
        self.post(url5, data=new_group_d, expect=400, auth=self.get_other_credentials())
        got = self.get(url5, expect=200, auth=self.get_other_credentials())
        self.assertEquals(got['count'], 4)
        
        # side check: see if root groups URL is operational.  These are groups without parents.
        root_groups = self.get(root_groups, expect=200, auth=self.get_super_credentials())
        self.assertEquals(root_groups['count'], 2)

        remove_me = added_by_collection
        remove_me['disassociate'] = 1
        self.post(url5, data=remove_me, expect=204, auth=self.get_other_credentials())
        got = self.get(url5, expect=200, auth=self.get_other_credentials())
        self.assertEquals(got['count'], 3)

        ###################################################
        # VARIABLES

        vars_a = dict(asdf=1234, dog='fido',  cat='fluffy', unstructured=dict(a=[1,2,3],b=dict(x=2,y=3)))
        vars_b = dict(asdf=4321, dog='barky', cat='snarf',  unstructured=dict(a=[1,2,3],b=dict(x=2,y=3)))
        vars_c = dict(asdf=5555, dog='mouse', cat='mogwai', unstructured=dict(a=[3,0,3],b=dict(z=2600)))

        # attempting to get a variable object creates it, even though it does not already exist
        vdata_url = "/api/v1/hosts/%s/variable_data/" % (added_by_collection_a['id'])
        got = self.get(vdata_url, expect=200, auth=self.get_super_credentials())
        self.assertEquals(got, {})

        # super user can create variable objects
        # an org admin can create variable objects (defers to inventory permissions)
        got = self.put(vdata_url, data=vars_a, expect=200, auth=self.get_super_credentials())
        self.assertEquals(got, vars_a) 

        # verify that we can update things and get them back    
        got = self.put(vdata_url, data=vars_c, expect=200, auth=self.get_super_credentials())
        self.assertEquals(got, vars_c)    
        got = self.get(vdata_url, expect=200, auth=self.get_super_credentials())
        self.assertEquals(got, vars_c)    

        # a normal user cannot edit variable objects
        self.put(vdata_url, data=vars_a, expect=403, auth=self.get_nobody_credentials())

        # a normal user with inventory write permissions can edit variable objects
        #vdata_url = "/api/v1/hosts/1/variable_data/" 
        #got = self.put(vdata_url, data=vars_b, expect=200, auth=self.get_normal_credentials())
        #self.assertEquals(got, vars_b)        

        # this URL is not one end users will use, but is what you get back from a put
        # as a result, it also needs to be access controlled and working.  You will not
        # be able to put to it.
        #backend_url = '/api/v1/variable_data/1/'
        #got = self.get(backend_url, expect=200, auth=self.get_normal_credentials())
        #got = self.put(backend_url, data=dict(), expect=403, auth=self.get_super_credentials())

        ###################################################
        # VARIABLES -> GROUPS
        
        vars_a = dict(asdf=7777, dog='droopy',   cat='battlecat', unstructured=dict(a=[1,1,1],b=dict(x=1,y=2)))
        vars_b = dict(asdf=8888, dog='snoopy',   cat='cheshire',  unstructured=dict(a=[2,2,2],b=dict(x=3,y=4)))
        vars_c = dict(asdf=9999, dog='pluto',    cat='five',      unstructured=dict(a=[3,3,3],b=dict(z=5)))
        groups = Group.objects.all()
         
        vdata1_url = "/api/v1/groups/%s/variable_data/" % (groups[0].pk)
        vdata2_url = "/api/v1/groups/%s/variable_data/" % (groups[1].pk)

        # a super user can associate variable objects with groups
        got = self.get(vdata1_url, expect=200, auth=self.get_super_credentials())
        self.assertEquals(got, {})
        put = self.put(vdata1_url, data=vars_a, expect=200, auth=self.get_super_credentials())
        self.assertEquals(put, vars_a)

        # an org admin can associate variable objects with groups
        put = self.put(vdata1_url, data=vars_b, expect=200, auth=self.get_normal_credentials())
 
        # a normal user cannot associate variable objects with groups
        put = self.put(vdata1_url, data=vars_b, expect=403, auth=self.get_nobody_credentials())

        # a normal user with inventory edit permissions can associate variable objects with groups
        put = self.put(vdata1_url, data=vars_c, expect=200, auth=self.get_normal_credentials())
        self.assertEquals(put, vars_c)


        ####################################################
        # ADDING HOSTS TO GROUPS

        groups = Group.objects.all()
        hosts = Host.objects.all()
        groups[0].hosts.add(Host.objects.get(pk=1))
        groups[0].hosts.add(Host.objects.get(pk=3)) 
        groups[0].save()

        # access        
        url1 = '/api/v1/groups/1/hosts/'
        data = self.get(url1, expect=200, auth=self.get_normal_credentials())
        self.assertEquals(data['count'], 2)
        self.assertEquals(data['results'][0]['id'], 1)
        self.assertEquals(data['results'][1]['id'], 3)

        # addition
        got = self.get('/api/v1/hosts/2/', expect=200, auth=self.get_normal_credentials())
        self.assertEquals(got['id'], 2)
        posted = self.post('/api/v1/groups/1/hosts/', data=got, expect=204, auth=self.get_normal_credentials())
        data = self.get(url1, expect=200, auth=self.get_normal_credentials())
        self.assertEquals(data['count'], 3)
        self.assertEquals(data['results'][1]['id'], 2)

        # now add one new completely new host, to test creation+association in one go
        new_host = dict(inventory=got['inventory'], name='completelynewhost.example.com', description='...')
        posted = self.post('/api/v1/groups/1/hosts/', data=new_host, expect=201, auth=self.get_normal_credentials())
        
        data = self.get(url1, expect=200, auth=self.get_normal_credentials())
        self.assertEquals(data['count'], 4)

        # removal
        got['disassociate'] = 1
        posted = self.post('/api/v1/groups/1/hosts/', data=got, expect=204, auth=self.get_normal_credentials())
        data = self.get(url1, expect=200, auth=self.get_normal_credentials())
        self.assertEquals(data['count'], 3)
        self.assertEquals(data['results'][1]['id'], 3)

        ####################################################
        # SUBGROUPS

        groups = Group.objects.all()

        # just some more groups for kicks
        inv  = Inventory.objects.get(pk=1)
        Group.objects.create(name='group-X1', inventory=inv)
        Group.objects.create(name='group-X2', inventory=inv)
        Group.objects.create(name='group-X3', inventory=inv)
        Group.objects.create(name='group-X4', inventory=inv)
        Group.objects.create(name='group-X5', inventory=inv)

        Permission.objects.create(
            inventory       = inv,
            user            = self.other_django_user,
            permission_type = PERM_INVENTORY_WRITE
        )

        # data used for testing listing all hosts that are transitive members of a group
        g2 = Group.objects.get(pk=2)
        nh = Host.objects.create(name='newhost.example.com', inventory=inv, created_by=User.objects.get(pk=1))
        g2.hosts.add(nh)
        g2.save()

        # a super user can set subgroups
        subgroups_url     = '/api/v1/groups/1/children/'
        child_url         = '/api/v1/groups/2/'
        subgroups_url2    = '/api/v1/groups/3/children/'
        subgroups_url3    = '/api/v1/groups/4/children/'
        subgroups_url4    = '/api/v1/groups/5/children/'
        got = self.get(child_url, expect=200, auth=self.get_super_credentials())
        self.post(subgroups_url, data=got, expect=204, auth=self.get_super_credentials())
        kids = Group.objects.get(pk=1).children.all()
        self.assertEqual(len(kids), 1)
        checked = self.get(subgroups_url, expect=200, auth=self.get_super_credentials())
        self.assertEquals(checked['count'], 1)

        # an org admin can set subgroups
        posted = self.post(subgroups_url2, data=got, expect=204, auth=self.get_normal_credentials())

        # see if we can post a completely new subgroup
        new_data = dict(inventory=5, name='completely new', description='blarg?')
        kids = self.get(subgroups_url2, expect=200, auth=self.get_normal_credentials())
        self.assertEqual(kids['count'], 1)
        posted2 = self.post(subgroups_url2, data=new_data, expect=201, auth=self.get_normal_credentials()) 
        with_one_more_kid = self.get(subgroups_url2, expect=200, auth=self.get_normal_credentials())
        self.assertEqual(with_one_more_kid['count'], 2)

        # double post causes conflict error (actually, should it? -- just got a 204, already associated)
        # self.post(subgroups_url2, data=got, expect=409, auth=self.get_normal_credentials())
        checked = self.get(subgroups_url2, expect=200, auth=self.get_normal_credentials()) 

        # a normal user cannot set subgroups
        self.post(subgroups_url3, data=got, expect=403, auth=self.get_nobody_credentials())

        # a normal user with inventory edit permissions can associate subgroups
        self.post(subgroups_url3, data=got, expect=204, auth=self.get_other_credentials())
        checked = self.get(subgroups_url3, expect=200, auth=self.get_normal_credentials()) 
        self.assertEqual(checked['count'], 1)
        
        # slight detour
        # can see all hosts under a group, even if it has subgroups
        # this URL is NOT postable
        all_hosts = '/api/v1/groups/1/all_hosts/'
        self.assertEqual(Group.objects.get(pk=1).hosts.count(), 3)
        data = self.get(all_hosts, expect=200, auth=self.get_normal_credentials())
        self.post(all_hosts, data=dict(id=123456, msg='spam'), expect=405, auth=self.get_normal_credentials())
        self.assertEquals(data['count'], 4)

        # now post it back to remove it, by adding the disassociate bit
        result = checked['results'][0]
        result['disassociate'] = 1
        self.post(subgroups_url3, data=result, expect=204, auth=self.get_other_credentials())
        checked = self.get(subgroups_url3, expect=200, auth=self.get_normal_credentials()) 
        self.assertEqual(checked['count'], 0)
        # try to double disassociate to see what happens (should no-op)
        self.post(subgroups_url3, data=result, expect=204, auth=self.get_other_credentials())

        #########################################################
        # FIXME: TAGS

        # the following objects can be tagged and the tags can be read
        #    inventory
        #    host records
        #    group records
        #    variable records
        # this may just be in a seperate test file called 'tags'

        #########################################################
        # FIXME: RELATED FIELDS

        #  on an inventory resource, I can see related resources for hosts and groups and permissions
        #  and these work 
        #  on a host resource, I can see related resources variables and inventories
        #  and these work
        #  on a group resource, I can see related resources for variables, inventories, and children
        #  and these work
                
    def test_group_parents_and_children(self):
        # Test for various levels of group parent/child relations, with hosts,
        # to verify that helper properties return the correct querysets.

        # Group A is parent of B, B is parent of C, C is parent of D. Group E
        # is part of the inventory, but outside of the ABCD tree.
        g_a = self.inventory_a.groups.create(name='A')
        g_b = self.inventory_a.groups.create(name='B')
        g_b.parents.add(g_a)
        g_c = self.inventory_a.groups.create(name='C')
        g_c.parents.add(g_b)
        g_d = self.inventory_a.groups.create(name='D')
        g_d.parents.add(g_c)
        g_e = self.inventory_a.groups.create(name='E')
        # Each group "X" contains one host "x".
        h_a = self.inventory_a.hosts.create(name='a')
        h_a.groups.add(g_a)
        h_b = self.inventory_a.hosts.create(name='b')
        h_b.groups.add(g_b)
        h_c = self.inventory_a.hosts.create(name='c')
        h_c.groups.add(g_c)
        h_d = self.inventory_a.hosts.create(name='d')
        h_d.groups.add(g_d)
        h_e = self.inventory_a.hosts.create(name='e')
        h_e.groups.add(g_e)
        # Test all_children property on groups.
        self.assertEqual(set(g_a.all_children.values_list('pk', flat=True)),
                         set([g_b.pk, g_c.pk, g_d.pk]))
        self.assertEqual(set(g_b.all_children.values_list('pk', flat=True)),
                         set([g_c.pk, g_d.pk]))
        self.assertEqual(set(g_c.all_children.values_list('pk', flat=True)),
                         set([g_d.pk]))
        self.assertEqual(set(g_d.all_children.values_list('pk', flat=True)),
                         set([]))
        self.assertEqual(set(g_e.all_children.values_list('pk', flat=True)),
                         set([]))
        # Test all_parents property on groups.
        self.assertEqual(set(g_a.all_parents.values_list('pk', flat=True)),
                         set([]))
        self.assertEqual(set(g_b.all_parents.values_list('pk', flat=True)),
                         set([g_a.pk]))
        self.assertEqual(set(g_c.all_parents.values_list('pk', flat=True)),
                         set([g_a.pk, g_b.pk]))
        self.assertEqual(set(g_d.all_parents.values_list('pk', flat=True)),
                         set([g_a.pk, g_b.pk, g_c.pk]))
        self.assertEqual(set(g_e.all_parents.values_list('pk', flat=True)),
                         set([]))
        # Test all_hosts property on groups.
        self.assertEqual(set(g_a.all_hosts.values_list('pk', flat=True)),
                         set([h_a.pk, h_b.pk, h_c.pk, h_d.pk]))
        self.assertEqual(set(g_b.all_hosts.values_list('pk', flat=True)),
                         set([h_b.pk, h_c.pk, h_d.pk]))
        self.assertEqual(set(g_c.all_hosts.values_list('pk', flat=True)),
                         set([h_c.pk, h_d.pk]))
        self.assertEqual(set(g_d.all_hosts.values_list('pk', flat=True)),
                         set([h_d.pk]))
        self.assertEqual(set(g_e.all_hosts.values_list('pk', flat=True)),
                         set([h_e.pk]))
        # Test all_groups property on hosts.
        self.assertEqual(set(h_a.all_groups.values_list('pk', flat=True)),
                         set([g_a.pk]))
        self.assertEqual(set(h_b.all_groups.values_list('pk', flat=True)),
                         set([g_a.pk, g_b.pk]))
        self.assertEqual(set(h_c.all_groups.values_list('pk', flat=True)),
                         set([g_a.pk, g_b.pk, g_c.pk]))
        self.assertEqual(set(h_d.all_groups.values_list('pk', flat=True)),
                         set([g_a.pk, g_b.pk, g_c.pk, g_d.pk]))
        self.assertEqual(set(h_e.all_groups.values_list('pk', flat=True)),
                         set([g_e.pk]))
        # Now create a circular relationship from D back to A.
        g_a.parents.add(g_d)
        # All groups "ABCD" should be parents of each other, and children of
        # each other, and contain all hosts "abcd".
        for g in [g_a, g_b, g_c, g_d]:
            self.assertEqual(set(g.all_children.values_list('pk', flat=True)),
                             set([g_a.pk, g_b.pk, g_c.pk, g_d.pk]))
            self.assertEqual(set(g.all_parents.values_list('pk', flat=True)),
                             set([g_a.pk, g_b.pk, g_c.pk, g_d.pk]))
            self.assertEqual(set(g.all_hosts.values_list('pk', flat=True)),
                             set([h_a.pk, h_b.pk, h_c.pk, h_d.pk]))
        # All hosts "abcd" should be members of all groups "ABCD".
        for h in [h_a, h_b, h_c, h_d]:
            self.assertEqual(set(h.all_groups.values_list('pk', flat=True)),
                             set([g_a.pk, g_b.pk, g_c.pk, g_d.pk]))
        # Group E and host e should not be affected.
        self.assertEqual(set(g_e.all_children.values_list('pk', flat=True)),
                         set([]))
        self.assertEqual(set(g_e.all_parents.values_list('pk', flat=True)),
                         set([]))
        self.assertEqual(set(g_e.all_hosts.values_list('pk', flat=True)),
                         set([h_e.pk]))
        self.assertEqual(set(h_e.all_groups.values_list('pk', flat=True)),
                         set([g_e.pk]))
