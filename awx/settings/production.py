# Copyright (c) 2013 AnsibleWorks, Inc.
# All Rights Reserved.

# Production settings for AWX project.

from defaults import *

DEBUG = False
TEMPLATE_DEBUG = DEBUG

# Clear database settings to force production environment to define them.
DATABASES = {}

# Clear the secret key to force production environment to define it.
SECRET_KEY = None

# Hosts/domain names that are valid for this site; required if DEBUG is False
# See https://docs.djangoproject.com/en/dev/ref/settings/#allowed-hosts
ALLOWED_HOSTS = []

# Production should only use minified JS for UI.
# CLH 6/20/13 - leave the following set to False until we actually have minified js ready
USE_MINIFIED_JS = False

INTERNAL_API_URL = 'http://127.0.0.1:80'

# Load remaining settings from the global settings file specified in the
# environment, defaulting to /etc/awx/settings.py.
settings_file = os.environ.get('AWX_SETTINGS_FILE',
                               '/etc/awx/settings.py')
try:
    execfile(settings_file)
except IOError:
    from django.core.exceptions import ImproperlyConfigured
    raise ImproperlyConfigured('No AWX configuration found in %s'\
                               % settings_file)
