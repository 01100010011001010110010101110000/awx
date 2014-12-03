# Copyright (c) 2014 AnsibleWorks, Inc.
# All Rights Reserved.

# Python
import codecs
import ConfigParser
import cStringIO
from distutils.version import StrictVersion as Version
import json
import logging
import os
import signal
import pipes
import re
import shutil
import stat
import subprocess
import tempfile
import time
import traceback
import urlparse
import uuid

import dateutil.parser

# Pexpect
import pexpect

# Celery
from celery import Task, task
from djcelery.models import PeriodicTask

# Django
from django.conf import settings
from django.db import transaction, DatabaseError
from django.utils.datastructures import SortedDict
from django.utils.timezone import now

# AWX
from awx.main.constants import CLOUD_PROVIDERS
from awx.main.models import * # Job, JobEvent, ProjectUpdate, InventoryUpdate,
                              # Schedule, UnifiedJobTemplate
from awx.main.queue import FifoQueue
from awx.main.utils import (get_ansible_version, decrypt_field, update_scm_url,
            ignore_inventory_computed_fields, emit_websocket_notification)

__all__ = ['RunJob', 'RunSystemJob', 'RunProjectUpdate', 'RunInventoryUpdate',
           'handle_work_error', 'update_inventory_computed_fields']

HIDDEN_PASSWORD = '**********'

logger = logging.getLogger('awx.main.tasks')

@task()
def bulk_inventory_element_delete(inventory, hosts=[], groups=[]):
    from awx.main.signals import disable_activity_stream
    with ignore_inventory_computed_fields():
        with disable_activity_stream():
            for group in groups:
                Group.objects.get(id=group).mark_inactive(skip_active_check=True)
            for host in hosts:
                Host.objects.get(id=host).mark_inactive(skip_active_check=True)
    update_inventory_computed_fields(inventory)

@task(bind=True)
def tower_periodic_scheduler(self):
    def get_last_run():
        if not os.path.exists(settings.SCHEDULE_METADATA_LOCATION):
            return None
        fd = open(settings.SCHEDULE_METADATA_LOCATION)
        try:
            last_run = dateutil.parser.parse(fd.read())
            return last_run
        except Exception, e:
            return None
    def write_last_run(last_run):
        fd = open(settings.SCHEDULE_METADATA_LOCATION, 'w')
        fd.write(last_run.isoformat())
        fd.close()

    run_now = now()
    last_run = get_last_run()
    if not last_run:
        logger.debug("First run time")
        write_last_run(run_now)
        return
    logger.debug("Last run was: %s", last_run)
    write_last_run(run_now)
    old_schedules = Schedule.objects.enabled().before(last_run)
    for schedule in old_schedules:
        schedule.save()
    schedules = Schedule.objects.enabled().between(last_run, run_now)
    for schedule in schedules:
        template = schedule.unified_job_template
        schedule.save() # To update next_run timestamp.
        if template.cache_timeout_blocked:
            logger.warn("Cache timeout is in the future, bypassing schedule for template %s" % str(template.id))
            continue
        new_unified_job = template.create_unified_job(launch_type='scheduled', schedule=schedule)
        can_start = new_unified_job.signal_start(**schedule.extra_data)
        if not can_start:
            new_unified_job.status = 'failed'
            new_unified_job.job_explanation = "Scheduled job could not start because it was not in the right state or required manual credentials"
            new_unified_job.save(update_fields=['job_status', 'job_explanation'])
            new_unified_job.socketio_emit_status("failed")
        emit_websocket_notification('/socket.io/schedules', 'schedule_changed', dict(id=schedule.id))

@task()
def notify_task_runner(metadata_dict):
    """Add the given task into the Tower task manager's queue, to be consumed
    by the task system.
    """
    queue = FifoQueue('tower_task_manager')
    queue.push(metadata_dict)

@task(bind=True)
def handle_work_error(self, task_id, subtasks=None):
    print('Executing error task id %s, subtasks: %s' %
          (str(self.request.id), str(subtasks)))
    first_task = None
    first_task_type = ''
    first_task_name = ''
    if subtasks is not None:
        for each_task in subtasks:
            instance_name = ''
            if each_task['type'] == 'project_update':
                instance = ProjectUpdate.objects.get(id=each_task['id'])
                instance_name = instance.project.name
            elif each_task['type'] == 'inventory_update':
                instance = InventoryUpdate.objects.get(id=each_task['id'])
                instance_name = instance.inventory_source.inventory.name
            elif each_task['type'] == 'job':
                instance = Job.objects.get(id=each_task['id'])
                instance_name = instance.job_template.name
            else:
                # Unknown task type
                break
            if first_task is None:
                first_task = instance
                first_task_type = each_task['type']
                first_task_name = instance_name
            if instance.celery_task_id != task_id:
                instance.status = 'failed'
                instance.failed = True
                instance.job_explanation = "Previous Task Failed: %s for %s with celery task id: %s" % \
                    (first_task_type, first_task_name, task_id)
                instance.save()
                instance.socketio_emit_status("failed")

@task()
def update_inventory_computed_fields(inventory_id, should_update_hosts=True):
    '''
    Signal handler and wrapper around inventory.update_computed_fields to
    prevent unnecessary recursive calls.
    '''
    i = Inventory.objects.filter(id=inventory_id)
    if not i.exists():
        logger.error("Update Inventory Computed Fields failed due to missing inventory: " + str(inventory_id))
    i = i[0]
    i.update_computed_fields(update_hosts=should_update_hosts)


class BaseTask(Task):
    name = None
    model = None
    abstract = True

    def update_model(self, pk, _attempt=0, **updates):
        """Reload the model instance from the database and update the
        given fields.
        """
        output_replacements = updates.pop('output_replacements', None) or []

        try:
            with transaction.atomic():
                # Retrieve the model instance.
                instance = self.model.objects.get(pk=pk)

                # Update the appropriate fields and save the model
                # instance, then return the new instance.
                if updates:
                    update_fields = ['modified']
                    for field, value in updates.items():
                        if field in ('result_stdout', 'result_traceback'):
                            for srch, repl in output_replacements:
                                value = value.replace(srch, repl)
                        setattr(instance, field, value)
                        update_fields.append(field)
                        if field == 'status':
                            update_fields.append('failed')
                    instance.save(update_fields=update_fields)
                return instance
        except DatabaseError as e:
            # Log out the error to the debug logger.
            logger.debug('Database error updating %s, retrying in 5 '
                         'seconds (retry #%d): %s',
                         self.model._meta.object_name, _attempt + 1, e)

            # Attempt to retry the update, assuming we haven't already
            # tried too many times.
            if _attempt < 5:
                time.sleep(5)
                return self.update_model(pk,
                    _attempt=_attempt + 1,
                    output_replacements=output_replacements,
                    **updates
                )
            else:
                logger.error('Failed to update %s after %d retries.',
                             self.model._meta.object_name, retry_count)

    def signal_finished(self, pk):
        pass
        # notify_task_runner(dict(complete=pk))

    def get_path_to(self, *args):
        '''
        Return absolute path relative to this file.
        '''
        return os.path.abspath(os.path.join(os.path.dirname(__file__), *args))

    def build_private_data(self, instance, **kwargs):
        '''
        Return any private data that needs to be written to a temporary file
        for this task.
        '''

    def build_private_data_dir(self, instance, **kwargs):
        '''
        Create a temporary directory for job-related files.
        '''
        path = tempfile.mkdtemp(prefix='ansible_tower_')
        os.chmod(path, stat.S_IRUSR|stat.S_IWUSR|stat.S_IXUSR)
        return path

    def build_private_data_file(self, instance, **kwargs):
        '''
        Create a temporary file containing the private data.
        '''
        private_data = self.build_private_data(instance, **kwargs)
        if private_data is not None:
            handle, path = tempfile.mkstemp(dir=kwargs.get('private_data_dir', None))
            f = os.fdopen(handle, 'w')
            f.write(private_data)
            f.close()
            os.chmod(path, stat.S_IRUSR|stat.S_IWUSR)
            return path
        else:
            return ''

    def build_passwords(self, instance, **kwargs):
        '''
        Build a dictionary of passwords for responding to prompts.
        '''
        return {
            'yes': 'yes',
            'no': 'no',
            '': '',
        }

    def build_env(self, instance, **kwargs):
        '''
        Build environment dictionary for ansible-playbook.
        '''
        env = dict(os.environ.items())
        # Add ANSIBLE_* settings to the subprocess environment.
        for attr in dir(settings):
            if attr == attr.upper() and attr.startswith('ANSIBLE_'):
                env[attr] = str(getattr(settings, attr))
        # Also set environment variables configured in AWX_TASK_ENV setting.
        for key, value in settings.AWX_TASK_ENV.items():
            env[key] = str(value)
        # Set environment variables needed for inventory and job event
        # callbacks to work.
        # Update PYTHONPATH to use local site-packages.
        python_paths = env.get('PYTHONPATH', '').split(os.pathsep)
        local_site_packages = self.get_path_to('..', 'lib', 'site-packages')
        if local_site_packages not in python_paths:
            python_paths.insert(0, local_site_packages)
        env['PYTHONPATH'] = os.pathsep.join(python_paths)
        return env

    def build_safe_env(self, instance, **kwargs):
        '''
        Build environment dictionary, hiding potentially sensitive information
        such as passwords or keys.
        '''
        hidden_re = re.compile(r'API|TOKEN|KEY|SECRET|PASS', re.I)
        urlpass_re = re.compile(r'^.*?://.?:(.*?)@.*?$')
        env = self.build_env(instance, **kwargs)
        for k,v in env.items():
            if k in ('REST_API_URL', 'AWS_ACCESS_KEY', 'AWS_ACCESS_KEY_ID'):
                continue
            elif k.startswith('ANSIBLE_'):
                continue
            elif hidden_re.search(k):
                env[k] = HIDDEN_PASSWORD
            elif type(v) == str and urlpass_re.match(v):
                env[k] = urlpass_re.sub(HIDDEN_PASSWORD, v)
        return env

    def args2cmdline(self, *args):
        return ' '.join([pipes.quote(a) for a in args])

    def wrap_args_with_ssh_agent(self, args, ssh_key_path):
        if ssh_key_path:
            cmd = ' && '.join([self.args2cmdline('ssh-add', ssh_key_path),
                               self.args2cmdline(*args)])
            args = ['ssh-agent', 'sh', '-c', cmd]
        return args

    def should_use_proot(self, instance, **kwargs):
        '''
        Return whether this task should use proot.
        '''
        return False

    def check_proot_installed(self):
        '''
        Check that proot is installed.
        '''
        cmd = [getattr(settings, 'AWX_PROOT_CMD', 'proot'), '--version']
        try:
            proc = subprocess.Popen(cmd, stdout=subprocess.PIPE,
                                    stderr=subprocess.PIPE)
            result = proc.communicate()
            return bool(proc.returncode == 0)
        except (OSError, ValueError):
            return False

    def build_proot_temp_dir(self, instance, **kwargs):
        '''
        Create a temporary directory for proot to use.
        '''
        path = tempfile.mkdtemp(prefix='ansible_tower_proot_')
        os.chmod(path, stat.S_IRUSR|stat.S_IWUSR|stat.S_IXUSR)
        return path

    def wrap_args_with_proot(self, args, cwd, **kwargs):
        '''
        Wrap existing command line with proot to restrict access to:
         - /etc/tower (to prevent obtaining db info or secret key)
         - /var/lib/awx (except for current project)
         - /var/log/tower
         - /var/log/supervisor
         - /tmp (except for own tmp files)
        '''
        new_args = [getattr(settings, 'AWX_PROOT_CMD', 'proot'), '-r', '/']
        hide_paths = ['/etc/tower', '/var/lib/awx', '/var/log',
                      tempfile.gettempdir(), settings.PROJECTS_ROOT,
                      settings.JOBOUTPUT_ROOT]
        hide_paths.extend(getattr(settings, 'AWX_PROOT_HIDE_PATHS', None) or [])
        for path in sorted(set(hide_paths)):
            if not os.path.exists(path):
                continue
            if os.path.isdir(path):
                new_path = tempfile.mkdtemp(dir=kwargs['proot_temp_dir'])
                os.chmod(new_path, stat.S_IRUSR|stat.S_IWUSR|stat.S_IXUSR)
            else:
                handle, new_path = tempfile.mkstemp(dir=kwargs['proot_temp_dir'])
                os.close(handle)
                os.chmod(new_path, stat.S_IRUSR|stat.S_IWUSR)
            new_args.extend(['-b', '%s:%s' % (new_path, path)])
        show_paths = [cwd, kwargs['private_data_dir']]
        show_paths.extend(getattr(settings, 'AWX_PROOT_SHOW_PATHS', None) or [])
        for path in sorted(set(show_paths)):
            if not os.path.exists(path):
                continue
            new_args.extend(['-b', '%s:%s' % (path, path)])
        new_args.extend(['-w', cwd])
        new_args.extend(args)
        return new_args

    def build_args(self, instance, **kwargs):
        raise NotImplementedError

    def build_safe_args(self, instance, **kwargs):
        return self.build_args(instance, **kwargs)

    def build_cwd(self, instance, **kwargs):
        raise NotImplementedError

    def build_output_replacements(self, instance, **kwargs):
        return []

    def get_idle_timeout(self):
        return None

    def get_password_prompts(self):
        '''
        Return a dictionary where keys are strings or regular expressions for
        prompts, and values are password lookup keys (keys that are returned
        from build_passwords).
        '''
        return SortedDict()

    def run_pexpect(self, instance, args, cwd, env, passwords, stdout_handle,
                    output_replacements=None):
        '''
        Run the given command using pexpect to capture output and provide
        passwords when requested.
        '''
        logfile = stdout_handle
        logfile_pos = logfile.tell()
        child = pexpect.spawnu(args[0], args[1:], cwd=cwd, env=env)
        child.logfile_read = logfile
        canceled = False
        last_stdout_update = time.time()
        idle_timeout = self.get_idle_timeout()
        expect_list = []
        expect_passwords = {}
        pexpect_timeout = getattr(settings, 'PEXPECT_TIMEOUT', 5)
        for n, item in enumerate(self.get_password_prompts().items()):
            expect_list.append(item[0])
            expect_passwords[n] = passwords.get(item[1], '') or ''
        expect_list.extend([pexpect.TIMEOUT, pexpect.EOF])
        instance = self.update_model(instance.pk, status='running',
                                     output_replacements=output_replacements)
        while child.isalive():
            result_id = child.expect(expect_list, timeout=pexpect_timeout)
            if result_id in expect_passwords:
                child.sendline(expect_passwords[result_id])
            if logfile_pos != logfile.tell():
                logfile_pos = logfile.tell()
                last_stdout_update = time.time()
            # Refresh model instance from the database (to check cancel flag).
            instance = self.update_model(instance.pk)
            if instance.cancel_flag:
                os.kill(child.pid, signal.SIGINT)
                time.sleep(3)
                # The following line causes orphaned ansible processes
                # child.terminate(canceled)
                canceled = True
            if idle_timeout and (time.time() - last_stdout_update) > idle_timeout:
                child.close(True)
                canceled = True
        if canceled:
            return 'canceled'
        elif child.exitstatus == 0:
            return 'successful'
        else:
            return 'failed'

    def post_run_hook(self, instance, **kwargs):
        '''
        Hook for any steps to run after job/task is complete.
        '''

    def run(self, pk, **kwargs):
        '''
        Run the job/task and capture its output.
        '''
        instance = self.update_model(pk, status='running', celery_task_id=self.request.id)

        instance.socketio_emit_status("running")
        status, tb = 'error', ''
        output_replacements = []
        try:
            if instance.cancel_flag:
                instance = self.update_model(instance.pk, status='canceled')
            if instance.status != 'running':
                if hasattr(settings, 'CELERY_UNIT_TEST'):
                    return
                else:
                    # Stop the task chain and prevent starting the job if it has
                    # already been canceled.
                    instance = self.update_model(pk)
                    status = instance.status
                    raise RuntimeError('not starting %s task' % instance.status)
            # Fetch ansible version once here to support version-dependent features.
            kwargs['ansible_version'] = get_ansible_version()
            kwargs['private_data_dir'] = self.build_private_data_dir(instance, **kwargs)
            kwargs['private_data_file'] = self.build_private_data_file(instance, **kwargs)
            kwargs['passwords'] = self.build_passwords(instance, **kwargs)
            args = self.build_args(instance, **kwargs)
            safe_args = self.build_safe_args(instance, **kwargs)
            output_replacements = self.build_output_replacements(instance, **kwargs)
            cwd = self.build_cwd(instance, **kwargs)
            env = self.build_env(instance, **kwargs)
            safe_env = self.build_safe_env(instance, **kwargs)
            if not os.path.exists(settings.JOBOUTPUT_ROOT):
                os.makedirs(settings.JOBOUTPUT_ROOT)
            stdout_filename = os.path.join(settings.JOBOUTPUT_ROOT, str(uuid.uuid1()) + ".out")
            stdout_handle = codecs.open(stdout_filename, 'w', encoding='utf-8')
            if self.should_use_proot(instance, **kwargs):
                if not self.check_proot_installed():
                    raise RuntimeError('proot is not installed')
                kwargs['proot_temp_dir'] = self.build_proot_temp_dir(instance, **kwargs)
                args = self.wrap_args_with_proot(args, cwd, **kwargs)
                safe_args = self.wrap_args_with_proot(safe_args, cwd, **kwargs)
            instance = self.update_model(pk, job_args=json.dumps(safe_args),
                                         job_cwd=cwd, job_env=safe_env, result_stdout_file=stdout_filename)
            status = self.run_pexpect(instance, args, cwd, env, kwargs['passwords'], stdout_handle)
        except Exception:
            if status != 'canceled':
                tb = traceback.format_exc()
        finally:
            if kwargs.get('private_data_dir', ''):
                try:
                    shutil.rmtree(kwargs['private_data_dir'], True)
                except OSError:
                    pass
            if kwargs.get('proot_temp_dir', ''):
                try:
                    shutil.rmtree(kwargs['proot_temp_dir'], True)
                except OSError:
                    pass
            try:
                stdout_handle.flush()
                stdout_handle.close()
            except Exception:
                pass
        instance = self.update_model(pk, status=status, result_traceback=tb,
                                     output_replacements=output_replacements)
        self.post_run_hook(instance, **kwargs)
        instance.socketio_emit_status(status)
        if status != 'successful' and not hasattr(settings, 'CELERY_UNIT_TEST'):
            # Raising an exception will mark the job as 'failed' in celery
            # and will stop a task chain from continuing to execute
            if status == 'canceled':
                raise Exception("Task %s(pk:%s) was canceled" % (str(self.model.__class__), str(pk)))
            else:
                raise Exception("Task %s(pk:%s) encountered an error" % (str(self.model.__class__), str(pk)))
        if not hasattr(settings, 'CELERY_UNIT_TEST'):
            self.signal_finished(pk)


class RunJob(BaseTask):
    '''
    Celery task to run a job using ansible-playbook.
    '''

    name = 'awx.main.tasks.run_job'
    model = Job

    def build_private_data(self, job, **kwargs):
        '''
        Return SSH private key data needed for this job (only if stored in DB
        as ssh_key_data).
        '''
        # If we were sent SSH credentials, decrypt them and send them
        # back (they will be written to a temporary file).
        credential = getattr(job, 'credential', None)
        if credential:
            return decrypt_field(credential, 'ssh_key_data') or None

        # We might also have been sent a cloud credential. If so, send it.
        #
        # This sets up an either/or situation with credential and cloud
        # credential when it comes to SSH data. This should be fine, as if
        # you're running against cloud instances, you'll be using the cloud
        # credentials to do so. I assert that no situation currently exists
        # where we need both.
        cloud_credential = getattr(job, 'cloud_credential', None)
        if cloud_credential:
            return decrypt_field(cloud_credential, 'ssh_key_data') or None

    def build_passwords(self, job, **kwargs):
        '''
        Build a dictionary of passwords for SSH private key, SSH user, sudo/su
        and ansible-vault.
        '''
        passwords = super(RunJob, self).build_passwords(job, **kwargs)
        creds = job.credential
        if creds:
            for field in ('ssh_key_unlock', 'ssh_password', 'sudo_password', 'su_password', 'vault_password'):
                if field == 'ssh_password':
                    value = kwargs.get(field, decrypt_field(creds, 'password'))
                else:
                    value = kwargs.get(field, decrypt_field(creds, field))
                if value not in ('', 'ASK'):
                    passwords[field] = value
        return passwords

    def build_env(self, job, **kwargs):
        '''
        Build environment dictionary for ansible-playbook.
        '''
        plugin_dir = self.get_path_to('..', 'plugins', 'callback')
        env = super(RunJob, self).build_env(job, **kwargs)
        # Set environment variables needed for inventory and job event
        # callbacks to work.
        env['JOB_ID'] = str(job.pk)
        env['INVENTORY_ID'] = str(job.inventory.pk)
        env['ANSIBLE_CALLBACK_PLUGINS'] = plugin_dir
        env['REST_API_URL'] = settings.INTERNAL_API_URL
        env['REST_API_TOKEN'] = job.task_auth_token or ''
        #env['CALLBACK_CONSUMER_PORT'] = settings.CALLBACK_CONSUMER_PORT
        if getattr(settings, 'JOB_CALLBACK_DEBUG', False):
            env['JOB_CALLBACK_DEBUG'] = '2'
        elif settings.DEBUG:
            env['JOB_CALLBACK_DEBUG'] = '1'

        # When using Ansible >= 1.3, allow the inventory script to include host
        # variables inline via ['_meta']['hostvars'].
        try:
            if Version(kwargs['ansible_version']) >= Version('1.3'):
                env['INVENTORY_HOSTVARS'] = str(True)
        except ValueError:
            pass

        # Set environment variables for cloud credentials.
        cloud_cred = job.cloud_credential
        if cloud_cred and cloud_cred.kind == 'aws':
            env['AWS_ACCESS_KEY'] = cloud_cred.username
            env['AWS_SECRET_KEY'] = decrypt_field(cloud_cred, 'password')
            # FIXME: Add EC2_URL, maybe EC2_REGION!
        elif cloud_cred and cloud_cred.kind == 'rax':
            env['RAX_USERNAME'] = cloud_cred.username
            env['RAX_API_KEY'] = decrypt_field(cloud_cred, 'password')
        elif cloud_cred and cloud_cred.kind == 'gce':
            env['GCE_EMAIL'] = cloud_cred.username
            env['GCE_PROJECT'] = cloud_cred.project
            env['GCE_PEM_FILE_PATH'] = kwargs['private_data_file']
        elif cloud_cred and cloud_cred.kind == 'azure':
            env['AZURE_SUBSCRIPTION_ID'] = cloud_cred.username
            env['AZURE_CERT_PATH'] = kwargs['private_data_file']
        elif cloud_cred and cloud_cred.kind == 'vmware':
            env['VMWARE_USER'] = cloud_cred.username
            env['VMWARE_PASSWORD'] = decrypt_field(cloud_cred, 'password')
            env['VMWARE_HOST'] = cloud_cred.host

        return env

    def build_args(self, job, **kwargs):
        '''
        Build command line argument list for running ansible-playbook,
        optionally using ssh-agent for public/private key authentication.
        '''
        creds = job.credential
        ssh_username, sudo_username, su_username = '', '', ''
        if creds:
            ssh_username = kwargs.get('username', creds.username)
            sudo_username = kwargs.get('sudo_username', creds.sudo_username)
            su_username = kwargs.get('su_username', creds.su_username)
        # Always specify the normal SSH user as root by default.  Since this
        # task is normally running in the background under a service account,
        # it doesn't make sense to rely on ansible-playbook's default of using
        # the current user.
        ssh_username = ssh_username or 'root'
        inventory_script = self.get_path_to('..', 'plugins', 'inventory',
                                            'awxrest.py')
        args = ['ansible-playbook', '-i', inventory_script]
        if job.job_type == 'check':
            args.append('--check')
        args.extend(['-u', ssh_username])
        if 'ssh_password' in kwargs.get('passwords', {}):
            args.append('--ask-pass')
        # We only specify sudo/su user and password if explicitly given by the
        # credential.  Credential should never specify both sudo and su.
        if su_username:
            args.extend(['-R', su_username])
        if 'su_password' in kwargs.get('passwords', {}):
            args.append('--ask-su-pass')
        if sudo_username:
            args.extend(['-U', sudo_username])
        if 'sudo_password' in kwargs.get('passwords', {}):
            args.append('--ask-sudo-pass')

        # When using Ansible >= 1.5, support prompting for a vault password.
        try:
            if Version(kwargs['ansible_version']) >= Version('1.5'):
                if 'vault_password' in kwargs.get('passwords', {}):
                    args.append('--ask-vault-pass')
        except ValueError:
            pass

        if job.forks:  # FIXME: Max limit?
            args.append('--forks=%d' % job.forks)
        if job.force_handlers:
            args.append('--force-handlers')
        if job.limit:
            args.extend(['-l', job.limit])
        if job.verbosity:
            args.append('-%s' % ('v' * min(3, job.verbosity)))
        if job.job_tags:
            args.extend(['-t', job.job_tags])
        if job.skip_tags:
            args.append('--skip-tags=%s' % job.skip_tags)
        if job.start_at_task:
            args.append('--start-at-task=%s' % job.start_at_task)

        # Define special extra_vars for Tower, combine with job.extra_vars.
        extra_vars = {
            'tower_job_id': job.pk,
            'tower_job_launch_type': job.launch_type,
        }
        if job.job_template and job.job_template.active:
            extra_vars.update({
                'tower_job_template_id': job.job_template.pk,
                'tower_job_template_name': job.job_template.name,
            })
        if job.created_by and job.created_by.is_active:
            extra_vars.update({
                'tower_user_id': job.created_by.pk,
                'tower_user_name': job.created_by.username,
            })
        if job.extra_vars_dict:
            extra_vars.update(job.extra_vars_dict)
        args.extend(['-e', json.dumps(extra_vars)])

        # Add path to playbook (relative to project.local_path).
        args.append(job.playbook)

        # If using an SSH key, run using ssh-agent.
        ssh_key_path = kwargs.get('private_data_file', '')
        if ssh_key_path:
            args = self.wrap_args_with_ssh_agent(args, ssh_key_path)

        return args

    def build_cwd(self, job, **kwargs):
        cwd = job.project.get_project_path()
        if not cwd:
            root = settings.PROJECTS_ROOT
            raise RuntimeError('project local_path %s cannot be found in %s' %
                               (job.project.local_path, root))
        return cwd

    def get_idle_timeout(self):
        return getattr(settings, 'JOB_RUN_IDLE_TIMEOUT', None)

    def get_password_prompts(self):
        d = super(RunJob, self).get_password_prompts()
        d[re.compile(r'^Enter passphrase for .*:\s*?$', re.M)] = 'ssh_key_unlock'
        d[re.compile(r'^Bad passphrase, try again for .*:\s*?$', re.M)] = ''
        d[re.compile(r'^sudo password.*:\s*?$', re.M)] = 'sudo_password'
        d[re.compile(r'^su password.*:\s*?$', re.M)] = 'su_password'
        d[re.compile(r'^SSH password:\s*?$', re.M)] = 'ssh_password'
        d[re.compile(r'^Password:\s*?$', re.M)] = 'ssh_password'
        d[re.compile(r'^Vault password:\s*?$', re.M)] = 'vault_password'
        return d

    def should_use_proot(self, instance, **kwargs):
        '''
        Return whether this task should use proot.
        '''
        return getattr(settings, 'AWX_PROOT_ENABLED', False)

    def post_run_hook(self, job, **kwargs):
        '''
        Hook for actions to run after job/task has completed.
        '''
        super(RunJob, self).post_run_hook(job, **kwargs)
        try:
            inventory = job.inventory
        except Inventory.DoesNotExist:
            pass
        else:
            update_inventory_computed_fields.delay(inventory.id, True)
        # Update job event fields after job has completed (only when using REST
        # API callback).
        if not settings.CALLBACK_CONSUMER_PORT:
            for job_event in job.job_events.order_by('pk'):
                job_event.save(post_process=True)


class RunProjectUpdate(BaseTask):

    name = 'awx.main.tasks.run_project_update'
    model = ProjectUpdate

    def build_private_data(self, project_update, **kwargs):
        '''
        Return SSH private key data needed for this project update.
        '''
        if project_update.credential:
            return decrypt_field(project_update.credential, 'ssh_key_data') or None

    def build_passwords(self, project_update, **kwargs):
        '''
        Build a dictionary of passwords for SSH private key unlock and SCM
        username/password.
        '''
        passwords = super(RunProjectUpdate, self).build_passwords(project_update,
                                                                  **kwargs)
        if project_update.credential:
            passwords['scm_key_unlock'] = decrypt_field(project_update.credential,
                                                        'ssh_key_unlock')
            passwords['scm_username'] = project_update.credential.username
            passwords['scm_password'] = decrypt_field(project_update.credential,
                                                     'password')
        return passwords

    def build_env(self, project_update, **kwargs):
        '''
        Build environment dictionary for ansible-playbook.
        '''
        env = super(RunProjectUpdate, self).build_env(project_update, **kwargs)
        env['ANSIBLE_ASK_PASS'] = str(False)
        env['ANSIBLE_ASK_SUDO_PASS'] = str(False)
        env['DISPLAY'] = '' # Prevent stupid password popup when running tests.
        return env

    def _build_scm_url_extra_vars(self, project_update, **kwargs):
        '''
        Helper method to build SCM url and extra vars with parameters needed
        for authentication.
        '''
        extra_vars = {}
        scm_type = project_update.scm_type
        scm_url = update_scm_url(scm_type, project_update.scm_url,
                                 check_special_cases=False)
        scm_url_parts = urlparse.urlsplit(scm_url)
        scm_username = kwargs.get('passwords', {}).get('scm_username', '')
        scm_password = kwargs.get('passwords', {}).get('scm_password', '')
        # Prefer the username/password in the URL, if provided.
        scm_username = scm_url_parts.username or scm_username or ''
        scm_password = scm_url_parts.password or scm_password or ''
        if scm_username:
            if scm_type == 'svn':
                extra_vars['scm_username'] = scm_username
                extra_vars['scm_password'] = scm_password
                scm_password = False
                if scm_url_parts.scheme != 'svn+ssh':
                    scm_username = False
            elif scm_url_parts.scheme == 'ssh':
                scm_password = False
            scm_url = update_scm_url(scm_type, scm_url, scm_username,
                                     scm_password)

        # When using Ansible >= 1.5, pass the extra accept_hostkey parameter to
        # the git module.
        if scm_type == 'git' and scm_url_parts.scheme == 'ssh':
            try:
                if Version(kwargs['ansible_version']) >= Version('1.5'):
                    extra_vars['scm_accept_hostkey'] = 'true'
            except ValueError:
                pass

        return scm_url, extra_vars

    def build_args(self, project_update, **kwargs):
        '''
        Build command line argument list for running ansible-playbook,
        optionally using ssh-agent for public/private key authentication.
        '''
        args = ['ansible-playbook', '-i', 'localhost,']
        if getattr(settings, 'PROJECT_UPDATE_VVV', False):
            args.append('-vvv')
        else:
            args.append('-v')
        scm_url, extra_vars = self._build_scm_url_extra_vars(project_update,
                                                             **kwargs)
        scm_branch = project_update.scm_branch or {'hg': 'tip'}.get(project_update.scm_type, 'HEAD')
        extra_vars.update({
            'project_path': project_update.get_project_path(check_if_exists=False),
            'scm_type': project_update.scm_type,
            'scm_url': scm_url,
            'scm_branch': scm_branch,
            'scm_clean': project_update.scm_clean,
            'scm_delete_on_update': project_update.scm_delete_on_update,
        })
        args.extend(['-e', json.dumps(extra_vars)])
        args.append('project_update.yml')

        # If using an SSH key, run using ssh-agent.
        ssh_key_path = kwargs.get('private_data_file', '')
        if ssh_key_path:
            args = self.wrap_args_with_ssh_agent(args, ssh_key_path)

        return args

    def build_safe_args(self, project_update, **kwargs):
        pwdict = dict(kwargs.get('passwords', {}).items())
        for pw_name, pw_val in pwdict.items():
            if pw_name in ('', 'yes', 'no', 'scm_username'):
                continue
            pwdict[pw_name] = HIDDEN_PASSWORD
        kwargs['passwords'] = pwdict
        return self.build_args(project_update, **kwargs)

    def build_cwd(self, project_update, **kwargs):
        return self.get_path_to('..', 'playbooks')

    def build_output_replacements(self, project_update, **kwargs):
        '''
        Return search/replace strings to prevent output URLs from showing
        sensitive passwords.
        '''
        output_replacements = []
        before_url = self._build_scm_url_extra_vars(project_update,
                                                    **kwargs)[0]
        scm_username = kwargs.get('passwords', {}).get('scm_username', '')
        scm_password = kwargs.get('passwords', {}).get('scm_password', '')
        pwdict = dict(kwargs.get('passwords', {}).items())
        for pw_name, pw_val in pwdict.items():
            if pw_name in ('', 'yes', 'no', 'scm_username'):
                continue
            pwdict[pw_name] = HIDDEN_PASSWORD
        kwargs['passwords'] = pwdict
        after_url = self._build_scm_url_extra_vars(project_update,
                                                   **kwargs)[0]
        if after_url != before_url:
            output_replacements.append((before_url, after_url))
        if project_update.scm_type == 'svn' and scm_username and scm_password:
            d_before = {
                'username': scm_username,
                'password': scm_password,
            }
            d_after = {
                'username': scm_username,
                'password': HIDDEN_PASSWORD,
            }
            pattern1 = "username=\"%(username)s\" password=\"%(password)s\""
            pattern2 = "--username '%(username)s' --password '%(password)s'"
            output_replacements.append((pattern1 % d_before, pattern1 % d_after))
            output_replacements.append((pattern2 % d_before, pattern2 % d_after))
        return output_replacements

    def get_password_prompts(self):
        d = super(RunProjectUpdate, self).get_password_prompts()
        d[re.compile(r'^Username for.*:\s*?$', re.M)] = 'scm_username'
        d[re.compile(r'^Password for.*:\s*?$', re.M)] = 'scm_password'
        d[re.compile(r'^Password:\s*?$', re.M)] = 'scm_password'
        d[re.compile(r'^\S+?@\S+?\'s\s+?password:\s*?$', re.M)] = 'scm_password'
        d[re.compile(r'^Enter passphrase for .*:\s*?$', re.M)] = 'scm_key_unlock'
        d[re.compile(r'^Bad passphrase, try again for .*:\s*?$', re.M)] = ''
        # FIXME: Configure whether we should auto accept host keys?
        d[re.compile(r'^Are you sure you want to continue connecting \(yes/no\)\?\s*?$', re.M)] = 'yes'
        return d

    def get_idle_timeout(self):
        return getattr(settings, 'PROJECT_UPDATE_IDLE_TIMEOUT', None)


class RunInventoryUpdate(BaseTask):

    name = 'awx.main.tasks.run_inventory_update'
    model = InventoryUpdate

    def build_private_data(self, inventory_update, **kwargs):
        """Return private data needed for inventory update.
        If no private data is needed, return None.
        """
        # If this is Microsoft Azure or GCE, return the RSA key
        if inventory_update.source in ('azure', 'gce'):
            credential = inventory_update.credential
            return decrypt_field(credential, 'ssh_key_data')

        cp = ConfigParser.ConfigParser()
        # Build custom ec2.ini for ec2 inventory script to use.
        if inventory_update.source == 'ec2':
            section = 'ec2'
            cp.add_section(section)
            ec2_opts = dict(inventory_update.source_vars_dict.items())
            regions = inventory_update.source_regions or 'all'
            regions = ','.join([x.strip() for x in regions.split(',')])
            regions_blacklist = ','.join(settings.EC2_REGIONS_BLACKLIST)
            ec2_opts['regions'] = regions
            ec2_opts.setdefault('regions_exclude', regions_blacklist)
            ec2_opts.setdefault('destination_variable', 'public_dns_name')
            ec2_opts.setdefault('vpc_destination_variable', 'ip_address')
            ec2_opts.setdefault('route53', 'False')
            ec2_opts.setdefault('all_instances', 'True')
            ec2_opts.setdefault('all_rds_instances', 'False')
            ec2_opts.setdefault('rds', 'False')
            ec2_opts.setdefault('nested_groups', 'True')
            if inventory_update.instance_filters:
                ec2_opts.setdefault('instance_filters', inventory_update.instance_filters)
            group_by = [x.strip().lower() for x in inventory_update.group_by.split(',') if x.strip()]
            for choice in inventory_update.get_ec2_group_by_choices():
                value = bool((group_by and choice[0] in group_by) or (not group_by and choice[0] != 'instance_id'))
                ec2_opts.setdefault('group_by_%s' % choice[0], str(value))
            if 'cache_path' not in ec2_opts:
                cache_path = tempfile.mkdtemp(prefix='ec2_cache', dir=kwargs.get('private_data_dir', None))
                ec2_opts['cache_path'] = cache_path
            ec2_opts.setdefault('cache_max_age', '300')
            for k,v in ec2_opts.items():
                cp.set(section, k, unicode(v))
        # Build pyrax creds INI for rax inventory script.
        elif inventory_update.source == 'rax':
            section = 'rackspace_cloud'
            cp.add_section(section)
            credential = inventory_update.credential
            if credential:
                cp.set(section, 'username', credential.username)
                cp.set(section, 'api_key', decrypt_field(credential,
                                                         'password'))
        # Allow custom options to vmware inventory script.
        elif inventory_update.source == 'vmware':
            section = 'defaults'
            cp.add_section(section)
            vmware_opts = dict(inventory_update.source_vars_dict.items())
            vmware_opts.setdefault('guests_only', 'True')
            for k,v in vmware_opts.items():
                cp.set(section, k, unicode(v))

        # Return INI content.
        if cp.sections():
            f = cStringIO.StringIO()
            cp.write(f)
            return f.getvalue()

    def build_passwords(self, inventory_update, **kwargs):
        """Build a dictionary of authentication/credential information for
        an inventory source.

        This dictionary is used by `build_env`, below.
        """
        # Run the superclass implementation.
        super_ = super(RunInventoryUpdate, self).build_passwords
        passwords = super_(inventory_update, **kwargs)

        # Take key fields from the credential in use and add them to the
        # passwords dictionary.
        credential = inventory_update.credential
        if credential:
            for subkey in ('username', 'host', 'project'):
                passwords['source_%s' % subkey] = getattr(credential, subkey)
            for passkey in ('password', 'ssh_key_data'):
                k = 'source_%s' % passkey
                passwords[k] = decrypt_field(credential, passkey)
        return passwords

    def build_env(self, inventory_update, **kwargs):
        """Build environment dictionary for inventory import.

        This is the mechanism by which any data that needs to be passed
        to the inventory update script is set up. In particular, this is how
        inventory update is aware of its proper credentials.
        """
        env = super(RunInventoryUpdate, self).build_env(inventory_update,
                                                        **kwargs)

        # Pass inventory source ID to inventory script.
        env['INVENTORY_SOURCE_ID'] = str(inventory_update.inventory_source_id)

        # Set environment variables specific to each source.
        #
        # These are set here and then read in by the various Ansible inventory
        # modules, which will actually do the inventory sync.
        #
        # The inventory modules are vendored in Tower in the
        # `awx/plugins/inventory` directory; those files should be kept in
        # sync with those in Ansible core at all times.
        passwords = kwargs.get('passwords', {})
        if inventory_update.source == 'ec2':
            env['AWS_ACCESS_KEY_ID'] = passwords.get('source_username', '')
            env['AWS_SECRET_ACCESS_KEY'] = passwords.get('source_password', '')
            env['EC2_INI_PATH'] = kwargs.get('private_data_file', '')
        elif inventory_update.source == 'rax':
            env['RAX_CREDS_FILE'] = kwargs.get('private_data_file', '')
            env['RAX_REGION'] = inventory_update.source_regions or 'all'
            # Set this environment variable so the vendored package won't
            # complain about not being able to determine its version number.
            env['PBR_VERSION'] = '0.5.21'
        elif inventory_update.source == 'vmware':
            env['VMWARE_INI'] = kwargs.get('private_data_file', '')
            env['VMWARE_HOST'] = passwords.get('source_host', '')
            env['VMWARE_USER'] = passwords.get('source_username', '')
            env['VMWARE_PASSWORD'] = passwords.get('source_password', '')
        elif inventory_update.source == 'azure':
            env['AZURE_SUBSCRIPTION_ID'] = passwords.get('source_username', '')
            env['AZURE_CERT_PATH'] = kwargs['private_data_file']
        elif inventory_update.source == 'gce':
            env['GCE_EMAIL'] = passwords.get('source_username', '')
            env['GCE_PROJECT'] = passwords.get('source_project', '')
            env['GCE_PEM_FILE_PATH'] = kwargs['private_data_file']
        elif inventory_update.source == 'file':
            # FIXME: Parse source_env to dict, update env.
            pass
        elif inventory_update.source == 'custom':
            for env_k in inventory_update.source_vars_dict:
                if str(env_k) not in env and str(env_k) not in settings.INV_ENV_VARIABLE_BLACKLIST:
                    env[str(env_k)] = unicode(inventory_update.source_vars_dict[env_k])
        return env

    def build_args(self, inventory_update, **kwargs):
        """Build the command line argument list for running an inventory
        import.
        """
        # Get the inventory source and inventory.
        inventory_source = inventory_update.inventory_source
        inventory = inventory_source.group.inventory

        # Piece together the initial command to run via. the shell.
        args = ['awx-manage', 'inventory_import']
        args.extend(['--inventory-id', str(inventory.pk)])

        # Add appropriate arguments for overwrite if the inventory_update
        # object calls for it.
        if inventory_update.overwrite:
            args.append('--overwrite')
        if inventory_update.overwrite_vars:
            args.append('--overwrite-vars')
        args.append('--source')

        # If this is a cloud-based inventory (e.g. from AWS, Rackspace, etc.)
        # then we need to set some extra flags based on settings in
        # Tower.
        #
        # These settings are "per-cloud-provider"; it's entirely possible that
        # they will be different between cloud providers if a Tower user
        # actively uses more than one.
        if inventory_update.source in CLOUD_PROVIDERS:
            # We need to reference the source's code frequently, assign it
            # to a shorter variable. :)
            src = inventory_update.source

            # Get the path to the inventory plugin, and append it to our
            # arguments.
            plugin_path = self.get_path_to('..', 'plugins', 'inventory',
                                           '%s.py' % src)
            args.append(plugin_path)

            # Add several options to the shell arguments based on the
            # cloud-provider-specific setting in the Tower configuration.
            args.extend(['--enabled-var',
                         getattr(settings, '%s_ENABLED_VAR' % src.upper())])
            args.extend(['--enabled-value',
                         getattr(settings, '%s_ENABLED_VALUE' % src.upper())])
            args.extend(['--group-filter',
                         getattr(settings, '%s_GROUP_FILTER' % src.upper())])
            args.extend(['--host-filter',
                         getattr(settings, '%s_HOST_FILTER' % src.upper())])

            # We might have a flag set to exclude empty groups; if we do,
            # add that flag to the shell arguments.
            if getattr(settings, '%s_EXCLUDE_EMPTY_GROUPS' % src.upper()):
                args.append('--exclude-empty-groups')

            # We might have a flag for an instance ID variable; if we do,
            # add it to the shell arguments.
            if getattr(settings, '%s_INSTANCE_ID_VAR' % src.upper(), False):
                args.extend([
                    '--instance-id-var',
                    getattr(settings, '%s_INSTANCE_ID_VAR' % src.upper()),
                ])

        elif inventory_update.source == 'file':
            args.append(inventory_update.source_path)
        elif inventory_update.source == 'custom':
            runpath = tempfile.mkdtemp(prefix='ansible_tower_launch_')
            handle, path = tempfile.mkstemp(dir=runpath)
            f = os.fdopen(handle, 'w')
            # Check that source_script is not none and exists and that .script is not an empty string
            f.write(inventory_update.source_script.script.encode('utf-8'))
            f.close()
            os.chmod(path, stat.S_IRUSR|stat.S_IWUSR|stat.S_IXUSR)
            args.append(runpath)
            # try:
            #     shutil.rmtree(runpath, True)
            # except OSError:
            #     pass
        verbosity = getattr(settings, 'INVENTORY_UPDATE_VERBOSITY', 1)
        args.append('-v%d' % verbosity)
        if settings.DEBUG:
            args.append('--traceback')
        return args

    def build_cwd(self, inventory_update, **kwargs):
        return self.get_path_to('..', 'plugins', 'inventory')

    def get_idle_timeout(self):
        return getattr(settings, 'INVENTORY_UPDATE_IDLE_TIMEOUT', None)

class RunSystemJob(BaseTask):

    name = 'awx.main.tasks.run_system_job'
    model = SystemJob

    def build_args(self, system_job, **kwargs):
        args = ['awx-manage', system_job.job_type]
        try:
            json_vars = json.loads(system_job.extra_vars)
            if 'days' in json_vars:
                args.extend(['--days', str(json_vars['days'])])
            if system_job.job_type == 'cleanup_jobs':
                if 'jobs' in json_vars and json_vars['jobs']:
                    args.extend(['--jobs'])
                if 'project_updates' in json_vars and json_vars['project_updates']:
                    args.extend(['--project-updates'])
                if 'inventory_updates' in json_vars and json_vars['inventory_updates']:
                    args.extend(['--inventory-updates'])
        except Exception, e:
            logger.error("Failed to parse system job: " + str(e))
        return args

    def build_cwd(self, instance, **kwargs):
        return settings.BASE_DIR
