# Copyright (c) 2015 Ansible, Inc.
# All Rights Reserved

# Python
import time
from datetime import datetime
import mock
import unittest2 as unittest
from copy import deepcopy
from mock import MagicMock

# AWX
from awx.main.tests.base import BaseTest
from awx.fact.tests.base import MongoDBRequired
from command_base import BaseCommandMixin
from awx.main.management.commands.run_fact_cache_receiver import FactCacheReceiver
from awx.fact.models.fact import * # noqa

__all__ = ['RunFactCacheReceiverUnitTest', 'RunFactCacheReceiverFunctionalTest']

TEST_MSG_BASE = {
    'host': 'hostname1',
    'date_key': time.mktime(datetime.utcnow().timetuple()),
    'facts' : { },
    'inventory_id': 1
}

TEST_MSG_MODULES = {
    'packages': {
        "accountsservice": [
            {
                "architecture": "amd64",
                "name": "accountsservice",
                "source": "apt",
                "version": "0.6.35-0ubuntu7.1"
            }
        ],
        "acpid": [
            {
                "architecture": "amd64",
                "name": "acpid",
                "source": "apt",
                "version": "1:2.0.21-1ubuntu2"
            }
        ],
        "adduser": [
            {
                "architecture": "all",
                "name": "adduser",
                "source": "apt",
                "version": "3.113+nmu3ubuntu3"
            }
        ],
    },
    'services': [
        {
            "name": "acpid",
            "source": "sysv",
            "state": "running"
        },
        {
            "name": "apparmor",
            "source": "sysv",
            "state": "stopped"
        },
        {
            "name": "atd",
            "source": "sysv",
            "state": "running"
        },
        {
            "name": "cron",
            "source": "sysv",
            "state": "running"
        }
    ],
    'ansible': {
        'ansible_fact_simple': 'hello world',
        'ansible_fact_complex': {
            'foo': 'bar',
            'hello': [
                'scooby',
                'dooby',
                'doo'
            ]
        },
    }
}
# Derived from TEST_MSG_BASE
TEST_MSG = dict(TEST_MSG_BASE)

TEST_MSG_LARGE = {u'ansible_product_version': u'To Be Filled By O.E.M.', u'ansible_memory_mb': {u'real': {u'total': 32062, u'used': 8079, u'free': 23983}, u'swap': {u'cached': 0, u'total': 0, u'used': 0, u'free': 0}, u'nocache': {u'used': 4339, u'free': 27723}}, u'ansible_user_dir': u'/root', u'ansible_userspace_bits': u'64', u'ansible_distribution_version': u'14.04', u'ansible_virtualization_role': u'guest', u'ansible_env': {u'ANSIBLE_PARAMIKO_RECORD_HOST_KEYS': u'False', u'LC_CTYPE': u'en_US.UTF-8', u'JOB_CALLBACK_DEBUG': u'1', u'_MP_FORK_LOGFILE_': u'', u'HOME': u'/', u'REST_API_TOKEN': u'122-5deb0d6fcec85f3bf44fec6ce170600c', u'LANG': u'en_US.UTF-8', u'SHELL': u'/bin/bash', u'_MP_FORK_LOGFORMAT_': u'[%(asctime)s: %(levelname)s/%(processName)s] %(message)s', u'_': u'/usr/bin/make', u'DJANGO_PROJECT_DIR': u'/tower_devel', u'MFLAGS': u'-w', u'JOB_ID': u'122', u'PYTHONPATH': u'/tower_devel/awx/lib/site-packages:', u'_MP_FORK_LOGLEVEL_': u'10', u'ANSIBLE_CACHE_PLUGIN_CONNECTION': u'tcp://127.0.0.1:6564', u'ANSIBLE_LIBRARY': u'/tower_devel/awx/plugins/library', u'CELERY_LOG_LEVEL': u'10', u'HOSTNAME': u'2842b3619fa8', u'MAKELEVEL': u'2', u'TMUX_PANE': u'%1', u'DJANGO_LIVE_TEST_SERVER_ADDRESS': u'localhost:9013-9199', u'CELERY_LOG_REDIRECT': u'1', u'PATH': u'/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin', u'CALLBACK_CONSUMER_PORT': u'tcp://127.0.0.1:5557', u'MAKEFLAGS': u'w', u'ANSIBLE_CALLBACK_PLUGINS': u'/tower_devel/awx/plugins/callback', u'TERM': u'screen', u'TZ': u'America/New_York', u'LANGUAGE': u'en_US:en', u'ANSIBLE_SSH_CONTROL_PATH': u'/tmp/ansible_tower_y3xGdA/cp/ansible-ssh-%%h-%%p-%%r', u'SHLVL': u'1', u'CELERY_LOG_FILE': u'', u'ANSIBLE_HOST_KEY_CHECKING': u'False', u'TMUX': u'/tmp/tmux-0/default,3719,0', u'CELERY_LOADER': u'djcelery.loaders.DjangoLoader', u'LC_ALL': u'en_US.UTF-8', u'ANSIBLE_FORCE_COLOR': u'True', u'REST_API_URL': u'http://127.0.0.1:8013', u'CELERY_LOG_REDIRECT_LEVEL': u'WARNING', u'INVENTORY_HOSTVARS': u'True', u'ANSIBLE_CACHE_PLUGIN': u'tower', u'INVENTORY_ID': u'1', u'PWD': u'/tower_devel/awx/playbooks', u'DJANGO_SETTINGS_MODULE': u'awx.settings.development', u'ANSIBLE_CACHE_PLUGINS': u'/tower_devel/awx/plugins/fact_caching'}, u'ansible_lo': {u'mtu': 65536, u'device': u'lo', u'promisc': False, u'ipv4': {u'netmask': u'255.0.0.0', u'network': u'127.0.0.0', u'address': u'127.0.0.1'}, u'ipv6': [{u'scope': u'host', u'prefix': u'128', u'address': u'::1'}], u'active': True, u'type': u'loopback'}, u'ansible_memtotal_mb': 32062, u'ansible_architecture': u'x86_64', u'ansible_default_ipv4': {u'alias': u'eth0', u'netmask': u'255.255.0.0', u'macaddress': u'02:42:ac:11:00:01', u'network': u'172.17.0.0', u'address': u'172.17.0.1', u'interface': u'eth0', u'type': u'ether', u'gateway': u'172.17.42.1', u'mtu': 1500}, u'ansible_swapfree_mb': 0, u'ansible_default_ipv6': {}, u'ansible_cmdline': {u'nomodeset': True, u'rw': True, u'initrd': u'EFIarchinitramfs-arch.img', u'rootfstype': u'ext4', u'root': u'/dev/sda4', u'systemd.unit': u'graphical.target'}, u'ansible_selinux': False, u'ansible_userspace_architecture': u'x86_64', u'ansible_product_uuid': u'00020003-0004-0005-0006-000700080009', u'ansible_pkg_mgr': u'apt', u'ansible_memfree_mb': 23983, u'ansible_distribution': u'Ubuntu', u'ansible_processor_count': 1, u'ansible_hostname': u'2842b3619fa8', u'ansible_all_ipv6_addresses': [u'fe80::42:acff:fe11:1'], u'ansible_interfaces': [u'lo', u'eth0'], u'ansible_kernel': u'4.0.1-1-ARCH', u'ansible_fqdn': u'2842b3619fa8', u'ansible_mounts': [{u'uuid': u'NA', u'size_total': 10434699264, u'mount': u'/', u'size_available': 4918865920, u'fstype': u'ext4', u'device': u'/dev/mapper/docker-8:4-18219321-2842b3619fa885d19e47302009754a4bfd54c1b32c7f21e98f38c7fe7412d3d0', u'options': u'rw,relatime,discard,stripe=16,data=ordered'}, {u'uuid': u'NA', u'size_total': 570629263360, u'mount': u'/tower_devel', u'size_available': 240166572032, u'fstype': u'ext4', u'device': u'/dev/sda4', u'options': u'rw,relatime,data=ordered'}, {u'uuid': u'NA', u'size_total': 570629263360, u'mount': u'/etc/resolv.conf', u'size_available': 240166572032, u'fstype': u'ext4', u'device': u'/dev/sda4', u'options': u'rw,relatime,data=ordered'}, {u'uuid': u'NA', u'size_total': 570629263360, u'mount': u'/etc/hostname', u'size_available': 240166572032, u'fstype': u'ext4', u'device': u'/dev/sda4', u'options': u'rw,relatime,data=ordered'}, {u'uuid': u'NA', u'size_total': 570629263360, u'mount': u'/etc/hosts', u'size_available': 240166572032, u'fstype': u'ext4', u'device': u'/dev/sda4', u'options': u'rw,relatime,data=ordered'}], u'ansible_user_shell': u'/bin/bash', u'ansible_nodename': u'2842b3619fa8', u'ansible_product_serial': u'To Be Filled By O.E.M.', u'ansible_form_factor': u'Desktop', u'ansible_fips': False, u'ansible_user_id': u'root', u'ansible_domain': u'', u'ansible_date_time': {u'month': u'05', u'second': u'47', u'iso8601_micro': u'2015-05-01T19:46:47.868456Z', u'year': u'2015', u'date': u'2015-05-01', u'iso8601': u'2015-05-01T19:46:47Z', u'day': u'01', u'minute': u'46', u'tz': u'EDT', u'hour': u'15', u'tz_offset': u'-0400', u'epoch': u'1430509607', u'weekday': u'Friday', u'time': u'15:46:47'}, u'ansible_processor_cores': 4, u'ansible_processor_vcpus': 4, u'ansible_bios_version': u'P1.80', u'ansible_processor': [u'GenuineIntel', u'Intel(R) Core(TM) i5-2310 CPU @ 2.90GHz', u'GenuineIntel', u'Intel(R) Core(TM) i5-2310 CPU @ 2.90GHz', u'GenuineIntel', u'Intel(R) Core(TM) i5-2310 CPU @ 2.90GHz', u'GenuineIntel', u'Intel(R) Core(TM) i5-2310 CPU @ 2.90GHz'], u'ansible_virtualization_type': u'docker', u'ansible_distribution_release': u'trusty', u'ansible_system_vendor': u'To Be Filled By O.E.M.', u'ansible_os_family': u'Debian', u'ansible_user_gid': 0, u'ansible_swaptotal_mb': 0, u'ansible_system': u'Linux', u'ansible_devices': {u'sda': {u'sectorsize': u'4096', u'vendor': u'ATA', u'host': u'', u'support_discard': u'0', u'model': u'ST1000DM003-9YN1', u'size': u'7.28 TB', u'scheduler_mode': u'cfq', u'rotational': u'1', u'sectors': u'1953525168', u'removable': u'0', u'holders': [], u'partitions': {u'sda4': {u'start': u'820979712', u'sectorsize': 512, u'sectors': u'1132545423', u'size': u'540.04 GB'}, u'sda2': {u'start': u'206848', u'sectorsize': 512, u'sectors': u'262144', u'size': u'128.00 MB'}, u'sda3': {u'start': u'468992', u'sectorsize': 512, u'sectors': u'820510720', u'size': u'391.25 GB'}, u'sda1': {u'start': u'2048', u'sectorsize': 512, u'sectors': u'204800', u'size': u'100.00 MB'}}}}, u'ansible_user_uid': 0, u'ansible_distribution_major_version': u'14', u'ansible_lsb': {u'major_release': u'14', u'release': u'14.04', u'codename': u'trusty', u'description': u'Ubuntu 14.04.1 LTS', u'id': u'Ubuntu'}, u'ansible_bios_date': u'12/05/2012', u'ansible_machine': u'x86_64', u'ansible_user_gecos': u'root', u'ansible_processor_threads_per_core': 1, u'ansible_eth0': {u'device': u'eth0', u'promisc': False, u'macaddress': u'02:42:ac:11:00:01', u'ipv4': {u'netmask': u'255.255.0.0', u'network': u'172.17.0.0', u'address': u'172.17.0.1'}, u'ipv6': [{u'scope': u'link', u'prefix': u'64', u'address': u'fe80::42:acff:fe11:1'}], u'active': True, u'type': u'ether', u'mtu': 1500}, u'ansible_product_name': u'To Be Filled By O.E.M.', u'ansible_all_ipv4_addresses': [u'172.17.0.1'], u'ansible_python_version': u'2.7.6'} # noqa

def copy_only_module(data, module):
    data = deepcopy(data)
    data['facts'] = {}
    if module == 'ansible':
        data['facts'] = deepcopy(TEST_MSG_MODULES[module])
    else:
        data['facts'][module] = deepcopy(TEST_MSG_MODULES[module])
    return data


class RunFactCacheReceiverFunctionalTest(BaseCommandMixin, BaseTest, MongoDBRequired):
    @unittest.skip('''\
TODO: run_fact_cache_receiver enters a while True loop that never exists. \
This differs from most other commands that we test for. More logic and work \
would be required to invoke this case from the command line with little return \
in terms of increase coverage and confidence.''')
    def test_invoke(self):
        result, stdout, stderr = self.run_command('run_fact_cache_receiver')
        self.assertEqual(result, None)

class RunFactCacheReceiverUnitTest(BaseTest, MongoDBRequired):

    # TODO: Check that timestamp and other attributes are as expected
    def check_process_fact_message_module(self, data, module):
        fact_found = None
        facts = Fact.objects.all()
        self.assertEqual(len(facts), 1)
        for fact in facts:
            if fact.module == module:
                fact_found = fact
                break
        self.assertIsNotNone(fact_found)
        #self.assertEqual(data['facts'][module], fact_found[module])

        fact_found = None
        fact_versions = FactVersion.objects.all()
        self.assertEqual(len(fact_versions), 1)
        for fact in fact_versions:
            if fact.module == module:
                fact_found = fact
                break
        self.assertIsNotNone(fact_found)


    # Ensure that the message flows from the socket through to process_fact_message()
    @mock.patch('awx.main.socket.Socket.listen')
    def test_run_receiver(self, listen_mock):
        listen_mock.return_value = [TEST_MSG]

        receiver = FactCacheReceiver()
        receiver.process_fact_message = MagicMock(name='process_fact_message')
        receiver.run_receiver(use_processing_threads=False)

        receiver.process_fact_message.assert_called_once_with(TEST_MSG)

    def test_process_fact_message_ansible(self):
        data = copy_only_module(TEST_MSG, 'ansible')

        receiver = FactCacheReceiver()
        receiver.process_fact_message(data)

        self.check_process_fact_message_module(data, 'ansible')

    def test_process_fact_message_packages(self):
        data = copy_only_module(TEST_MSG, 'packages')

        receiver = FactCacheReceiver()
        receiver.process_fact_message(data)

        self.check_process_fact_message_module(data, 'packages')

    def test_process_fact_message_services(self):
        data = copy_only_module(TEST_MSG, 'services')

        receiver = FactCacheReceiver()
        receiver.process_fact_message(data)

        self.check_process_fact_message_module(data, 'services')


    # Ensure that only a single host gets created for multiple invocations with the same hostname
    def test_process_fact_message_single_host_created(self):
        receiver = FactCacheReceiver()

        data = deepcopy(TEST_MSG)
        receiver.process_fact_message(data)
        data = deepcopy(TEST_MSG)
        data['date_key'] = time.mktime(datetime.utcnow().timetuple())
        receiver.process_fact_message(data)

        fact_hosts = FactHost.objects.all()
        self.assertEqual(len(fact_hosts), 1)

    def test_process_facts_message_ansible_overwrite(self):
        data = copy_only_module(TEST_MSG, 'ansible')
        key = 'ansible.overwrite'
        value = 'hello world'

        receiver = FactCacheReceiver()
        receiver.process_fact_message(data)

        fact = Fact.objects.all()[0]

        data = copy_only_module(TEST_MSG, 'ansible')
        data['facts'][key] = value
        receiver.process_fact_message(data)

        fact = Fact.objects.get(id=fact.id)
        self.assertIn(key, fact.fact)
        self.assertEqual(fact.fact[key], value)
        self.assertEqual(fact.fact, data['facts'])

    def test_large_overwrite(self):
        data = deepcopy(TEST_MSG_BASE)
        data['facts'] = {
            'ansible': {}
        }

        receiver = FactCacheReceiver()
        receiver.process_fact_message(data)

        fact = Fact.objects.all()[0]

        data['facts']['ansible'] = TEST_MSG_LARGE
        receiver.process_fact_message(data)

        fact = Fact.objects.get(id=fact.id)
        self.assertEqual(fact.fact, data['facts']['ansible'])
