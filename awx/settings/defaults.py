# Copyright (c) 2015 Ansible, Inc.
# All Rights Reserved.

import os
import re  # noqa
import sys
import ldap
import djcelery
from datetime import timedelta

from kombu import Queue, Exchange

# global settings
from django.conf import global_settings
# ugettext lazy
from django.utils.translation import ugettext_lazy as _

# Update this module's local settings from the global settings module.
this_module = sys.modules[__name__]
for setting in dir(global_settings):
    if setting == setting.upper():
        setattr(this_module, setting, getattr(global_settings, setting))

# Build paths inside the project like this: os.path.join(BASE_DIR, ...)
BASE_DIR = os.path.dirname(os.path.dirname(__file__))


def is_testing(argv=None):
    import sys
    '''Return True if running django or py.test unit tests.'''
    argv = sys.argv if argv is None else argv
    if len(argv) >= 1 and ('py.test' in argv[0] or 'py/test.py' in argv[0]):
        return True
    elif len(argv) >= 2 and argv[1] == 'test':
        return True
    return False


def IS_TESTING(argv=None):
    return is_testing(argv)


DEBUG = True
TEMPLATE_DEBUG = DEBUG
SQL_DEBUG = DEBUG

ADMINS = (
    # ('Your Name', 'your_email@domain.com'),
)

MANAGERS = ADMINS

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': os.path.join(BASE_DIR, 'awx.sqlite3'),
        'ATOMIC_REQUESTS': True,
        'TEST': {
            # Test database cannot be :memory: for celery/inventory tests.
            'NAME': os.path.join(BASE_DIR, 'awx_test.sqlite3'),
        },
    }
}

# Internationalization
# https://docs.djangoproject.com/en/dev/topics/i18n/
#
# Local time zone for this installation. Choices can be found here:
# http://en.wikipedia.org/wiki/List_of_tz_zones_by_name
# although not all choices may be available on all operating systems.
# On Unix systems, a value of None will cause Django to use the same
# timezone as the operating system.
# If running in a Windows environment this must be set to the same as your
# system time zone.
TIME_ZONE = 'America/New_York'

# Language code for this installation. All choices can be found here:
# http://www.i18nguy.com/unicode/language-identifiers.html
LANGUAGE_CODE = 'en-us'

# If you set this to False, Django will make some optimizations so as not
# to load the internationalization machinery.
USE_I18N = True

# If you set this to False, Django will not format dates, numbers and
# calendars according to the current locale
USE_L10N = True

USE_TZ = True

STATICFILES_DIRS = (
    os.path.join(BASE_DIR, 'ui', 'static'),
    os.path.join(BASE_DIR, 'static'),
)

# Absolute filesystem path to the directory where static file are collected via
# the collectstatic command.
STATIC_ROOT = os.path.join(BASE_DIR, 'public', 'static')

# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/dev/howto/static-files/
STATIC_URL = '/static/'

# Absolute filesystem path to the directory that will hold user-uploaded files.
# Example: "/home/media/media.lawrence.com/"
MEDIA_ROOT = os.path.join(BASE_DIR, 'public', 'media')

# URL that handles the media served from MEDIA_ROOT. Make sure to use a
# trailing slash if there is a path component (optional in other cases).
# Examples: "http://media.lawrence.com", "http://example.com/media/"
MEDIA_URL = '/media/'

# Absolute filesystem path to the directory to host projects (with playbooks).
# This directory should not be web-accessible.
PROJECTS_ROOT = os.path.join(BASE_DIR, 'projects')

# Absolute filesystem path to the directory for job status stdout (default for
# development and tests, default for production defined in production.py). This
# directory should not be web-accessible
JOBOUTPUT_ROOT = os.path.join(BASE_DIR, 'job_output')

# Absolute filesystem path to the directory to store logs
LOG_ROOT = os.path.join(BASE_DIR)

# The heartbeat file for the tower scheduler
SCHEDULE_METADATA_LOCATION = os.path.join(BASE_DIR, '.tower_cycle')

# Django gettext files path: locale/<lang-code>/LC_MESSAGES/django.po, django.mo
LOCALE_PATHS = (
    os.path.join(BASE_DIR, 'locale'),
)

# Maximum number of the same job that can be waiting to run when launching from scheduler
# Note: This setting may be overridden by database settings.
SCHEDULE_MAX_JOBS = 10

SITE_ID = 1

# Make this unique, and don't share it with anybody.
SECRET_KEY = 'p7z7g1ql4%6+(6nlebb6hdk7sd^&fnjpal308%n%+p^_e6vo1y'

# Hosts/domain names that are valid for this site; required if DEBUG is False
# See https://docs.djangoproject.com/en/dev/ref/settings/#allowed-hosts
ALLOWED_HOSTS = []

# HTTP headers and meta keys to search to determine remote host name or IP. Add
# additional items to this list, such as "HTTP_X_FORWARDED_FOR", if behind a
# reverse proxy.
REMOTE_HOST_HEADERS = ['REMOTE_ADDR', 'REMOTE_HOST']

# Note: This setting may be overridden by database settings.
STDOUT_MAX_BYTES_DISPLAY = 1048576

# Note: This setting may be overridden by database settings.
EVENT_STDOUT_MAX_BYTES_DISPLAY = 1024

TEMPLATE_CONTEXT_PROCESSORS = (  # NOQA
    'django.contrib.auth.context_processors.auth',
    'django.core.context_processors.debug',
    'django.core.context_processors.i18n',
    'django.core.context_processors.media',
    'django.core.context_processors.static',
    'django.core.context_processors.tz',
    'django.contrib.messages.context_processors.messages',
    'django.core.context_processors.request',
    'awx.ui.context_processors.settings',
    'awx.ui.context_processors.version',
    'social.apps.django_app.context_processors.backends',
    'social.apps.django_app.context_processors.login_redirect',
)

MIDDLEWARE_CLASSES = (  # NOQA
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.locale.LocaleMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'awx.main.middleware.ActivityStreamMiddleware',
    'awx.sso.middleware.SocialAuthMiddleware',
    'crum.CurrentRequestUserMiddleware',
    'awx.main.middleware.AuthTokenTimeoutMiddleware',
)

TEMPLATE_DIRS = (
    os.path.join(BASE_DIR, 'templates'),
)

TEMPLATE_LOADERS = (
    ('django.template.loaders.cached.Loader', (
        'django.template.loaders.filesystem.Loader',
        'django.template.loaders.app_directories.Loader',
    )),
)

ROOT_URLCONF = 'awx.urls'

WSGI_APPLICATION = 'awx.wsgi.application'

INSTALLED_APPS = (
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.messages',
    'django.contrib.sessions',
    'django.contrib.sites',
    'django.contrib.staticfiles',
    'rest_framework',
    'django_extensions',
    'djcelery',
    'kombu.transport.django',
    'channels',
    'polymorphic',
    'taggit',
    'social.apps.django_app.default',
    'awx.conf',
    'awx.main',
    'awx.api',
    'awx.ui',
    'awx.sso',
    'solo',
)

INTERNAL_IPS = ('127.0.0.1',)

REST_FRAMEWORK = {
    'DEFAULT_PAGINATION_CLASS': 'awx.api.pagination.Pagination',
    'PAGE_SIZE': 25,
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'awx.api.authentication.TokenAuthentication',
        'awx.api.authentication.LoggedBasicAuthentication',
        #'rest_framework.authentication.SessionAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'awx.api.permissions.ModelAccessPermission',
    ),
    'DEFAULT_FILTER_BACKENDS': (
        'awx.api.filters.TypeFilterBackend',
        'awx.api.filters.FieldLookupBackend',
        'rest_framework.filters.SearchFilter',
        'awx.api.filters.OrderByBackend',
    ),
    'DEFAULT_PARSER_CLASSES': (
        'awx.api.parsers.JSONParser',
    ),
    'DEFAULT_RENDERER_CLASSES': (
        'rest_framework.renderers.JSONRenderer',
        'awx.api.renderers.BrowsableAPIRenderer',
    ),
    'DEFAULT_METADATA_CLASS': 'awx.api.metadata.Metadata',
    'EXCEPTION_HANDLER': 'awx.api.views.api_exception_handler',
    'VIEW_NAME_FUNCTION': 'awx.api.generics.get_view_name',
    'VIEW_DESCRIPTION_FUNCTION': 'awx.api.generics.get_view_description',
    'NON_FIELD_ERRORS_KEY': '__all__',
}

AUTHENTICATION_BACKENDS = (
    'awx.sso.backends.LDAPBackend',
    'awx.sso.backends.RADIUSBackend',
    'social.backends.google.GoogleOAuth2',
    'social.backends.github.GithubOAuth2',
    'social.backends.github.GithubOrganizationOAuth2',
    'social.backends.github.GithubTeamOAuth2',
    'awx.sso.backends.SAMLAuth',
    'django.contrib.auth.backends.ModelBackend',
)

# LDAP server (default to None to skip using LDAP authentication).
# Note: This setting may be overridden by database settings.
AUTH_LDAP_SERVER_URI = None

# Disable LDAP referrals by default (to prevent certain LDAP queries from
# hanging with AD).
# Note: This setting may be overridden by database settings.
AUTH_LDAP_CONNECTION_OPTIONS = {
    ldap.OPT_REFERRALS: 0,
}

# Radius server settings (default to empty string to skip using Radius auth).
# Note: These settings may be overridden by database settings.
RADIUS_SERVER = ''
RADIUS_PORT = 1812
RADIUS_SECRET = ''

# Seconds before auth tokens expire.
# Note: This setting may be overridden by database settings.
AUTH_TOKEN_EXPIRATION = 1800

# Maximum number of per-user valid, concurrent tokens.
# -1 is unlimited
# Note: This setting may be overridden by database settings.
AUTH_TOKEN_PER_USER = -1

# Enable / Disable HTTP Basic Authentication used in the API browser
# Note: Session limits are not enforced when using HTTP Basic Authentication.
# Note: This setting may be overridden by database settings.
AUTH_BASIC_ENABLED = True

# If set, serve only minified JS for UI.
USE_MINIFIED_JS = False

# Email address that error messages come from.
SERVER_EMAIL = 'root@localhost'

# Default email address to use for various automated correspondence from
# the site managers.
DEFAULT_FROM_EMAIL = 'tower@localhost'

# Subject-line prefix for email messages send with django.core.mail.mail_admins
# or ...mail_managers.  Make sure to include the trailing space.
EMAIL_SUBJECT_PREFIX = '[Tower] '

# The email backend to use. For possible shortcuts see django.core.mail.
# The default is to use the SMTP backend.
# Third-party backends can be specified by providing a Python path
# to a module that defines an EmailBackend class.
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'

# Host for sending email.
EMAIL_HOST = 'localhost'

# Port for sending email.
EMAIL_PORT = 25

# Optional SMTP authentication information for EMAIL_HOST.
EMAIL_HOST_USER = ''
EMAIL_HOST_PASSWORD = ''
EMAIL_USE_TLS = False

# Memcached django cache configuration
# CACHES = {
#     'default': {
#         'BACKEND': 'django.core.cache.backends.memcached.MemcachedCache',
#         'LOCATION': '127.0.0.1:11211',
#         'TIMEOUT': 864000,
#         'KEY_PREFIX': 'tower_dev',
#     }
# }

# Use Django-Debug-Toolbar if installed.
try:
    import debug_toolbar
    INSTALLED_APPS += (debug_toolbar.__name__,)
except ImportError:
    pass

DEBUG_TOOLBAR_CONFIG = {
    'INTERCEPT_REDIRECTS': False,
    'ENABLE_STACKTRACES' : True,
}

DEVSERVER_DEFAULT_ADDR = '0.0.0.0'
DEVSERVER_DEFAULT_PORT = '8013'

# Set default ports for live server tests.
os.environ.setdefault('DJANGO_LIVE_TEST_SERVER_ADDRESS', 'localhost:9013-9199')

# Initialize Django-Celery.
djcelery.setup_loader()

BROKER_URL = 'redis://localhost/'
CELERY_DEFAULT_QUEUE = 'default'
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TRACK_STARTED = True
CELERYD_TASK_TIME_LIMIT = None
CELERYD_TASK_SOFT_TIME_LIMIT = None
CELERYBEAT_SCHEDULER = 'celery.beat.PersistentScheduler'
CELERYBEAT_MAX_LOOP_INTERVAL = 60
CELERY_RESULT_BACKEND = 'djcelery.backends.database:DatabaseBackend'
CELERY_IMPORTS = ('awx.main.scheduler.tasks',)
CELERY_QUEUES = (
    Queue('default', Exchange('default'), routing_key='default'),
    Queue('jobs', Exchange('jobs'), routing_key='jobs'),
    Queue('scheduler', Exchange('scheduler', type='topic'), routing_key='scheduler.job.#', durable=False),
    # Projects use a fanout queue, this isn't super well supported
)
CELERY_ROUTES = {'awx.main.tasks.run_job': {'queue': 'jobs',
                                            'routing_key': 'jobs'},
                 'awx.main.tasks.run_project_update': {'queue': 'jobs',
                                                       'routing_key': 'jobs'},
                 'awx.main.tasks.run_inventory_update': {'queue': 'jobs',
                                                         'routing_key': 'jobs'},
                 'awx.main.tasks.run_ad_hoc_command': {'queue': 'jobs',
                                                       'routing_key': 'jobs'},
                 'awx.main.tasks.run_system_job': {'queue': 'jobs',
                                                   'routing_key': 'jobs'},
                 'awx.main.scheduler.tasks.run_job_launch': {'queue': 'scheduler',
                                                             'routing_key': 'scheduler.job.launch'},
                 'awx.main.scheduler.tasks.run_job_complete': {'queue': 'scheduler',
                                                               'routing_key': 'scheduler.job.complete'},
                 'awx.main.tasks.cluster_node_heartbeat': {'queue': 'default',
                                                           'routing_key': 'cluster.heartbeat'}}

CELERYBEAT_SCHEDULE = {
    'tower_scheduler': {
        'task': 'awx.main.tasks.tower_periodic_scheduler',
        'schedule': timedelta(seconds=30)
    },
    'admin_checks': {
        'task': 'awx.main.tasks.run_administrative_checks',
        'schedule': timedelta(days=30)
    },
    'authtoken_cleanup': {
        'task': 'awx.main.tasks.cleanup_authtokens',
        'schedule': timedelta(days=30)
    },
    'cluster_heartbeat': {
        'task': 'awx.main.tasks.cluster_node_heartbeat',
        'schedule': timedelta(seconds=60)
    },
    'task_manager': {
        'task': 'awx.main.scheduler.tasks.run_task_manager',
        'schedule': timedelta(seconds=20)
    },
    'task_fail_inconsistent_running_jobs': {
        'task': 'awx.main.scheduler.tasks.run_fail_inconsistent_running_jobs',
        'schedule': timedelta(seconds=30)
    },
}

# Django Caching Configuration
if is_testing():
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        },
    }
else:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.memcached.MemcachedCache',
            'LOCATION': 'memcached:11211',
        },
    }

# Social Auth configuration.
SOCIAL_AUTH_STRATEGY = 'social.strategies.django_strategy.DjangoStrategy'
SOCIAL_AUTH_STORAGE = 'social.apps.django_app.default.models.DjangoStorage'
SOCIAL_AUTH_USER_MODEL = AUTH_USER_MODEL  # noqa
SOCIAL_AUTH_PIPELINE = (
    'social.pipeline.social_auth.social_details',
    'social.pipeline.social_auth.social_uid',
    'social.pipeline.social_auth.auth_allowed',
    'social.pipeline.social_auth.social_user',
    'social.pipeline.user.get_username',
    'social.pipeline.social_auth.associate_by_email',
    'social.pipeline.user.create_user',
    'awx.sso.pipeline.check_user_found_or_created',
    'social.pipeline.social_auth.associate_user',
    'social.pipeline.social_auth.load_extra_data',
    'awx.sso.pipeline.set_is_active_for_new_user',
    'social.pipeline.user.user_details',
    'awx.sso.pipeline.prevent_inactive_login',
    'awx.sso.pipeline.update_user_orgs',
    'awx.sso.pipeline.update_user_teams',
)

SOCIAL_AUTH_LOGIN_URL = '/'
SOCIAL_AUTH_LOGIN_REDIRECT_URL = '/sso/complete/'
SOCIAL_AUTH_LOGIN_ERROR_URL = '/sso/error/'
SOCIAL_AUTH_INACTIVE_USER_URL = '/sso/inactive/'

SOCIAL_AUTH_RAISE_EXCEPTIONS = False
SOCIAL_AUTH_USERNAME_IS_FULL_EMAIL = False
SOCIAL_AUTH_SLUGIFY_USERNAMES = True
SOCIAL_AUTH_CLEAN_USERNAMES = True

SOCIAL_AUTH_SANITIZE_REDIRECTS = True
SOCIAL_AUTH_REDIRECT_IS_HTTPS = False

# Note: These settings may be overridden by database settings.
SOCIAL_AUTH_GOOGLE_OAUTH2_KEY = ''
SOCIAL_AUTH_GOOGLE_OAUTH2_SECRET = ''
SOCIAL_AUTH_GOOGLE_OAUTH2_SCOPE = ['profile']

SOCIAL_AUTH_GITHUB_KEY = ''
SOCIAL_AUTH_GITHUB_SECRET = ''
SOCIAL_AUTH_GITHUB_SCOPE = ['user:email', 'read:org']

SOCIAL_AUTH_GITHUB_ORG_KEY = ''
SOCIAL_AUTH_GITHUB_ORG_SECRET = ''
SOCIAL_AUTH_GITHUB_ORG_NAME = ''
SOCIAL_AUTH_GITHUB_ORG_SCOPE = ['user:email', 'read:org']

SOCIAL_AUTH_GITHUB_TEAM_KEY = ''
SOCIAL_AUTH_GITHUB_TEAM_SECRET = ''
SOCIAL_AUTH_GITHUB_TEAM_ID = ''
SOCIAL_AUTH_GITHUB_TEAM_SCOPE = ['user:email', 'read:org']

SOCIAL_AUTH_SAML_SP_ENTITY_ID = ''
SOCIAL_AUTH_SAML_SP_PUBLIC_CERT = ''
SOCIAL_AUTH_SAML_SP_PRIVATE_KEY = ''
SOCIAL_AUTH_SAML_ORG_INFO = {}
SOCIAL_AUTH_SAML_TECHNICAL_CONTACT = {}
SOCIAL_AUTH_SAML_SUPPORT_CONTACT = {}
SOCIAL_AUTH_SAML_ENABLED_IDPS = {}

# Any ANSIBLE_* settings will be passed to the subprocess environment by the
# celery task.

# Do not want AWX to ask interactive questions and want it to be friendly with
# reprovisioning
ANSIBLE_HOST_KEY_CHECKING = False

# RHEL has too old of an SSH so ansible will select paramiko and this is VERY
# slow.
ANSIBLE_PARAMIKO_RECORD_HOST_KEYS = False

# Force ansible in color even if we don't have a TTY so we can properly colorize
# output
ANSIBLE_FORCE_COLOR = True

# Additional environment variables to be passed to the subprocess started by
# the celery task.
AWX_TASK_ENV = {}

# Maximum number of job events processed by the callback receiver worker process
# before it recycles
JOB_EVENT_RECYCLE_THRESHOLD = 3000

# Number of workers used to proecess job events in parallel
JOB_EVENT_WORKERS = 4

# Maximum number of job events that can be waiting on a single worker queue before
# it can be skipped as too busy
JOB_EVENT_MAX_QUEUE_SIZE = 100

# Flag to enable/disable updating hosts M2M when saving job events.
CAPTURE_JOB_EVENT_HOSTS = False

# Enable bubblewrap support for running jobs (playbook runs only).
# Note: This setting may be overridden by database settings.
AWX_PROOT_ENABLED = False

# Command/path to bubblewrap.
AWX_PROOT_CMD = 'bwrap'

# Additional paths to hide from jobs using bubblewrap.
# Note: This setting may be overridden by database settings.
AWX_PROOT_HIDE_PATHS = []

# Additional paths to show for jobs using bubbelwrap.
# Note: This setting may be overridden by database settings.
AWX_PROOT_SHOW_PATHS = []

# Number of jobs to show as part of the job template history
AWX_JOB_TEMPLATE_HISTORY = 10

# The directory in which bubblewrap will create new temporary directories for its root
# Note: This setting may be overridden by database settings.
AWX_PROOT_BASE_PATH = "/tmp"

# User definable ansible callback plugins
# Note: This setting may be overridden by database settings.
AWX_ANSIBLE_CALLBACK_PLUGINS = ""

# Time at which an HA node is considered active
AWX_ACTIVE_NODE_TIME = 7200

# Enable Pendo on the UI, possible values are 'off', 'anonymous', and 'detailed'
# Note: This setting may be overridden by database settings.
PENDO_TRACKING_STATE = "off"

# Default list of modules allowed for ad hoc commands.
# Note: This setting may be overridden by database settings.
AD_HOC_COMMANDS = [
    'command',
    'shell',
    'yum',
    'apt',
    'apt_key',
    'apt_repository',
    'apt_rpm',
    'service',
    'group',
    'user',
    'mount',
    'ping',
    'selinux',
    'setup',
    'win_ping',
    'win_service',
    'win_updates',
    'win_group',
    'win_user',
]

# Not possible to get list of regions without authenticating, so use this list
# instead (based on docs from:
# http://docs.rackspace.com/loadbalancers/api/v1.0/clb-devguide/content/Service_Access_Endpoints-d1e517.html)
RAX_REGION_CHOICES = [
    ('ORD', _('Chicago')),
    ('DFW', _('Dallas/Ft. Worth')),
    ('IAD', _('Northern Virginia')),
    ('LON', _('London')),
    ('SYD', _('Sydney')),
    ('HKG', _('Hong Kong')),
]

# Inventory variable name/values for determining if host is active/enabled.
RAX_ENABLED_VAR = 'rax_status'
RAX_ENABLED_VALUE = 'ACTIVE'

# Inventory variable name containing unique instance ID.
RAX_INSTANCE_ID_VAR = 'rax_id'

# Filter for allowed group/host names when importing inventory from Rackspace.
# By default, filter group of one created for each instance and exclude all
# groups without children, hosts and variables.
RAX_GROUP_FILTER = r'^(?!instance-.+).+$'
RAX_HOST_FILTER = r'^.+$'
RAX_EXCLUDE_EMPTY_GROUPS = True

INV_ENV_VARIABLE_BLACKLIST = ("HOME", "USER", "_", "TERM")

# ----------------
# -- Amazon EC2 --
# ----------------

# AWS does not appear to provide pretty region names via any API, so store the
# list of names here.  The available region IDs will be pulled from boto.
# http://docs.aws.amazon.com/general/latest/gr/rande.html#ec2_region
EC2_REGION_NAMES = {
    'us-east-1': _('US East (Northern Virginia)'),
    'us-east-2': _('US East (Ohio)'),
    'us-west-2': _('US West (Oregon)'),
    'us-west-1': _('US West (Northern California)'),
    'eu-central-1': _('EU (Frankfurt)'),
    'eu-west-1': _('EU (Ireland)'),
    'ap-southeast-1': _('Asia Pacific (Singapore)'),
    'ap-southeast-2': _('Asia Pacific (Sydney)'),
    'ap-northeast-1': _('Asia Pacific (Tokyo)'),
    'ap-northeast-2': _('Asia Pacific (Seoul)'),
    'ap-south-1': _('Asia Pacific (Mumbai)'),
    'sa-east-1': _('South America (Sao Paulo)'),
    'us-gov-west-1': _('US West (GovCloud)'),
    'cn-north-1': _('China (Beijing)'),
}

EC2_REGIONS_BLACKLIST = [
    'us-gov-west-1',
    'cn-north-1',
]

# Inventory variable name/values for determining if host is active/enabled.
EC2_ENABLED_VAR = 'ec2_state'
EC2_ENABLED_VALUE = 'running'

# Inventory variable name containing unique instance ID.
EC2_INSTANCE_ID_VAR = 'ec2_id'

# Filter for allowed group/host names when importing inventory from EC2.
EC2_GROUP_FILTER = r'^.+$'
EC2_HOST_FILTER = r'^.+$'
EC2_EXCLUDE_EMPTY_GROUPS = True


# ------------
# -- VMware --
# ------------
VMWARE_REGIONS_BLACKLIST = []

# Inventory variable name/values for determining whether a host is
# active in vSphere.
VMWARE_ENABLED_VAR = 'vmware_powerState'
VMWARE_ENABLED_VALUE = 'poweredOn'

# Inventory variable name containing the unique instance ID.
VMWARE_INSTANCE_ID_VAR = 'vmware_uuid'

# Filter for allowed group and host names when importing inventory
# from VMware.
VMWARE_GROUP_FILTER = r'^.+$'
VMWARE_HOST_FILTER = r'^.+$'
VMWARE_EXCLUDE_EMPTY_GROUPS = True


# ---------------------------
# -- Google Compute Engine --
# ---------------------------

# It's not possible to get zones in GCE without authenticating, so we
# provide a list here.
# Source: https://developers.google.com/compute/docs/zones
GCE_REGION_CHOICES = [
    ('us-east1-b', _('US East (B)')),
    ('us-east1-c', _('US East (C)')),
    ('us-east1-d', _('US East (D)')),
    ('us-central1-a', _('US Central (A)')),
    ('us-central1-b', _('US Central (B)')),
    ('us-central1-c', _('US Central (C)')),
    ('us-central1-f', _('US Central (F)')),
    ('europe-west1-b', _('Europe West (B)')),
    ('europe-west1-c', _('Europe West (C)')),
    ('europe-west1-d', _('Europe West (D)')),
    ('asia-east1-a', _('Asia East (A)')),
    ('asia-east1-b', _('Asia East (B)')),
    ('asia-east1-c', _('Asia East (C)')),
]
GCE_REGIONS_BLACKLIST = []

# Inventory variable name/value for determining whether a host is active
# in Google Compute Engine.
GCE_ENABLED_VAR = 'status'
GCE_ENABLED_VALUE = 'running'

# Filter for allowed group and host names when importing inventory from
# Google Compute Engine.
GCE_GROUP_FILTER = r'^.+$'
GCE_HOST_FILTER = r'^.+$'
GCE_EXCLUDE_EMPTY_GROUPS = True
GCE_INSTANCE_ID_VAR = None


# -------------------
# -- Microsoft Azure --
# -------------------

# It's not possible to get zones in Azure without authenticating, so we
# provide a list here.
AZURE_REGION_CHOICES = [
    ('Central_US', _('US Central')),
    ('East_US_1', _('US East')),
    ('East_US_2', _('US East 2')),
    ('North_Central_US', _('US North Central')),
    ('South_Central_US', _('US South Central')),
    ('West_US', _('US West')),
    ('North_Europe', _('Europe North')),
    ('West_Europe', _('Europe West')),
    ('East_Asia_Pacific', _('Asia Pacific East')),
    ('Southest_Asia_Pacific', _('Asia Pacific Southeast')),
    ('East_Japan', _('Japan East')),
    ('West_Japan', _('Japan West')),
    ('South_Brazil', _('Brazil South')),
]
AZURE_REGIONS_BLACKLIST = []

# Inventory variable name/value for determining whether a host is active
# in Microsoft Azure.
AZURE_ENABLED_VAR = 'instance_status'
AZURE_ENABLED_VALUE = 'ReadyRole'

# Filter for allowed group and host names when importing inventory from
# Microsoft Azure.
AZURE_GROUP_FILTER = r'^.+$'
AZURE_HOST_FILTER = r'^.+$'
AZURE_EXCLUDE_EMPTY_GROUPS = True
AZURE_INSTANCE_ID_VAR = 'private_id'

# --------------------------------------
# -- Microsoft Azure Resource Manager --
# --------------------------------------
AZURE_RM_GROUP_FILTER = r'^.+$'
AZURE_RM_HOST_FILTER = r'^.+$'
AZURE_RM_ENABLED_VAR = 'powerstate'
AZURE_RM_ENABLED_VALUE = 'running'
AZURE_RM_INSTANCE_ID_VAR = 'id'
AZURE_RM_EXCLUDE_EMPTY_GROUPS = True

# ---------------------
# ----- OpenStack -----
# ---------------------
OPENSTACK_ENABLED_VAR = 'status'
OPENSTACK_ENABLED_VALUE = 'ACTIVE'
OPENSTACK_GROUP_FILTER = r'^.+$'
OPENSTACK_HOST_FILTER = r'^.+$'
OPENSTACK_EXCLUDE_EMPTY_GROUPS = True
OPENSTACK_INSTANCE_ID_VAR = 'openstack.id'

# ---------------------
# ----- Foreman -----
# ---------------------
SATELLITE6_ENABLED_VAR = 'foreman.enabled'
SATELLITE6_ENABLED_VALUE = 'True'
SATELLITE6_GROUP_FILTER = r'^.+$'
SATELLITE6_HOST_FILTER = r'^.+$'
SATELLITE6_EXCLUDE_EMPTY_GROUPS = True
SATELLITE6_INSTANCE_ID_VAR = 'foreman.id'

# ---------------------
# ----- CloudForms -----
# ---------------------
CLOUDFORMS_ENABLED_VAR = 'power_state'
CLOUDFORMS_ENABLED_VALUE = 'on'
CLOUDFORMS_GROUP_FILTER = r'^.+$'
CLOUDFORMS_HOST_FILTER = r'^.+$'
CLOUDFORMS_EXCLUDE_EMPTY_GROUPS = True
CLOUDFORMS_INSTANCE_ID_VAR = 'id'

# ---------------------
# -- Activity Stream --
# ---------------------
# Defaults for enabling/disabling activity stream.
# Note: These settings may be overridden by database settings.
ACTIVITY_STREAM_ENABLED = True
ACTIVITY_STREAM_ENABLED_FOR_INVENTORY_SYNC = False

# Internal API URL for use by inventory scripts and callback plugin.
INTERNAL_API_URL = 'http://127.0.0.1:%s' % DEVSERVER_DEFAULT_PORT

USE_CALLBACK_QUEUE = True
CALLBACK_QUEUE = "callback_tasks"
FACT_QUEUE = "facts"

SCHEDULER_QUEUE = "scheduler"

TASK_COMMAND_PORT = 6559

SOCKETIO_NOTIFICATION_PORT = 6557
SOCKETIO_LISTEN_PORT = 8080

FACT_CACHE_PORT = 6564

# Note: This setting may be overridden by database settings.
ORG_ADMINS_CAN_SEE_ALL_USERS = True

# Note: This setting may be overridden by database settings.
TOWER_ADMIN_ALERTS = True

# Note: This setting may be overridden by database settings.
TOWER_URL_BASE = "https://towerhost"

TOWER_SETTINGS_MANIFEST = {}

# Logging configuration.
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'filters': {
        'require_debug_false': {
            '()': 'django.utils.log.RequireDebugFalse',
        },
        'require_debug_true': {
            '()': 'django.utils.log.RequireDebugTrue',
        },
        'require_debug_true_or_test': {
            '()': 'awx.main.utils.RequireDebugTrueOrTest',
        },
    },
    'formatters': {
        'simple': {
            'format': '%(asctime)s %(levelname)-8s %(name)s %(message)s',
        },
        'json': {
            '()': 'awx.main.log_utils.formatters.LogstashFormatter'
        }
    },
    'handlers': {
        'console': {
            'level': 'DEBUG',
            'filters': ['require_debug_true_or_test'],
            'class': 'logging.StreamHandler',
            'formatter': 'simple',
        },
        'null': {
            'class': 'django.utils.log.NullHandler',
        },
        'file': {
            'class': 'django.utils.log.NullHandler',
            'formatter': 'simple',
        },
        'syslog': {
            'level': 'WARNING',
            'filters': ['require_debug_false'],
            'class': 'django.utils.log.NullHandler',
            'formatter': 'simple',
        },
        'http_receiver': {
            'class': 'awx.main.log_utils.handlers.HTTPSHandler',
            'level': 'INFO',
            'formatter': 'json',
            'host': '',
        },
        'mail_admins': {
            'level': 'ERROR',
            'filters': ['require_debug_false'],
            'class': 'django.utils.log.AdminEmailHandler',
        },
        'tower_warnings': {
            'level': 'WARNING',
            'class':'logging.handlers.RotatingFileHandler',
            'filters': ['require_debug_false'],
            'filename': os.path.join(LOG_ROOT, 'tower.log'),
            'maxBytes': 1024 * 1024 * 5, # 5 MB
            'backupCount': 5,
            'formatter':'simple',
        },
        'callback_receiver': {
            'level': 'WARNING',
            'class':'logging.handlers.RotatingFileHandler',
            'filters': ['require_debug_false'],
            'filename': os.path.join(LOG_ROOT, 'callback_receiver.log'),
            'maxBytes': 1024 * 1024 * 5, # 5 MB
            'backupCount': 5,
            'formatter':'simple',
        },
        'socketio_service': {
            'level': 'WARNING',
            'class':'logging.handlers.RotatingFileHandler',
            'filters': ['require_debug_false'],
            'filename': os.path.join(LOG_ROOT, 'socketio_service.log'),
            'maxBytes': 1024 * 1024 * 5, # 5 MB
            'backupCount': 5,
            'formatter':'simple',
        },
        'task_system': {
            'level': 'INFO',
            'class':'logging.handlers.RotatingFileHandler',
            'filters': ['require_debug_false'],
            'filename': os.path.join(LOG_ROOT, 'task_system.log'),
            'maxBytes': 1024 * 1024 * 5, # 5 MB
            'backupCount': 5,
            'formatter':'simple',
        },
        'fact_receiver': {
            'level': 'WARNING',
            'class':'logging.handlers.RotatingFileHandler',
            'filters': ['require_debug_false'],
            'filename': os.path.join(LOG_ROOT, 'fact_receiver.log'),
            'maxBytes': 1024 * 1024 * 5, # 5 MB
            'backupCount': 5,
            'formatter':'simple',
        },
        'system_tracking_migrations': {
            'level': 'WARNING',
            'class':'logging.handlers.RotatingFileHandler',
            'filters': ['require_debug_false'],
            'filename': os.path.join(LOG_ROOT, 'tower_system_tracking_migrations.log'),
            'maxBytes': 1024 * 1024 * 5, # 5 MB
            'backupCount': 5,
            'formatter':'simple',
        },
        'rbac_migrations': {
            'level': 'WARNING',
            'class':'logging.handlers.RotatingFileHandler',
            'filters': ['require_debug_false'],
            'filename': os.path.join(LOG_ROOT, 'tower_rbac_migrations.log'),
            'maxBytes': 1024 * 1024 * 5, # 5 MB
            'backupCount': 5,
            'formatter':'simple',
        },
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
        },
        'django.request': {
            'handlers': ['mail_admins', 'console', 'file', 'tower_warnings'],
            'level': 'WARNING',
        },
        'rest_framework.request': {
            'handlers': ['mail_admins', 'console', 'file', 'tower_warnings'],
            'level': 'WARNING',
            'propagate': False,
        },
        'py.warnings': {
            'handlers': ['console'],
        },
        'awx': {
            'handlers': ['console', 'file', 'tower_warnings'],
            'level': 'DEBUG',
        },
        'awx.conf': {
            'handlers': ['null'],
            'level': 'WARNING',
        },
        'awx.conf.settings': {
            'handlers': ['null'],
            'level': 'WARNING',
        },
        'awx.main': {
            'handlers': ['null']
        },
        'awx.main.commands.run_callback_receiver': {
            'handlers': ['callback_receiver'],
        },
        'awx.main.tasks': {
            'handlers': ['task_system']
        },
        'awx.main.scheduler': {
            'handlers': ['task_system'],
        },
        'awx.main.consumers': {
            'handlers': ['null']
        },
        'awx.main.commands.run_fact_cache_receiver': {
            'handlers': ['fact_receiver'],
        },
        'awx.main.access': {
            'handlers': ['null'],
            'propagate': False,
        },
        'awx.main.signals': {
            'handlers': ['null'],
            'propagate': False,
        },
        'awx.api.permissions': {
            'handlers': ['null'],
            'propagate': False,
        },
        'awx.analytics': {
            'handlers': ['null'],
            'level': 'INFO',
            'propagate': False
        },
        'awx.analytics.job_events': {
            'handlers': ['null'],
            'level': 'INFO'
        },
        'awx.analytics.activity_stream': {
            'handlers': ['null'],
            'level': 'INFO'
        },
        'awx.analytics.system_tracking': {
            'handlers': ['null'],
            'level': 'INFO'
        },
        'django_auth_ldap': {
            'handlers': ['console', 'file', 'tower_warnings'],
            'level': 'DEBUG',
        },
        'social': {
            'handlers': ['console', 'file', 'tower_warnings'],
            'level': 'DEBUG',
        },
        'system_tracking_migrations': {
            'handlers': ['console', 'file', 'tower_warnings'],
            'level': 'DEBUG',
        },
        'rbac_migrations': {
            'handlers': ['console', 'file', 'tower_warnings'],
            'level': 'DEBUG',
        },
    }
}
