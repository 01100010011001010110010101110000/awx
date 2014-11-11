# Copyright (c) 2014 AnsibleWorks, Inc.
# All Rights Reserved.

"""
WSGI config for AWX project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/dev/howto/deployment/wsgi/
"""

# Prepare the AWX environment.
from awx import prepare_env
prepare_env()

import os
import logging
from django.conf import settings
from awx import __version__ as tower_version
logger = logging.getLogger('awx.main.models.jobs')
try:
    fd = open("/var/lib/awx/.tower_version", "r")
    if fd.read().strip() != tower_version:
        logger.error("Tower Versions don't match, potential invalid setup detected")
        raise Exception("Tower Versions don't match, potential invalid setup detected")
except Exception:
    logger.error("Missing tower version metadata at /var/lib/awx/.tower_version")
    raise Exception("Missing tower version metadata at /var/lib/awx/.tower_version")

# Return the default Django WSGI application.
from django.core.wsgi import get_wsgi_application
application = get_wsgi_application()
