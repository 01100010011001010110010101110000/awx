# Copyright (c) 2013 AnsibleWorks, Inc.
# All Rights Reserved.

# Python
import datetime
import logging
from optparse import make_option

# Django
from django.core.management.base import NoArgsCommand, CommandError
from django.db import transaction
from django.contrib.auth.models import User
from django.utils.dateparse import parse_datetime
from django.utils.timezone import now, is_aware, make_aware

# AWX
from awx.main.models import ProjectUpdate, Job

class Command(NoArgsCommand):
    '''
    Management command to cleanup old jobs and project updates.
    '''

    help = 'Remove old jobs and project updates from the database.'

    option_list = NoArgsCommand.option_list + (
        make_option('--days', dest='days', type='int', default=90, metavar='N',
                    help='Remove jobs/updates executed more than N days ago'),
        make_option('--dry-run', dest='dry_run', action='store_true',
                    default=False, help='Dry run mode (show items that would '
                    'be removed)'),
        make_option('--jobs', dest='only_jobs', action='store_true',
                    default=False,
                    help='Only remove jobs (leave project updates alone)'),
        make_option('--project-updates', dest='only_project_updates',
                    action='store_true', default=False,
                    help='Only remove project updates (leave jobs alone)'),
    )

    def cleanup_jobs(self):
        #jobs_qs = Job.objects.exclude(status__in=('pending', 'running'))
        #jobs_qs = jobs_qs.filter(created__lte=self.cutoff)
        for job in Job.objects.all():
            job_display = '"%s" (started %s, %d host summaries, %d events)' % \
                (unicode(job), unicode(job.created),
                job.job_host_summaries.count(), job.job_events.count())
            if job.status in ('pending', 'waiting', 'running'):
                action_text = 'would skip' if self.dry_run else 'skipping'
                self.logger.debug('%s %s job %s', action_text, job.status, job_display)
            elif job.created >= self.cutoff:
                action_text = 'would skip' if self.dry_run else 'skipping'
                self.logger.debug('%s %s', action_text, job_display)
            else:
                action_text = 'would delete' if self.dry_run else 'deleting'
                self.logger.info('%s %s', action_text, job_display)
                if not self.dry_run:
                    job.delete()

    def cleanup_project_updates(self):
        for pu in ProjectUpdate.objects.all():
            pu_display = '"%s" (started %s)' % (unicode(pu), unicode(pu.created))
            if pu.status in ('pending', 'waiting', 'running'):
                action_text = 'would skip' if self.dry_run else 'skipping'
                self.logger.debug('%s %s project update %s', action_text, pu.status, pu_display)
            if pu in (pu.project.current_update, pu.project.last_update) and pu.project.scm_type:
                action_text = 'would skip' if self.dry_run else 'skipping'
                self.logger.debug('%s %s', action_text, pu_display)
            elif pu.created >= self.cutoff:
                action_text = 'would skip' if self.dry_run else 'skipping'
                self.logger.debug('%s %s', action_text, pu_display)
            else:
                action_text = 'would delete' if self.dry_run else 'deleting'
                self.logger.info('%s %s', action_text, pu_display)
                if not self.dry_run:
                    pu.delete()

    def init_logging(self):
        log_levels = dict(enumerate([logging.ERROR, logging.INFO,
                                     logging.DEBUG, 0]))
        self.logger = logging.getLogger('awx.main.commands.cleanup_jobs')
        self.logger.setLevel(log_levels.get(self.verbosity, 0))
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter('%(message)s'))
        self.logger.addHandler(handler)
        self.logger.propagate = False

    @transaction.commit_on_success
    def handle_noargs(self, **options):
        self.verbosity = int(options.get('verbosity', 1))
        self.init_logging()
        self.days = int(options.get('days', 90))
        self.dry_run = bool(options.get('dry_run', False))
        self.cutoff = now() - datetime.timedelta(days=self.days)
        self.only_jobs = bool(options.get('only_jobs', False))
        self.only_project_updates = bool(options.get('only_project_updates', False))
        if self.only_jobs or (not self.only_jobs and not self.only_project_updates):
            self.cleanup_jobs()
        if self.only_project_updates or (not self.only_jobs and not self.only_project_updates):
            self.cleanup_project_updates()
