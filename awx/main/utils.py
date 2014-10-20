# Copyright (c) 2014 AnsibleWorks, Inc.
# All Rights Reserved.

# Python
import base64
import hashlib
import logging
import re
import subprocess
import sys
import urlparse
import threading
import contextlib

# Django REST Framework
from rest_framework.exceptions import ParseError, PermissionDenied

# PyCrypto
from Crypto.Cipher import AES

# ZeroMQ
import zmq


__all__ = ['get_object_or_400', 'get_object_or_403', 'camelcase_to_underscore',
           'get_ansible_version', 'get_awx_version', 'update_scm_url',
           'get_type_for_model', 'get_model_for_type',
           'ignore_inventory_computed_fields', 'ignore_inventory_group_removal',
           '_inventory_updates']


def get_object_or_400(klass, *args, **kwargs):
    '''
    Return a single object from the given model or queryset based on the query
    params, otherwise raise an exception that will return in a 400 response.
    '''
    from django.shortcuts import _get_queryset
    queryset = _get_queryset(klass)
    try:
        return queryset.get(*args, **kwargs)
    except queryset.model.DoesNotExist, e:
        raise ParseError(*e.args)
    except queryset.model.MultipleObjectsReturned, e:
        raise ParseError(*e.args)


def get_object_or_403(klass, *args, **kwargs):
    '''
    Return a single object from the given model or queryset based on the query
    params, otherwise raise an exception that will return in a 403 response.
    '''
    from django.shortcuts import _get_queryset
    queryset = _get_queryset(klass)
    try:
        return queryset.get(*args, **kwargs)
    except queryset.model.DoesNotExist, e:
        raise PermissionDenied(*e.args)
    except queryset.model.MultipleObjectsReturned, e:
        raise PermissionDenied(*e.args)


def camelcase_to_underscore(s):
    '''
    Convert CamelCase names to lowercase_with_underscore.
    '''
    s = re.sub(r'(((?<=[a-z])[A-Z])|([A-Z](?![A-Z]|$)))', '_\\1', s)
    return s.lower().strip('_')


class RequireDebugTrueOrTest(logging.Filter):
    '''
    Logging filter to output when in DEBUG mode or running tests.
    '''

    def filter(self, record):
        from django.conf import settings
        return settings.DEBUG or 'test' in sys.argv


def get_ansible_version():
    '''
    Return Ansible version installed.
    '''
    try:
        proc = subprocess.Popen(['ansible', '--version'],
                                stdout=subprocess.PIPE)
        result = proc.communicate()[0]
        stripped_result = result.lower().replace('ansible', '').strip()
        return stripped_result.split('\n', 1)[0]
    except:
        return 'unknown'


def get_awx_version():
    '''
    Return Ansible Tower version as reported by setuptools.
    '''
    from awx import __version__
    try:
        import pkg_resources
        return pkg_resources.require('ansible_tower')[0].version
    except:
        return __version__


def get_encryption_key(instance, field_name):
    '''
    Generate key for encrypted password based on instance pk and field name.
    '''
    from django.conf import settings
    h = hashlib.sha1()
    h.update(settings.SECRET_KEY)
    h.update(str(instance.pk))
    h.update(field_name)
    return h.digest()[:16]


def encrypt_field(instance, field_name, ask=False):
    '''
    Return content of the given instance and field name encrypted.
    '''
    value = getattr(instance, field_name)
    if not value or value.startswith('$encrypted$') or (ask and value == 'ASK'):
        return value
    value = value.encode('utf-8')
    key = get_encryption_key(instance, field_name)
    cipher = AES.new(key, AES.MODE_ECB)
    while len(value) % cipher.block_size != 0:
        value += '\x00'
    encrypted = cipher.encrypt(value)
    b64data = base64.b64encode(encrypted)
    return '$encrypted$%s$%s' % ('AES', b64data)


def decrypt_field(instance, field_name):
    '''
    Return content of the given instance and field name decrypted.
    '''
    value = getattr(instance, field_name)
    if not value or not value.startswith('$encrypted$'):
        return value
    algo, b64data = value[len('$encrypted$'):].split('$', 1)
    if algo != 'AES':
        raise ValueError('unsupported algorithm: %s' % algo)
    encrypted = base64.b64decode(b64data)
    key = get_encryption_key(instance, field_name)
    cipher = AES.new(key, AES.MODE_ECB)
    value = cipher.decrypt(encrypted)
    return value.rstrip('\x00')


def update_scm_url(scm_type, url, username=True, password=True,
                   check_special_cases=True):
    '''
    Update the given SCM URL to add/replace/remove the username/password. When
    username/password is True, preserve existing username/password, when
    False (None, '', etc.), remove any existing username/password, otherwise
    replace username/password. Also validates the given URL.
    '''
    # Handle all of the URL formats supported by the SCM systems:
    # git: https://www.kernel.org/pub/software/scm/git/docs/git-clone.html#URLS
    # hg: http://www.selenic.com/mercurial/hg.1.html#url-paths
    # svn: http://svnbook.red-bean.com/en/1.7/svn-book.html#svn.advanced.reposurls
    if scm_type not in ('git', 'hg', 'svn'):
        raise ValueError('Unsupported SCM type "%s"' % str(scm_type))
    if not url.strip():
        return ''
    parts = urlparse.urlsplit(url)
    try:
        parts.port
    except ValueError:
        raise ValueError('Invalid %s URL' % scm_type)
    #print parts
    if '://' not in url:
        # Handle SCP-style URLs for git (e.g. [user@]host.xz:path/to/repo.git/).
        if scm_type == 'git' and '@' in url:
            userpass, hostpath = url.split('@', 1)
            hostpath = '/'.join(hostpath.split(':', 1))
            modified_url = '@'.join([userpass, hostpath])
            parts = urlparse.urlsplit('ssh://%s' % modified_url)
        elif scm_type == 'git' and ':' in url:
            if url.count(':') > 1:
                raise ValueError('Invalid %s URL' % scm_type)

            modified_url = '/'.join(url.split(':', 1))
            parts = urlparse.urlsplit('ssh://%s' % modified_url)
        # Handle local paths specified without file scheme (e.g. /path/to/foo).
        # Only supported by git and hg. (not currently allowed)
        elif scm_type in ('git', 'hg'):
            if not url.startswith('/'):
                parts = urlparse.urlsplit('file:///%s' % url)
            else:
                parts = urlparse.urlsplit('file://%s' % url)
        else:
            raise ValueError('Invalid %s URL' % scm_type)
        #print parts
    # Validate that scheme is valid for given scm_type.
    scm_type_schemes = {
        'git': ('ssh', 'git', 'http', 'https', 'ftp', 'ftps'),
        'hg': ('http', 'https', 'ssh'),
        'svn': ('http', 'https', 'svn', 'svn+ssh'),
    }
    if parts.scheme not in scm_type_schemes.get(scm_type, ()):
        raise ValueError('Unsupported %s URL' % scm_type)
    if parts.scheme == 'file' and parts.netloc not in ('', 'localhost'):
        raise ValueError('Unsupported host "%s" for file:// URL' % (parts.netloc))
    elif parts.scheme != 'file' and not parts.netloc:
        raise ValueError('Host is required for %s URL' % parts.scheme)
    if username is True:
        netloc_username = parts.username or ''
    elif username:
        netloc_username = username
    else:
        netloc_username = ''
    if password is True:
        netloc_password = parts.password or ''
    elif password:
        netloc_password = password
    else:
        netloc_password = ''

    # Special handling for github/bitbucket SSH URLs.
    if check_special_cases:
        special_git_hosts = ('github.com', 'bitbucket.org', 'altssh.bitbucket.org')
        if scm_type == 'git' and parts.scheme == 'ssh' and parts.hostname in special_git_hosts and netloc_username != 'git':
            raise ValueError('Username must be "git" for SSH access to %s.' % parts.hostname)
        if scm_type == 'git' and parts.scheme == 'ssh' and parts.hostname in special_git_hosts and netloc_password:
            #raise ValueError('Password not allowed for SSH access to %s.' % parts.hostname)
            netloc_password = ''
        special_hg_hosts = ('bitbucket.org', 'altssh.bitbucket.org')
        if scm_type == 'hg' and parts.scheme == 'ssh' and parts.hostname in special_hg_hosts and netloc_username != 'hg':
            raise ValueError('Username must be "hg" for SSH access to %s.' % parts.hostname)
        if scm_type == 'hg' and parts.scheme == 'ssh' and netloc_password:
            #raise ValueError('Password not supported for SSH with Mercurial.')
            netloc_password = ''

    if netloc_username and parts.scheme != 'file':
        netloc = u':'.join(filter(None, [netloc_username, netloc_password]))
    else:
        netloc = u''
    netloc = u'@'.join(filter(None, [netloc, parts.hostname]))
    if parts.port:
        netloc = u':'.join([netloc, unicode(parts.port)])
    new_url = urlparse.urlunsplit([parts.scheme, netloc, parts.path,
                                   parts.query, parts.fragment])
    return new_url


def model_instance_diff(old, new, serializer_mapping=None):
    """
    Calculate the differences between two model instances. One of the instances may be None (i.e., a newly
    created model or deleted model). This will cause all fields with a value to have changed (from None).
    serializer_mapping are used to determine read-only fields.
    When provided, read-only fields will not be included in the resulting dictionary
    """
    from django.db.models import Model
    from awx.main.models.credential import Credential

    if not(old is None or isinstance(old, Model)):
        raise TypeError('The supplied old instance is not a valid model instance.')
    if not(new is None or isinstance(new, Model)):
        raise TypeError('The supplied new instance is not a valid model instance.')

    diff = {}

    if old is not None and new is not None:
        fields = set(old._meta.fields + new._meta.fields)
    elif old is not None:
        fields = set(old._meta.fields)
    elif new is not None:
        fields = set(new._meta.fields)
    else:
        fields = set()

    if serializer_mapping is not None and new.__class__ in serializer_mapping:
        serializer_actual = serializer_mapping[new.__class__]()
        allowed_fields = [x for x in serializer_actual.fields if not serializer_actual.fields[x].read_only] + ['id']
    else:
        allowed_fields = [x.name for x in new._meta.fields]

    for field in allowed_fields:
        old_value = getattr(old, field, None)
        new_value = getattr(new, field, None)

        if old_value != new_value and field not in Credential.PASSWORD_FIELDS:
            if type(old_value) not in (bool, int, type(None)):
                old_value = unicode(old_value)
            if type(new_value) not in (bool, int, type(None)):
                new_value = unicode(new_value)
            diff[field] = (old_value, new_value)
        elif old_value != new_value and field in Credential.PASSWORD_FIELDS:
            diff[field] = (u"hidden", u"hidden")

    if len(diff) == 0:
        diff = None

    return diff


def model_to_dict(obj, serializer_mapping=None):
    """
    Serialize a model instance to a dictionary as best as possible
    serializer_mapping are used to determine read-only fields.
    When provided, read-only fields will not be included in the resulting dictionary
    """
    from awx.main.models.credential import Credential
    attr_d = {}
    if serializer_mapping is not None and obj.__class__ in serializer_mapping:
        serializer_actual = serializer_mapping[obj.__class__]()
        allowed_fields = [x for x in serializer_actual.fields if not serializer_actual.fields[x].read_only] + ['id']
    else:
        allowed_fields = [x.name for x in obj._meta.fields]
    for field in obj._meta.fields:
        if field.name not in allowed_fields:
            continue
        if field.name not in Credential.PASSWORD_FIELDS:
            field_val = getattr(obj, field.name, None)
            if type(field_val) not in (bool, int, type(None)):
                attr_d[field.name] = unicode(field_val)
            else:
                attr_d[field.name] = field_val
        else:
            attr_d[field.name] = "hidden"
    return attr_d


def get_type_for_model(model):
    '''
    Return type name for a given model class.
    '''
    from rest_framework.compat import get_concrete_model
    opts = get_concrete_model(model)._meta
    return camelcase_to_underscore(opts.object_name)


def get_model_for_type(type):
    '''
    Return model class for a given type name.
    '''
    from django.db.models import Q
    from django.contrib.contenttypes.models import ContentType
    for ct in ContentType.objects.filter(Q(app_label='main') | Q(app_label='auth', model='user')):
        ct_model = ct.model_class()
        if not ct_model:
            continue
        ct_type = get_type_for_model(ct_model)
        if type == ct_type:
            return ct_model


def get_system_task_capacity():
    '''
    Measure system memory and use it as a baseline for determining the system's capacity
    '''
    from django.conf import settings
    if hasattr(settings, 'SYSTEM_TASK_CAPACITY'):
        return settings.SYSTEM_TASK_CAPACITY
    proc = subprocess.Popen(['free', '-m'], stdout=subprocess.PIPE)
    out,err = proc.communicate()
    total_mem_value = out.split()[7]
    if int(total_mem_value) <= 2048:
        return 50
    return 50 + ((int(total_mem_value) / 1024) - 2) * 75


def emit_websocket_notification(endpoint, event, payload):
    from django.conf import settings
    if getattr(settings, 'SOCKETIO_NOTIFICATION_PORT', None):
        emit_context = zmq.Context()
        emit_socket = emit_context.socket(zmq.PUSH)
        emit_socket.connect(settings.SOCKETIO_NOTIFICATION_PORT)
        payload['event'] = event
        payload['endpoint'] = endpoint
        emit_socket.send_json(payload);

_inventory_updates = threading.local()


@contextlib.contextmanager
def ignore_inventory_computed_fields():
    '''
    Context manager to ignore updating inventory computed fields.
    '''
    try:
        previous_value = getattr(_inventory_updates, 'is_updating', False)
        _inventory_updates.is_updating = True
        yield
    finally:
        _inventory_updates.is_updating = previous_value


@contextlib.contextmanager
def ignore_inventory_group_removal():
    '''
    Context manager to ignore moving groups/hosts when group is deleted.
    '''
    try:
        previous_value = getattr(_inventory_updates, 'is_removing', False)
        _inventory_updates.is_removing = True
        yield
    finally:
        _inventory_updates.is_removing = previous_value
