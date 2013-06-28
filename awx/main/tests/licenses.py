# Copyright (c) 2013 AnsibleWorks, Inc.
# All Rights Reserved.

import datetime
import json

from django.conf import settings
from django.contrib.auth.models import User as DjangoUser
import django.test
from django.test.client import Client
from django.core.urlresolvers import reverse
from awx.main.models import *
from awx.main.tests.base import BaseTest
from awx.main.licenses import *

class LicenseTests(BaseTest):

    def setUp(self):
        super(LicenseTests, self).setUp()

    def test_license_writer(self):

        writer = LicenseWriter( 
           company_name='acmecorp',
           contact_name='Michael DeHaan',
           contact_email='michael@ansibleworks.com',
           license_date=25000, # seconds since epoch
           instance_count=500
        )

        print writer.get_data()
        print writer.get_string()

        assert 2 == 4

    def test_license_reader(self):
        assert 2 == 3
