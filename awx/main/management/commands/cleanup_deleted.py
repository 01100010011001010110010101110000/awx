# Copyright (c) 2015 Ansible, Inc.
# All Rights Reserved.

# Python
import datetime
import logging
from optparse import make_option

# Django
from django.core.management.base import BaseCommand
from django.db import transaction
from django.contrib.auth.models import User
from django.utils.dateparse import parse_datetime
from django.utils.timezone import now, is_aware, make_aware

# AWX
from awx.main.models import * # noqa

class Command(BaseCommand):
    '''
    Management command to cleanup deleted items.
    '''

    help = 'Cleanup deleted items from the database.'
    args = '[<appname>, <appname.ModelName>, ...]'

    option_list = BaseCommand.option_list + (
        make_option('--days', dest='days', type='int', default=90, metavar='N',
                    help='Remove items deleted more than N days ago'),
        make_option('--dry-run', dest='dry_run', action='store_true',
                    default=False, help='Dry run mode (show items that would '
                    'be removed)'),
    )

    def get_models(self, model):
        if not model._meta.abstract:
            yield model
        for sub in model.__subclasses__():
            for submodel in self.get_models(sub):
                yield submodel

    def cleanup_model(self, model):

        '''
        Presume the '_deleted_' string to be in the 'name' field unless considering the User model.
        When considering the User model, presume the '_d_' string to be in the 'username' field.
        '''
        name_field = 'name'
        name_prefix = '_deleted_'
        if model is User:
            name_field = 'username'
            name_prefix = '_d_'
        active_field = None
        n_deleted_items = 0
        for field in model._meta.fields:
            if field.name in ('is_active', 'active'):
                active_field = field.name
        if not active_field:
            self.logger.warning('skipping model %s, no active field', model)
            return n_deleted_items
        qs = model.objects.filter(**{
            active_field: False,
            '%s__startswith' % name_field: name_prefix,
        })
        self.logger.debug('cleaning up model %s', model)
        pks_to_delete = set()
        for instance in qs.iterator():
            dt = parse_datetime(getattr(instance, name_field).split('_')[2])
            if not is_aware(dt):
                dt = make_aware(dt, self.cutoff.tzinfo)
            if not dt:
                self.logger.warning('unable to find deleted timestamp in %s '
                                    'field', name_field)
            elif dt >= self.cutoff:
                action_text = 'would skip' if self.dry_run else 'skipping'
                self.logger.debug('%s %s', action_text, instance)
            else:
                action_text = 'would delete' if self.dry_run else 'deleting'
                self.logger.info('%s %s', action_text, instance)
                n_deleted_items += 1
                if not self.dry_run:
                    #pks_to_delete.add(instance.pk)
                    instance.delete()

            # Cleanup objects in batches instead of deleting each one individually.
            if len(pks_to_delete) >= 50:
                model.objects.filter(pk__in=pks_to_delete).delete()
                pks_to_delete.clear()
        if len(pks_to_delete):
            model.objects.filter(pk__in=pks_to_delete).delete()
        return n_deleted_items

    def init_logging(self):
        log_levels = dict(enumerate([logging.ERROR, logging.INFO,
                                     logging.DEBUG, 0]))
        self.logger = logging.getLogger('awx.main.commands.cleanup_deleted')
        self.logger.setLevel(log_levels.get(self.verbosity, 0))
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter('%(message)s'))
        self.logger.addHandler(handler)
        self.logger.propagate = False

    @transaction.atomic
    def handle(self, *args, **options):
        self.verbosity = int(options.get('verbosity', 1))
        self.init_logging()
        self.days = int(options.get('days', 90))
        self.dry_run = bool(options.get('dry_run', False))
        # FIXME: Handle args to select models.
        self.cutoff = now() - datetime.timedelta(days=self.days)

        n_deleted_items = 0
        n_deleted_items += self.cleanup_model(User)
        for model in self.get_models(PrimordialModel):
            n_deleted_items += self.cleanup_model(model)

        if not self.dry_run:
            self.logger.log(99, "Removed %d items", n_deleted_items)
        else:
            self.logger.log(99, "Would have removed %d items", n_deleted_items)

        tokens_removed = AuthToken.objects.filter(expires__lt=now())
        if not self.dry_run:
            self.logger.log(99, "Removed %d expired auth tokens" % tokens_removed.count())
            tokens_removed.delete()
        else:
            self.logger.log(99, "Would have removed %d expired auth tokens" % tokens_removed.count())
