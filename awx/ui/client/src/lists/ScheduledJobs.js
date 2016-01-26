/*************************************************
 * Copyright (c) 2015 Ansible, Inc.
 *
 * All Rights Reserved
 *************************************************/


export default
    angular.module('ScheduledJobsDefinition', ['sanitizeFilter'])
    .value( 'ScheduledJobsList', {

        name: 'schedules',
        iterator: 'schedule',
        editTitle: 'Scheduled Jobs',
        index: true,
        hover: true,
        well: false,

        fields: {
            status: {
                label: 'Status',
                columnClass: 'col-lg-1 col-md-2 col-sm-2 col-xs-2',
                awToolTip: "{{ schedule.status_tip }}",
                awTipPlacement: "top",
                icon: 'icon-job-{{ schedule.status }}',
                iconOnly: true,
                ngClick: "toggleSchedule($event, schedule.id)",
                searchable: false,
                nosort: true
            },
            next_run: {
                label: 'Next Run',
                noLink: true,
                searchable: false,
                columnClass: "col-lg-3 col-md-2 col-sm-3 hidden-xs",
                filter: "longDate",
                key: true
            },
            type: {
                label: 'Type',
                noLink: true,
                columnClass: "col-lg-2 col-md-2 hidden-sm hidden-xs",
                sourceModel: 'unified_job_template',
                sourceField: 'unified_job_type',
                ngBind: 'schedule.type_label',
                searchField: 'unified_job_template__polymorphic_ctype__name',
                searchLable: 'Type',
                searchable: true,
                searchType: 'select',
                searchOptions: [
                    { value: 'inventory source', name: 'Inventory Sync' },
                    { value: 'job template', name: 'Playbook Run' },
                    { value: 'project', name: 'SCM Update' }
                ]
            },
            name: {
                label: 'Name',
                columnClass: 'col-lg-3 col-md-3 col-sm-3 col-xs-5',
                sourceModel: 'unified_job_template',
                sourceField: 'name',
                ngClick: "editSchedule(schedule.id)",
                awToolTip: "{{ schedule.nameTip | sanitize}}",
                dataPlacement: "top",
                defaultSearchField: true
            }
        },

        actions: { },

        fieldActions: {

            columnClass: 'col-lg-3 col-md-3 col-sm-3 col-xs-5',

            "play": {
                mode: "all",
                ngClick: "toggleSchedule($event, schedule.id)",
                awToolTip: "{{ schedule.play_tip }}",
                dataTipWatch: "schedule.play_tip",
                iconClass: "{{ 'fa icon-schedule-enabled-' + schedule.enabled }}",
                dataPlacement: 'top'
            },
            "edit": {
                mode: "all",
                ngClick: "editSchedule(schedule.id)",
                awToolTip: "Edit the schedule",
                dataPlacement: "top"
            },
            "delete": {
                mode: 'all',
                ngClick: 'deleteSchedule(schedule.id)',
                awToolTip: 'Delete the schedule',
                dataPlacement: 'top'
            }
        }
    });
