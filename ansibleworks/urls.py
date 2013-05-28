# Copyright (c) 2013 AnsibleWorks, Inc.
# All Rights Reserved.

from django.conf import settings
from django.conf.urls import *

handler403 = 'ansibleworks.main.views.handle_403'
handler404 = 'ansibleworks.main.views.handle_404'
handler500 = 'ansibleworks.main.views.handle_500'

urlpatterns = patterns('',
    url(r'', include('ansibleworks.ui.urls', namespace='ui', app_name='ui')),
    url(r'^api/', include('ansibleworks.main.urls', namespace='main', app_name='main')),
)

if 'django.contrib.admin' in settings.INSTALLED_APPS:
    from django.contrib import admin
    admin.autodiscover()
    urlpatterns += patterns('',
        url(r'^admin/', include(admin.site.urls)),
    )

if settings.DEBUG:
    urlpatterns += patterns('ansibleworks.main.views',
        url(r'^(?:admin/)?403.html$', 'handle_403'),
        url(r'^(?:admin/)?404.html$', 'handle_404'),
        url(r'^(?:admin/)?500.html$', 'handle_500'),
    )
