# Copyright (c) 2014 AnsibleWorks, Inc.
# All Rights Reserved.

from django.conf import settings
from django.conf.urls import *

urlpatterns = patterns('awx.ui.views',
    url(r'^$', 'index', name='index'),
    url(r'^portal/$', 'portal_redirect', name='portal_redirect'),
)
