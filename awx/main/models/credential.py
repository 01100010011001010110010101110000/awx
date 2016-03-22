# Copyright (c) 2015 Ansible, Inc.
# All Rights Reserved.

import base64
import re

# Django
from django.db import models
from django.utils.translation import ugettext_lazy as _
from django.core.exceptions import ValidationError, NON_FIELD_ERRORS
from django.core.urlresolvers import reverse

# AWX
from awx.main.fields import ImplicitRoleField
from awx.main.constants import CLOUD_PROVIDERS
from awx.main.utils import decrypt_field
from awx.main.models.base import * # noqa
from awx.main.models.mixins import ResourceMixin
from awx.main.models.rbac import (
    ROLE_SINGLETON_SYSTEM_ADMINISTRATOR,
    ROLE_SINGLETON_SYSTEM_AUDITOR,
)

__all__ = ['Credential']


class Credential(PasswordFieldsModel, CommonModelNameNotUnique, ResourceMixin):
    '''
    A credential contains information about how to talk to a remote resource
    Usually this is a SSH key location, and possibly an unlock password.
    If used with sudo, a sudo password should be set if required.
    '''

    KIND_CHOICES = [
        ('ssh',    _('Machine')),
        ('scm',    _('Source Control')),
        ('aws',    _('Amazon Web Services')),
        ('rax',    _('Rackspace')),
        ('vmware', _('VMware vCenter')),
        ('gce',    _('Google Compute Engine')),
        ('azure',  _('Microsoft Azure')),
        ('openstack', _('OpenStack')),
    ]

    BECOME_METHOD_CHOICES = [
        ('',       _('None')),
        ('sudo',   _('Sudo')),
        ('su',     _('Su')),
        ('pbrun',  _('Pbrun')),
        ('pfexec', _('Pfexec')),
        #('runas',  _('Runas')),
    ]

    PASSWORD_FIELDS = ('password', 'security_token', 'ssh_key_data', 'ssh_key_unlock',
                       'become_password', 'vault_password')

    class Meta:
        app_label = 'main'
        unique_together = [('user', 'team', 'kind', 'name')]
        ordering = ('kind', 'name')

    user = models.ForeignKey(
        'auth.User',
        null=True,
        default=None,
        blank=True,
        on_delete=models.CASCADE,
        related_name='credentials',
    )
    team = models.ForeignKey(
        'Team',
        null=True,
        default=None,
        blank=True,
        on_delete=models.CASCADE,
        related_name='credentials',
    )
    kind = models.CharField(
        max_length=32,
        choices=KIND_CHOICES,
        default='ssh',
    )
    cloud = models.BooleanField(
        default=False,
        editable=False,
    )
    host = models.CharField(
        blank=True,
        default='',
        max_length=1024,
        verbose_name=_('Host'),
        help_text=_('The hostname or IP address to use.'),
    )
    username = models.CharField(
        blank=True,
        default='',
        max_length=1024,
        verbose_name=_('Username'),
        help_text=_('Username for this credential.'),
    )
    password = models.CharField(
        blank=True,
        default='',
        max_length=1024,
        verbose_name=_('Password'),
        help_text=_('Password for this credential (or "ASK" to prompt the '
                    'user for machine credentials).'),
    )
    security_token = models.CharField(
        blank=True,
        default='',
        max_length=1024,
        verbose_name=_('Security Token'),
        help_text=_('Security Token for this credential'),
    )
    project = models.CharField(
        blank=True,
        default='',
        max_length=100,
        verbose_name=_('Project'),
        help_text=_('The identifier for the project.'),
    )
    ssh_key_data = models.TextField(
        blank=True,
        default='',
        verbose_name=_('SSH private key'),
        help_text=_('RSA or DSA private key to be used instead of password.'),
    )
    ssh_key_unlock = models.CharField(
        max_length=1024,
        blank=True,
        default='',
        verbose_name=_('SSH key unlock'),
        help_text=_('Passphrase to unlock SSH private key if encrypted (or '
                    '"ASK" to prompt the user for machine credentials).'),
    )
    become_method = models.CharField(
        max_length=32,
        blank=True,
        default='',
        choices=BECOME_METHOD_CHOICES,
        help_text=_('Privilege escalation method.')
    )
    become_username = models.CharField(
        max_length=1024,
        blank=True,
        default='',
        help_text=_('Privilege escalation username.'),
    )
    become_password = models.CharField(
        max_length=1024,
        blank=True,
        default='',
        help_text=_('Password for privilege escalation method.')
    )
    vault_password = models.CharField(
        max_length=1024,
        blank=True,
        default='',
        help_text=_('Vault password (or "ASK" to prompt the user).'),
    )
    owner_role = ImplicitRoleField(
        role_name='Credential Owner',
        role_description='Owner of the credential',
        parent_role=[
            'singleton:' + ROLE_SINGLETON_SYSTEM_ADMINISTRATOR,
        ],
        permissions = {'all': True}
    )
    auditor_role = ImplicitRoleField(
        role_name='Credential Auditor',
        role_description='Auditor of the credential',
        parent_role=[
            'singleton:' + ROLE_SINGLETON_SYSTEM_AUDITOR,
        ],
        permissions = {'read': True}
    )
    usage_role = ImplicitRoleField(
        role_name='Credential User',
        role_description='May use this credential, but not read sensitive portions or modify it',
        permissions = {'use': True}
    )

    @property
    def needs_ssh_password(self):
        return self.kind == 'ssh' and self.password == 'ASK'

    @property
    def has_encrypted_ssh_key_data(self):
        if self.pk:
            ssh_key_data = decrypt_field(self, 'ssh_key_data')
        else:
            ssh_key_data = self.ssh_key_data
        try:
            key_data = validate_ssh_private_key(ssh_key_data)
        except ValidationError:
            return False
        else:
            return bool(key_data['key_enc'])

    @property
    def needs_ssh_key_unlock(self):
        if self.kind == 'ssh' and self.ssh_key_unlock in ('ASK', ''):
            return self.has_encrypted_ssh_key_data
        return False

    @property
    def needs_become_password(self):
        return self.kind == 'ssh' and self.become_password == 'ASK'

    @property
    def needs_vault_password(self):
        return self.kind == 'ssh' and self.vault_password == 'ASK'

    @property
    def passwords_needed(self):
        needed = []
        for field in ('ssh_password', 'become_password', 'ssh_key_unlock', 'vault_password'):
            if getattr(self, 'needs_%s' % field):
                needed.append(field)
        return needed

    def get_absolute_url(self):
        return reverse('api:credential_detail', args=(self.pk,))

    def clean_host(self):
        """Ensure that if this is a type of credential that requires a
        `host`, that a host is provided.
        """
        host = self.host or ''
        if not host and self.kind == 'vmware':
            raise ValidationError('Host required for VMware credential.')
        if not host and self.kind == 'openstack':
            raise ValidationError('Host required for OpenStack credential.')
        return host

    def clean_username(self):
        username = self.username or ''
        if not username and self.kind == 'aws':
            raise ValidationError('Access key required for AWS credential.')
        if not username and self.kind == 'rax':
            raise ValidationError('Username required for Rackspace '
                                  'credential.')
        if not username and self.kind == 'vmware':
            raise ValidationError('Username required for VMware credential.')
        if not username and self.kind == 'openstack':
            raise ValidationError('Username required for OpenStack credential.')
        return username

    def clean_password(self):
        password = self.password or ''
        if not password and self.kind == 'aws':
            raise ValidationError('Secret key required for AWS credential.')
        if not password and self.kind == 'rax':
            raise ValidationError('API key required for Rackspace credential.')
        if not password and self.kind == 'vmware':
            raise ValidationError('Password required for VMware credential.')
        if not password and self.kind == 'openstack':
            raise ValidationError('Password or API key required for OpenStack credential.')
        return password

    def clean_project(self):
        project = self.project or ''
        if self.kind == 'openstack' and not project:
            raise ValidationError('Project name required for OpenStack credential.')
        return project

    def clean_ssh_key_data(self):
        if self.pk:
            ssh_key_data = decrypt_field(self, 'ssh_key_data')
        else:
            ssh_key_data = self.ssh_key_data
        if ssh_key_data:
            # Sanity check: GCE, in particular, provides JSON-encoded private
            # keys, which developers will be tempted to copy and paste rather
            # than JSON decode.
            #
            # These end in a unicode-encoded final character that gets double
            # escaped due to being in a Python 2 bytestring, and that causes
            # Python's key parsing to barf. Detect this issue and correct it.
            if r'\u003d' in ssh_key_data:
                ssh_key_data = ssh_key_data.replace(r'\u003d', '=')
                self.ssh_key_data = ssh_key_data

            # Validate the private key to ensure that it looks like something
            # that we can accept.
            validate_ssh_private_key(ssh_key_data)
        return self.ssh_key_data # No need to return decrypted version here.

    def clean_ssh_key_unlock(self):
        if self.has_encrypted_ssh_key_data and not self.ssh_key_unlock:
            raise ValidationError('SSH key unlock must be set when SSH key '
                                  'is encrypted')
        return self.ssh_key_unlock

    def clean(self):
        if self.user and self.team:
            raise ValidationError('Credential cannot be assigned to both a user and team')

    def _validate_unique_together_with_null(self, unique_check, exclude=None):
        # Based on existing Django model validation code, except it doesn't
        # skip the check for unique violations when a field is None.  See:
        # https://github.com/django/django/blob/stable/1.5.x/django/db/models/base.py#L792
        errors = {}
        model_class = self.__class__
        if set(exclude or []) & set(unique_check):
            return
        lookup_kwargs = {}
        for field_name in unique_check:
            f = self._meta.get_field(field_name)
            lookup_value = getattr(self, f.attname)
            if f.primary_key and not self._state.adding:
                # no need to check for unique primary key when editing
                continue
            lookup_kwargs[str(field_name)] = lookup_value
        if len(unique_check) != len(lookup_kwargs):
            return
        qs = model_class._default_manager.filter(**lookup_kwargs)
        # Exclude the current object from the query if we are editing an
        # instance (as opposed to creating a new one)
        # Note that we need to use the pk as defined by model_class, not
        # self.pk. These can be different fields because model inheritance
        # allows single model to have effectively multiple primary keys.
        # Refs #17615.
        model_class_pk = self._get_pk_val(model_class._meta)
        if not self._state.adding and model_class_pk is not None:
            qs = qs.exclude(pk=model_class_pk)
        if qs.exists():
            key = NON_FIELD_ERRORS
            errors.setdefault(key, []).append(self.unique_error_message(model_class, unique_check))
        if errors:
            raise ValidationError(errors)

    def validate_unique(self, exclude=None):
        errors = {}
        try:
            super(Credential, self).validate_unique(exclude)
        except ValidationError, e:
            errors = e.update_error_dict(errors)
        try:
            unique_fields = ('user', 'team', 'kind', 'name')
            self._validate_unique_together_with_null(unique_fields, exclude)
        except ValidationError, e:
            errors = e.update_error_dict(errors)
        if errors:
            raise ValidationError(errors)

    def _password_field_allows_ask(self, field):
        return bool(self.kind == 'ssh' and field != 'ssh_key_data')

    def save(self, *args, **kwargs):
        # If update_fields has been specified, add our field names to it,
        # if hit hasn't been specified, then we're just doing a normal save.
        update_fields = kwargs.get('update_fields', [])
        # If updating a credential, make sure that we only allow user OR team
        # to be set, and clear out the other field based on which one has
        # changed.
        if self.pk:
            cred_before = Credential.objects.get(pk=self.pk)
            if self.user and self.team:
                # If the user changed, remove the previously assigned team.
                if cred_before.user != self.user:
                    self.team = None
                    if 'team' not in update_fields:
                        update_fields.append('team')
                # If the team changed, remove the previously assigned user.
                elif cred_before.team != self.team:
                    self.user = None
                    if 'user' not in update_fields:
                        update_fields.append('user')
        # Set cloud flag based on credential kind.
        cloud = self.kind in CLOUD_PROVIDERS + ('aws',)
        if self.cloud != cloud:
            self.cloud = cloud
            if 'cloud' not in update_fields:
                update_fields.append('cloud')
        super(Credential, self).save(*args, **kwargs)


def validate_ssh_private_key(data):
    """Validate that the given SSH private key or certificate is,
    in fact, valid.
    """
    # Map the X in BEGIN X PRIVATE KEY to the key type (ssh-keygen -t).
    # Tower jobs using OPENSSH format private keys may still fail if the
    # system SSH implementation lacks support for this format.
    key_types = {
        'RSA': 'rsa',
        'DSA': 'dsa',
        'EC': 'ecdsa',
        'OPENSSH': 'ed25519',
        '': 'rsa1',
    }
    # Key properties to return if valid.
    key_data = {
        'key_type': None,   # Key type (from above mapping).
        'key_seg': '',      # Key segment (all text including begin/end).
        'key_b64': '',      # Key data as base64.
        'key_bin': '',      # Key data as binary.
        'key_enc': None,    # Boolean, whether key is encrypted.
        'cert_seg': '',     # Cert segment (all text including begin/end).
        'cert_b64': '',     # Cert data as base64.
        'cert_bin': '',     # Cert data as binary.
    }
    data = data.strip()
    validation_error = ValidationError('Invalid private key')

    # Sanity check: We may potentially receive a full PEM certificate,
    # and we want to accept these.
    cert_begin_re = r'(-{4,})\s*BEGIN\s+CERTIFICATE\s*(-{4,})'
    cert_end_re = r'(-{4,})\s*END\s+CERTIFICATE\s*(-{4,})'
    cert_begin_match = re.search(cert_begin_re, data)
    cert_end_match = re.search(cert_end_re, data)
    if cert_begin_match and not cert_end_match:
        raise validation_error
    elif not cert_begin_match and cert_end_match:
        raise validation_error
    elif cert_begin_match and cert_end_match:
        cert_dashes = set([cert_begin_match.groups()[0], cert_begin_match.groups()[1],
                           cert_end_match.groups()[0], cert_end_match.groups()[1]])
        if len(cert_dashes) != 1:
            raise validation_error
        key_data['cert_seg'] = data[cert_begin_match.start():cert_end_match.end()]

    # Find the private key, and also ensure that it internally matches
    # itself.
    # Set up the valid private key header and footer.
    begin_re = r'(-{4,})\s*BEGIN\s+([A-Z0-9]+)?\s*PRIVATE\sKEY\s*(-{4,})'
    end_re = r'(-{4,})\s*END\s+([A-Z0-9]+)?\s*PRIVATE\sKEY\s*(-{4,})'
    begin_match = re.search(begin_re, data)
    end_match = re.search(end_re, data)
    if not begin_match or not end_match:
        raise validation_error

    # Ensure that everything, such as dash counts and key type, lines up,
    # and raise an error if it does not.
    dashes = set([begin_match.groups()[0], begin_match.groups()[2],
                  end_match.groups()[0], end_match.groups()[2]])
    if len(dashes) != 1:
        raise validation_error
    if begin_match.groups()[1] != end_match.groups()[1]:
        raise validation_error
    key_type = begin_match.groups()[1] or ''
    try:
        key_data['key_type'] = key_types[key_type]
    except KeyError:
        raise ValidationError('Invalid private key: unsupported type %s' % key_type)

    # The private key data begins and ends with the private key.
    key_data['key_seg'] = data[begin_match.start():end_match.end()]

    # Establish that we are able to base64 decode the private key;
    # if we can't, then it's not a valid key.
    #
    # If we got a certificate, validate that also, in the same way.
    header_re = re.compile(r'^(.+?):\s*?(.+?)(\\??)$')
    for segment_name in ('cert', 'key'):
        segment_to_validate = key_data['%s_seg' % segment_name]
        # If we have nothing; skip this one.
        # We've already validated that we have a private key above,
        # so we don't need to do it again.
        if not segment_to_validate:
            continue

        # Ensure that this segment is valid base64 data.
        base64_data = ''
        line_continues = False
        lines = segment_to_validate.splitlines()
        for line in lines[1:-1]:
            line = line.strip()
            if not line:
                continue
            if line_continues:
                line_continues = line.endswith('\\')
                continue
            line_match = header_re.match(line)
            if line_match:
                line_continues = line.endswith('\\')
                continue
            base64_data += line
        try:
            decoded_data = base64.b64decode(base64_data)
            if not decoded_data:
                raise validation_error
            key_data['%s_b64' % segment_name] = base64_data
            key_data['%s_bin' % segment_name] = decoded_data
        except TypeError:
            raise validation_error

    # Determine if key is encrypted.
    if key_data['key_type'] == 'ed25519':
        # See https://github.com/openssh/openssh-portable/blob/master/sshkey.c#L3218
        # Decoded key data starts with magic string (null-terminated), four byte
        # length field, followed by the ciphername -- if ciphername is anything
        # other than 'none' the key is encrypted.
        key_data['key_enc'] = not bool(key_data['key_bin'].startswith('openssh-key-v1\x00\x00\x00\x00\x04none'))
    else:
        key_data['key_enc'] = bool('ENCRYPTED' in key_data['key_seg'])

    return key_data
