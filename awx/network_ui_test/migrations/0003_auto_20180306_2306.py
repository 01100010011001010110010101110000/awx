# -*- coding: utf-8 -*-
# Generated by Django 1.11.7 on 2018-03-06 23:06
from __future__ import unicode_literals

from django.db import migrations

import json


def add_load_test_case(apps, schema_editor):

    TestCase = apps.get_model('network_ui_test', 'TestCase')
    TestCase.objects.get_or_create(name="Load", test_case_data=json.dumps(dict(runnable=False)))


class Migration(migrations.Migration):

    dependencies = [
        ('network_ui_test', '0002_auto_20180306_2243'),
    ]

    operations = [
        migrations.RunPython(
            code=add_load_test_case,
        ),
    ]
