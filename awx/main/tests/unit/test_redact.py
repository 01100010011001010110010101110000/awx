import textwrap
import re

# AWX
from awx.main.redact import UriCleaner
from awx.main.tests.base import URI

TEST_URIS = [
    URI('no host', scheme='https', username='myusername', password='mypass', host=None),
    URI('no host', scheme='https', username='myusername', password='mypass*********', host=None),
    URI('http', scheme='http'),
    URI('https', scheme='https'),
    URI('no password', password=''),
    URI('no host', host=''),
    URI('host with port', host='host.com:22'),
    URI('host with @', host='host.com:22'),
    URI('host with @, password with @ at the end', password='mypasswordwith@', host='@host.com'),
    URI('no host, with space', host=' '),
    URI('password is a space', password='%20%20'),
    URI('no password field', password=None),
    URI('no username no password', username=None, password=None),
    URI('password with @ at the end', password='mypasswordwitha@'),
    URI('password with @@ at the end', password='mypasswordwitha@@'),
    URI('password with @@@ at the end', password='mypasswordwitha@@@'),
    URI('password with @@@@ at the end', password='mypasswordwitha@@@@'),
    URI('password with @a@@ at the end', password='mypasswordwitha@a@@'),
    URI('password with @@@a at the end', password='mypasswordwitha@@@a'),
    URI('password with a @ in the middle', password='pa@ssword'),
    URI('url with @', password='pa@ssword', host='googly.com/whatever@#$:stuff@.com/'),
]

TEST_CLEARTEXT = []
# Arguably, this is a regression test given the below data.
# regression data https://trello.com/c/cdUELgVY/
uri = URI(scheme="https", username="myusername", password="mypasswordwith%40", host="nonexistant.ansible.com/ansible.git/")
TEST_CLEARTEXT.append({
    'uri' : uri,
    'text' : textwrap.dedent("""\
        PLAY [all] ********************************************************************

        TASK: [delete project directory before update] ********************************
        skipping: [localhost]

        TASK: [update project using git and accept hostkey] ***************************
        skipping: [localhost]

        TASK: [update project using git] **********************************************
        failed: [localhost] => {"cmd": "/usr/bin/git ls-remote https://%s:%s -h refs/heads/HEAD", "failed": true, "rc": 128}
        stderr: fatal: unable to access '%s': Could not resolve host: nonexistant.ansible.com

        msg: fatal: unable to access '%s': Could not resolve host: nonexistant.ansible.com

        FATAL: all hosts have already failed -- aborting

        PLAY RECAP ********************************************************************
                   to retry, use: --limit @/root/project_update.retry

        localhost                  : ok=0    changed=0    unreachable=0    failed=1

        """ % (uri.username, uri.password, str(uri), str(uri))),
    'host_occurrences' : 2
})

uri = URI(scheme="https", username="Dhh3U47nmC26xk9PKscV", password="PXPfWW8YzYrgS@E5NbQ2H@", host="github.ginger.com/theirrepo.git/info/refs")
TEST_CLEARTEXT.append({
    'uri' : uri,
    'text' : textwrap.dedent("""\
        TASK: [update project using git] **
                    failed: [localhost] => {"cmd": "/usr/bin/git ls-remote https://REDACTED:********", "failed": true, "rc": 128}
                    stderr: error: Couldn't resolve host '@%s' while accessing %s

                    fatal: HTTP request failed

                    msg: error: Couldn't resolve host '@%s' while accessing %s

                    fatal: HTTP request failed
        """ % (uri.host, str(uri), uri.host, str(uri))),
    'host_occurrences' : 4
})


def check_found(string, substr, count=-1, description=None, word_boundary=False):
    if word_boundary:
        count_actual = len(re.findall(r'\b%s\b' % re.escape(substr), string))
    else:
        count_actual = string.count(substr)

    msg = ''
    if description:
        msg = 'Test "%s".\n' % description
    if count == -1:
        assert count_actual > 0
    else:
        msg += 'Found %d occurances of "%s" instead of %d in: "%s"' % (count_actual, substr, count, string)
        if count_actual != count:
            raise Exception(msg)

def check_not_found(string, substr, description=None, word_boundary=False):
    if word_boundary:
        count = len(re.findall(r'\b%s\b' % re.escape(substr), string))
    else:
        count = string.find(substr)
        if count == -1:
            count = 0

    msg = ''
    if description:
        msg = 'Test "%s".\n' % description
    msg += '"%s" found in: "%s"' % (substr, string)
    if count != 0:
        raise Exception(msg)


# should redact sensitive usernames and passwords
def test_uri_scm_simple_redacted():
    for uri in TEST_URIS:
        redacted_str = UriCleaner.remove_sensitive(str(uri))
        if uri.username:
            check_not_found(redacted_str, uri.username, uri.description)
        if uri.password:
            check_not_found(redacted_str, uri.password, uri.description)

# should replace secret data with safe string, UriCleaner.REPLACE_STR
def test_uri_scm_simple_replaced():
    for uri in TEST_URIS:
        redacted_str = UriCleaner.remove_sensitive(str(uri))
        check_found(redacted_str, UriCleaner.REPLACE_STR, uri.get_secret_count())

# should redact multiple uris in text
def test_uri_scm_multiple():
    cleartext = ''
    for uri in TEST_URIS:
        cleartext += str(uri) + ' '
    for uri in TEST_URIS:
        cleartext += str(uri) + '\n'

    redacted_str = UriCleaner.remove_sensitive(str(uri))
    if uri.username:
        check_not_found(redacted_str, uri.username, uri.description)
    if uri.password:
        check_not_found(redacted_str, uri.password, uri.description)

# should replace multiple secret data with safe string
def test_uri_scm_multiple_replaced():
    cleartext = ''
    find_count = 0
    for uri in TEST_URIS:
        cleartext += str(uri) + ' '
        find_count += uri.get_secret_count()

    for uri in TEST_URIS:
        cleartext += str(uri) + '\n'
        find_count += uri.get_secret_count()

    redacted_str = UriCleaner.remove_sensitive(cleartext)
    check_found(redacted_str, UriCleaner.REPLACE_STR, find_count)

# should redact and replace multiple secret data within a complex cleartext blob
def test_uri_scm_cleartext_redact_and_replace():
    for test_data in TEST_CLEARTEXT:
        uri = test_data['uri']
        redacted_str = UriCleaner.remove_sensitive(test_data['text'])
        check_not_found(redacted_str, uri.username, uri.description)
        check_not_found(redacted_str, uri.password, uri.description)
        # Ensure the host didn't get redacted
        check_found(redacted_str, uri.host, test_data['host_occurrences'], uri.description)
