# Copyright (c) 2013 AnsibleWorks, Inc.
# All Rights Reserved.

# Python
import json
import os
import shutil
import StringIO
import sys
import tempfile
import time
import urlparse

# Django
from django.conf import settings
from django.contrib.auth.models import User
from django.core.management import call_command
from django.core.management.base import CommandError
from django.utils.timezone import now
from django.test.utils import override_settings

# AWX
from awx.main.licenses import LicenseWriter
from awx.main.models import *
from awx.main.tests.base import BaseTest, BaseLiveServerTest

__all__ = ['DumpDataTest', 'CleanupDeletedTest', 'CleanupJobsTest',
           'InventoryImportTest']

TEST_PLAYBOOK = '''- hosts: test-group
  gather_facts: False
  tasks:
  - name: should pass
    command: test 1 = 1
  - name: should also pass
    command: test 2 = 2
'''

TEST_INVENTORY_INI = '''\
[webservers]
web1.example.com ansible_ssh_host=w1.example.net
web2.example.com
web3.example.com

[webservers:vars]
webvar=blah

[dbservers]
db1.example.com
db2.example.com

[dbservers:vars]
dbvar=ugh

[servers:children]
webservers
dbservers

[servers:vars]
varb=B

[all:vars]
vara=A
'''

TEST_GROUP_VARS = '''\
test_username: test
test_email: test@example.com
'''

class BaseCommandMixin(object):
    '''
    Base class for tests that run management commands.
    '''

    def setUp(self):
        super(BaseCommandMixin, self).setUp()
        self._sys_path = [x for x in sys.path]
        self._environ = dict(os.environ.items())
        self._temp_files = []

    def tearDown(self):
        super(BaseCommandMixin, self).tearDown()
        sys.path = self._sys_path
        for k,v in self._environ.items():
            if os.environ.get(k, None) != v:
                os.environ[k] = v
        for k,v in os.environ.items():
            if k not in self._environ.keys():
                del os.environ[k]
        for tf in self._temp_files:
            if os.path.exists(tf):
                os.remove(tf)

    def create_test_inventories(self):
        self.setup_users()
        self.organizations = self.make_organizations(self.super_django_user, 2)
        self.projects = self.make_projects(self.normal_django_user, 2)
        self.organizations[0].projects.add(self.projects[1])
        self.organizations[1].projects.add(self.projects[0])
        self.inventories = []
        self.hosts = []
        self.groups = []
        for n, organization in enumerate(self.organizations):
            inventory = Inventory.objects.create(name='inventory-%d' % n,
                                                 description='description for inventory %d' % n,
                                                 organization=organization,
                                                 variables=json.dumps({'n': n}) if n else '')
            self.inventories.append(inventory)
            hosts = []
            for x in xrange(10):
                if n > 0:
                    variables = json.dumps({'ho': 'hum-%d' % x})
                else:
                    variables = ''
                host = inventory.hosts.create(name='host-%02d-%02d.example.com' % (n, x),
                                              inventory=inventory,
                                              variables=variables)
                hosts.append(host)
            self.hosts.extend(hosts)
            groups = []
            for x in xrange(5):
                if n > 0:
                    variables = json.dumps({'gee': 'whiz-%d' % x})
                else:
                    variables = ''
                group = inventory.groups.create(name='group-%d' % x,
                                                inventory=inventory,
                                                variables=variables)
                groups.append(group)
                group.hosts.add(hosts[x])
                group.hosts.add(hosts[x + 5])
                if n > 0 and x == 4:
                    group.parents.add(groups[3])
            self.groups.extend(groups)

    def run_command(self, name, *args, **options):
        '''
        Run a management command and capture its stdout/stderr along with any
        exceptions.
        '''
        command_runner = options.pop('command_runner', call_command)
        stdin_fileobj = options.pop('stdin_fileobj', None)
        options.setdefault('verbosity', 1)
        options.setdefault('interactive', False)
        original_stdin = sys.stdin
        original_stdout = sys.stdout
        original_stderr = sys.stderr
        if stdin_fileobj:
            sys.stdin = stdin_fileobj
        sys.stdout = StringIO.StringIO()
        sys.stderr = StringIO.StringIO()
        result = None
        try:
            result = command_runner(name, *args, **options)
        except Exception, e:
            result = e
        except SystemExit, e:
            result = e
        finally:
            captured_stdout = sys.stdout.getvalue()
            captured_stderr = sys.stderr.getvalue()
            sys.stdin = original_stdin
            sys.stdout = original_stdout
            sys.stderr = original_stderr
        # For Django 1.4.x, convert sys.exit(1) and stderr message to the
        # CommandError(msg) exception used by Django 1.5 and later.
        if isinstance(result, SystemExit) and captured_stderr:
            result = CommandError(captured_stderr)
        return result, captured_stdout, captured_stderr

class DumpDataTest(BaseCommandMixin, BaseTest):
    '''
    Test cases for dumpdata management command.
    '''

    def setUp(self):
        super(DumpDataTest, self).setUp()
        self.create_test_inventories()

    def test_dumpdata(self):
        result, stdout, stderr = self.run_command('dumpdata')
        self.assertEqual(result, None)
        data = json.loads(stdout)

class CleanupDeletedTest(BaseCommandMixin, BaseTest):
    '''
    Test cases for cleanup_deleted management command.
    '''

    def setUp(self):
        super(CleanupDeletedTest, self).setUp()
        self.create_test_inventories()

    def get_model_counts(self):
        def get_models(m):
            if not m._meta.abstract:
                yield m
            for sub in m.__subclasses__():
                for subm in get_models(sub):
                    yield subm
        counts = {}
        for model in get_models(PrimordialModel):
            active = model.objects.filter(active=True).count()
            inactive = model.objects.filter(active=False).count()
            counts[model] = (active, inactive)
        return counts

    def test_cleanup_our_models(self):
        # Test with nothing to be deleted.
        counts_before = self.get_model_counts()
        self.assertFalse(sum(x[1] for x in counts_before.values()))
        result, stdout, stderr = self.run_command('cleanup_deleted')
        self.assertEqual(result, None)
        counts_after = self.get_model_counts()
        self.assertEqual(counts_before, counts_after)
        # "Delete" some hosts.
        for host in Host.objects.all():
            host.mark_inactive()
        # With no parameters, "days" defaults to 90, which won't cleanup any of
        # the hosts we just removed.
        counts_before = self.get_model_counts()
        self.assertTrue(sum(x[1] for x in counts_before.values()))
        result, stdout, stderr = self.run_command('cleanup_deleted')
        self.assertEqual(result, None)
        counts_after = self.get_model_counts()
        self.assertEqual(counts_before, counts_after)
        # Even with days=1, the hosts will remain.
        counts_before = self.get_model_counts()
        self.assertTrue(sum(x[1] for x in counts_before.values()))
        result, stdout, stderr = self.run_command('cleanup_deleted', days=1)
        self.assertEqual(result, None)
        counts_after = self.get_model_counts()
        self.assertEqual(counts_before, counts_after)
        # With days=0, the hosts will be deleted.
        counts_before = self.get_model_counts()
        self.assertTrue(sum(x[1] for x in counts_before.values()))
        result, stdout, stderr = self.run_command('cleanup_deleted', days=0)
        self.assertEqual(result, None)
        counts_after = self.get_model_counts()
        self.assertNotEqual(counts_before, counts_after)
        self.assertFalse(sum(x[1] for x in counts_after.values()))

    def get_user_counts(self):
        active = User.objects.filter(is_active=True).count()
        inactive = User.objects.filter(is_active=False).count()
        return active, inactive

    def test_cleanup_user_model(self):
        # Test with nothing to be deleted.
        counts_before = self.get_user_counts()
        self.assertFalse(counts_before[1])
        result, stdout, stderr = self.run_command('cleanup_deleted')
        self.assertEqual(result, None)
        counts_after = self.get_user_counts()
        self.assertEqual(counts_before, counts_after)
        # "Delete some users".
        for user in User.objects.all():
            user.mark_inactive()
            self.assertTrue(len(user.username) <= 30,
                            'len(%r) == %d' % (user.username, len(user.username)))
        # With days=1, no users will be deleted.
        counts_before = self.get_user_counts()
        self.assertTrue(counts_before[1])
        result, stdout, stderr = self.run_command('cleanup_deleted', days=1)
        self.assertEqual(result, None)
        counts_after = self.get_user_counts()
        self.assertEqual(counts_before, counts_after)
        # With days=0, inactive users will be deleted.
        counts_before = self.get_user_counts()
        self.assertTrue(counts_before[1])
        result, stdout, stderr = self.run_command('cleanup_deleted', days=0)
        self.assertEqual(result, None)
        counts_after = self.get_user_counts()
        self.assertNotEqual(counts_before, counts_after)
        self.assertFalse(counts_after[1])

@override_settings(CELERY_ALWAYS_EAGER=True,
                   CELERY_EAGER_PROPAGATES_EXCEPTIONS=True,
                   ANSIBLE_TRANSPORT='local')
class CleanupJobsTest(BaseCommandMixin, BaseLiveServerTest):
    '''
    Test cases for cleanup_jobs management command.
    '''

    def setUp(self):
        super(CleanupJobsTest, self).setUp()
        self.test_project_path = None
        self.setup_users()
        self.organization = self.make_organizations(self.super_django_user, 1)[0]
        self.inventory = Inventory.objects.create(name='test-inventory',
                                                  description='description for test-inventory',
                                                  organization=self.organization)
        self.host = self.inventory.hosts.create(name='host.example.com',
                                                inventory=self.inventory)
        self.group = self.inventory.groups.create(name='test-group',
                                                  inventory=self.inventory)
        self.group.hosts.add(self.host)
        self.project = None
        self.credential = None
        settings.INTERNAL_API_URL = self.live_server_url

    def tearDown(self):
        super(CleanupJobsTest, self).tearDown()
        if self.test_project_path:
            shutil.rmtree(self.test_project_path, True)

    def create_test_credential(self, **kwargs):
        opts = {
            'name': 'test-creds',
            'user': self.super_django_user,
            'ssh_username': '',
            'ssh_key_data': '',
            'ssh_key_unlock': '',
            'ssh_password': '',
            'sudo_username': '',
            'sudo_password': '',
        }
        opts.update(kwargs)
        self.credential = Credential.objects.create(**opts)
        return self.credential

    def create_test_project(self, playbook_content):
        self.project = self.make_projects(self.normal_django_user, 1, playbook_content)[0]
        self.organization.projects.add(self.project)

    def create_test_job_template(self, **kwargs):
        opts = {
            'name': 'test-job-template %s' % str(now()),
            'inventory': self.inventory,
            'project': self.project,
            'credential': self.credential,
            'job_type': 'run',
        }
        try:
            opts['playbook'] = self.project.playbooks[0]
        except (AttributeError, IndexError):
            pass
        opts.update(kwargs)
        self.job_template = JobTemplate.objects.create(**opts)
        return self.job_template

    def create_test_job(self, **kwargs):
        job_template = kwargs.pop('job_template', None)
        if job_template:
            self.job = job_template.create_job(**kwargs)
        else:
            opts = {
                'name': 'test-job %s' % str(now()),
                'inventory': self.inventory,
                'project': self.project,
                'credential': self.credential,
                'job_type': 'run',
            }
            try:
                opts['playbook'] = self.project.playbooks[0]
            except (AttributeError, IndexError):
                pass
            opts.update(kwargs)
            self.job = Job.objects.create(**opts)
        return self.job

    def test_cleanup_jobs(self):
        # Test with no jobs to be cleaned up.
        jobs_before = Job.objects.all().count()
        self.assertFalse(jobs_before)
        result, stdout, stderr = self.run_command('cleanup_jobs')
        self.assertEqual(result, None)
        jobs_after = Job.objects.all().count()
        self.assertEqual(jobs_before, jobs_after)        
        # Create and run job.
        self.create_test_project(TEST_PLAYBOOK)
        job_template = self.create_test_job_template()
        job = self.create_test_job(job_template=job_template)
        self.assertEqual(job.status, 'new')
        self.assertFalse(job.passwords_needed_to_start)
        self.assertTrue(job.start())
        self.assertEqual(job.status, 'pending')
        job = Job.objects.get(pk=job.pk)
        self.assertEqual(job.status, 'successful')
        # With days=1, no jobs will be deleted.
        jobs_before = Job.objects.all().count()
        self.assertTrue(jobs_before)
        result, stdout, stderr = self.run_command('cleanup_jobs', days=1)
        self.assertEqual(result, None)
        jobs_after = Job.objects.all().count()
        self.assertEqual(jobs_before, jobs_after)
        # With days=0 and dry_run=True, no jobs will be deleted.
        jobs_before = Job.objects.all().count()
        self.assertTrue(jobs_before)
        result, stdout, stderr = self.run_command('cleanup_jobs', days=0,
                                                  dry_run=True)
        self.assertEqual(result, None)
        jobs_after = Job.objects.all().count()
        self.assertEqual(jobs_before, jobs_after)
        # With days=0, our job will be deleted.
        jobs_before = Job.objects.all().count()
        self.assertTrue(jobs_before)
        result, stdout, stderr = self.run_command('cleanup_jobs', days=0)
        self.assertEqual(result, None)
        jobs_after = Job.objects.all().count()
        self.assertNotEqual(jobs_before, jobs_after)
        self.assertFalse(jobs_after)

class InventoryImportTest(BaseCommandMixin, BaseLiveServerTest):
    '''
    Test cases for inventory_import management command.
    '''

    def setUp(self):
        super(InventoryImportTest, self).setUp()
        self.create_test_inventories()
        self.create_test_ini()
        self.create_test_license_file()

    def create_test_license_file(self):
        writer = LicenseWriter( 
           company_name='AWX',
           contact_name='AWX Admin',
           contact_email='awx@example.com',
           license_date=int(time.time() + 3600),
           instance_count=500,
        )
        handle, license_path = tempfile.mkstemp(suffix='.json')
        os.close(handle)
        writer.write_file(license_path)
        self._temp_files.append(license_path)
        os.environ['AWX_LICENSE_FILE'] = license_path

    def create_test_ini(self, inv_dir=None):
        handle, self.ini_path = tempfile.mkstemp(suffix='.txt', dir=inv_dir)
        ini_file = os.fdopen(handle, 'w')
        ini_file.write(TEST_INVENTORY_INI)
        ini_file.close()
        self._temp_files.append(self.ini_path)

    def create_test_dir(self):
        self.inv_dir = tempfile.mkdtemp()
        self._temp_project_dirs.append(self.inv_dir)
        self.create_test_ini(self.inv_dir)
        group_vars = os.path.join(self.inv_dir, 'group_vars')
        os.makedirs(group_vars)
        file(os.path.join(group_vars, 'all'), 'wb').write(TEST_GROUP_VARS)

    def test_invalid_options(self):
        inventory_id = self.inventories[0].pk
        inventory_name = self.inventories[0].name
        # No options specified.
        result, stdout, stderr = self.run_command('inventory_import')
        self.assertTrue(isinstance(result, CommandError), result)
        self.assertTrue('inventory-id' in str(result))
        self.assertTrue('required' in str(result))
        # Both inventory ID and name.
        result, stdout, stderr = self.run_command('inventory_import',
                                                  inventory_id=inventory_id,
                                                  inventory_name=inventory_name)
        self.assertTrue(isinstance(result, CommandError), result)
        self.assertTrue('inventory-id' in str(result))
        self.assertTrue('exclusive' in str(result))
        # Inventory ID with overwrite and keep_vars.
        result, stdout, stderr = self.run_command('inventory_import',
                                                  inventory_id=inventory_id,
                                                  overwrite=True, keep_vars=True)
        self.assertTrue(isinstance(result, CommandError), result)
        self.assertTrue('overwrite-vars' in str(result))
        self.assertTrue('exclusive' in str(result))
        result, stdout, stderr = self.run_command('inventory_import',
                                                  inventory_id=inventory_id,
                                                  overwrite_vars=True,
                                                  keep_vars=True)
        self.assertTrue(isinstance(result, CommandError), result)
        self.assertTrue('overwrite-vars' in str(result))
        self.assertTrue('exclusive' in str(result))
        # Inventory ID, but no source.
        result, stdout, stderr = self.run_command('inventory_import',
                                                  inventory_id=inventory_id)
        self.assertTrue(isinstance(result, CommandError), result)
        self.assertTrue('--source' in str(result))
        self.assertTrue('required' in str(result))
        # Inventory ID, with invalid source.
        invalid_source = ''.join([os.path.splitext(self.ini_path)[0] + '-invalid',
                                  os.path.splitext(self.ini_path)[1]]) 
        result, stdout, stderr = self.run_command('inventory_import',
                                                  inventory_id=inventory_id,
                                                  source=invalid_source)
        self.assertTrue(isinstance(result, CommandError), result)
        self.assertTrue('not exist' in str(result))
        # Invalid inventory ID.
        invalid_id = Inventory.objects.order_by('-pk')[0].pk + 1
        result, stdout, stderr = self.run_command('inventory_import',
                                                  inventory_id=invalid_id,
                                                  source=self.ini_path)
        self.assertTrue(isinstance(result, CommandError), result)
        self.assertTrue('matched' in str(result))
        # Invalid inventory name.
        invalid_name = 'invalid inventory name'
        result, stdout, stderr = self.run_command('inventory_import',
                                                  inventory_name=invalid_name,
                                                  source=self.ini_path)
        self.assertTrue(isinstance(result, CommandError), result)
        self.assertTrue('matched' in str(result))

    def test_ini_file(self, source=None):
        inv_src = source or self.ini_path
        # New empty inventory.
        new_inv = self.organizations[0].inventories.create(name='newb')
        self.assertEqual(new_inv.hosts.count(), 0)
        self.assertEqual(new_inv.groups.count(), 0)
        result, stdout, stderr = self.run_command('inventory_import',
                                                  inventory_id=new_inv.pk,
                                                  source=inv_src)
        self.assertEqual(result, None)
        # Check that inventory is populated as expected.
        new_inv = Inventory.objects.get(pk=new_inv.pk)
        expected_group_names = set(['servers', 'dbservers', 'webservers'])
        group_names = set(new_inv.groups.values_list('name', flat=True))
        self.assertEqual(expected_group_names, group_names)
        expected_host_names = set(['web1.example.com', 'web2.example.com',
                                   'web3.example.com', 'db1.example.com',
                                   'db2.example.com'])
        host_names = set(new_inv.hosts.values_list('name', flat=True))
        self.assertEqual(expected_host_names, host_names)
        if source:
            self.assertEqual(new_inv.variables_dict, {
                'vara': 'A',
                'test_username': 'test',
                'test_email': 'test@example.com',
            })
        else:
            self.assertEqual(new_inv.variables_dict, {'vara': 'A'})
        for host in new_inv.hosts.all():
            if host.name == 'web1.example.com':
                self.assertEqual(host.variables_dict,
                                {'ansible_ssh_host': 'w1.example.net'})
            else:
                self.assertEqual(host.variables_dict, {})
        for group in new_inv.groups.all():
            if group.name == 'servers':
                self.assertEqual(group.variables_dict, {'varb': 'B'})
                children = set(group.children.values_list('name', flat=True))
                self.assertEqual(children, set(['dbservers', 'webservers']))
                self.assertEqual(group.hosts.count(), 0)
            elif group.name == 'dbservers':
                self.assertEqual(group.variables_dict, {'dbvar': 'ugh'})
                self.assertEqual(group.children.count(), 0)
                hosts = set(group.hosts.values_list('name', flat=True))
                host_names = set(['db1.example.com','db2.example.com'])
                self.assertEqual(hosts, host_names)                
            elif group.name == 'webservers':
                self.assertEqual(group.variables_dict, {'webvar': 'blah'})
                self.assertEqual(group.children.count(), 0)
                hosts = set(group.hosts.values_list('name', flat=True))
                host_names = set(['web1.example.com','web2.example.com',
                                  'web3.example.com'])
                self.assertEqual(hosts, host_names)

    def test_dir_with_ini_file(self):
        self.create_test_dir()
        self.test_ini_file(self.inv_dir)

    def test_executable_file(self):
        # New empty inventory.
        old_inv = self.inventories[1]
        new_inv = self.organizations[0].inventories.create(name='newb')
        self.assertEqual(new_inv.hosts.count(), 0)
        self.assertEqual(new_inv.groups.count(), 0)
        # Use our own inventory script as executable file.
        rest_api_url = self.live_server_url
        parts = urlparse.urlsplit(rest_api_url)
        username, password = self.get_super_credentials()
        netloc = '%s:%s@%s' % (username, password, parts.netloc)
        rest_api_url = urlparse.urlunsplit([parts.scheme, netloc, parts.path,
                                            parts.query, parts.fragment])
        os.environ.setdefault('REST_API_URL', rest_api_url)
        #os.environ.setdefault('REST_API_TOKEN',
        #                      self.super_django_user.auth_token.key)
        os.environ['INVENTORY_ID'] = str(old_inv.pk)        
        source = os.path.join(os.path.dirname(__file__), '..', '..', 'scripts',
                              'inventory.py')
        result, stdout, stderr = self.run_command('inventory_import',
                                                  inventory_id=new_inv.pk,
                                                  source=source)
        self.assertEqual(result, None)
        # Check that inventory is populated as expected.
        new_inv = Inventory.objects.get(pk=new_inv.pk)
        self.assertEqual(old_inv.variables_dict, new_inv.variables_dict)
        old_groups = set(old_inv.groups.values_list('name', flat=True))
        new_groups = set(new_inv.groups.values_list('name', flat=True))
        self.assertEqual(old_groups, new_groups)
        old_hosts = set(old_inv.hosts.values_list('name', flat=True))
        new_hosts = set(new_inv.hosts.values_list('name', flat=True))
        self.assertEqual(old_hosts, new_hosts)
        for new_host in new_inv.hosts.all():
            old_host = old_inv.hosts.get(name=new_host.name)
            self.assertEqual(old_host.variables_dict, new_host.variables_dict)
        for new_group in new_inv.groups.all():
            old_group = old_inv.groups.get(name=new_group.name)
            self.assertEqual(old_group.variables_dict, new_group.variables_dict)
            old_children = set(old_group.children.values_list('name', flat=True))
            new_children = set(new_group.children.values_list('name', flat=True))
            self.assertEqual(old_children, new_children)
            old_hosts = set(old_group.hosts.values_list('name', flat=True))
            new_hosts = set(new_group.hosts.values_list('name', flat=True))
            self.assertEqual(old_hosts, new_hosts)

    def test_executable_file_with_meta_hostvars(self):
        os.environ['INVENTORY_HOSTVARS'] = '1'
        self.test_executable_file()
