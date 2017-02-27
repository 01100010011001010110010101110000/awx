import pytest

from awx.main.models.credential import Credential
from awx.main.models.jobs import Job
from awx.main.models.inventory import Inventory
from awx.main.tasks import RunJob


def test_aws_cred_parse(mocker):
    with mocker.patch('django.db.ConnectionRouter.db_for_write'):
        job = Job(id=1)
        job.inventory = mocker.MagicMock(spec=Inventory, id=2)

        options = {
            'kind': 'aws',
            'username': 'aws_user',
            'password': 'aws_passwd',
            'security_token': 'token',
        }
        job.cloud_credential = Credential(**options)

        run_job = RunJob()
        mocker.patch.object(run_job, 'should_use_proot', return_value=False)

        env = run_job.build_env(job, private_data_dir='/tmp')
        assert env['AWS_ACCESS_KEY'] == options['username']
        assert env['AWS_SECRET_KEY'] == options['password']
        assert env['AWS_SECURITY_TOKEN'] == options['security_token']


def test_net_cred_parse(mocker):
    with mocker.patch('django.db.ConnectionRouter.db_for_write'):
        job = Job(id=1)
        job.inventory = mocker.MagicMock(spec=Inventory, id=2)

        options = {
            'username':'test',
            'password':'test',
            'authorize': True,
            'authorize_password': 'passwd',
            'ssh_key_data': """-----BEGIN PRIVATE KEY-----\nstuff==\n-----END PRIVATE KEY-----""",
        }
        private_data_files = {
            'network_credential': '/tmp/this_file_does_not_exist_during_test_but_the_path_is_real',
        }
        job.network_credential = Credential(**options)

        run_job = RunJob()
        mocker.patch.object(run_job, 'should_use_proot', return_value=False)

        env = run_job.build_env(job, private_data_dir='/tmp', private_data_files=private_data_files)
        assert env['ANSIBLE_NET_USERNAME'] == options['username']
        assert env['ANSIBLE_NET_PASSWORD'] == options['password']
        assert env['ANSIBLE_NET_AUTHORIZE'] == '1'
        assert env['ANSIBLE_NET_AUTH_PASS'] == options['authorize_password']
        assert env['ANSIBLE_NET_SSH_KEYFILE'] == private_data_files['network_credential']


@pytest.fixture
def mock_job(mocker):
    options = {
        'username':'test',
        'password':'test',
        'ssh_key_data': """-----BEGIN PRIVATE KEY-----\nstuff==\n-----END PRIVATE KEY-----""",
        'authorize': True,
        'authorize_password': 'passwd',
    }

    mock_job_attrs = {'forks': False, 'id': 1, 'cancel_flag': False, 'status': 'running', 'job_type': 'normal',
                      'credential': None, 'cloud_credential': None, 'network_credential': Credential(**options),
                      'become_enabled': False, 'become_method': None, 'become_username': None,
                      'inventory': mocker.MagicMock(spec=Inventory, id=2), 'force_handlers': False,
                      'limit': None, 'verbosity': None, 'job_tags': None, 'skip_tags': None,
                      'start_at_task': None, 'pk': 1, 'launch_type': 'normal', 'job_template':None,
                      'created_by': None, 'extra_vars_dict': None, 'project':None, 'playbook': 'test.yml'}
    mock_job = mocker.MagicMock(spec=Job, **mock_job_attrs)
    return mock_job


@pytest.fixture
def run_job_net_cred(mocker, get_ssh_version, mock_job):
    mocker.patch('django.db.ConnectionRouter.db_for_write')
    run_job = RunJob()

    mocker.patch.object(run_job, 'update_model', return_value=mock_job)
    mocker.patch.object(run_job, 'build_cwd', return_value='/tmp')
    mocker.patch.object(run_job, 'should_use_proot', return_value=False)
    mocker.patch.object(run_job, 'run_pexpect', return_value=('successful', 0))
    mocker.patch.object(run_job, 'open_fifo_write', return_value=None)
    mocker.patch.object(run_job, 'post_run_hook', return_value=None)

    return run_job


@pytest.mark.skip(reason="Note: Ansible network modules don't yet support ssh-agent added keys.")
def test_net_cred_ssh_agent(run_job_net_cred, mock_job):
    run_job = run_job_net_cred
    run_job.run(mock_job.id)

    assert run_job.update_model.call_count == 4

    job_args = run_job.update_model.call_args_list[1][1].get('job_args')
    assert 'ssh-add' in job_args
    assert 'ssh-agent' in job_args
    assert 'network_credential' in job_args


def test_net_cred_job_model_env(run_job_net_cred, mock_job):
    run_job = run_job_net_cred
    run_job.run(mock_job.id)

    assert run_job.update_model.call_count == 4

    job_args = run_job.update_model.call_args_list[1][1].get('job_env')
    assert 'ANSIBLE_NET_USERNAME' in job_args
    assert 'ANSIBLE_NET_PASSWORD' in job_args
    assert 'ANSIBLE_NET_AUTHORIZE' in job_args
    assert 'ANSIBLE_NET_AUTH_PASS' in job_args
    assert 'ANSIBLE_NET_SSH_KEYFILE' in job_args


