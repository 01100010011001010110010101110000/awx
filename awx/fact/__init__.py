# Copyright (c) 2014 AnsibleWorks, Inc.
# All Rights Reserved.

from __future__ import absolute_import

import logging
from django.conf import settings

from mongoengine import connect
from mongoengine.connection import get_db, ConnectionError
from .utils.dbtransform import register_key_transform

logger = logging.getLogger('fact.__init__')

# Connect to Mongo
try:
    connect(settings.MONGO_DB)
    register_key_transform(get_db())
except ConnectionError:
    logger.warn('Failed to establish connect to MongDB "%s"' % (settings.MONGO_DB))
