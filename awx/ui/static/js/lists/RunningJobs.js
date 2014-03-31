/*********************************************
 *  Copyright (c) 2014 AnsibleWorks, Inc.
 *
 *  RunningJobs.js 
 *
 * 
 */

'use strict';

angular.module('RunningJobsDefinition', [])
    .value( 'RunningJobsList', {
        
        name: 'running_jobs',
        iterator: 'running_job',
        editTitle: 'Completed Jobs',
        'class': 'table-condensed',
        index: false,
        hover: true,
        well: false,
        
        fields: {
            id: {
                label: 'Job ID',
                ngClick:"viewJobLog(running_job.id)",
                key: true,
                desc: true,
                searchType: 'int',
                columnClass: 'col-md-1 col-sm-2 col-xs-2'
            },
            status: {
                label: 'Status',
                columnClass: 'col-md-2 col-sm-2 col-xs-2',
                awToolTip: "{{ running_job.status_tip }}",
                awTipPlacement: "top",
                dataTitle: "{{ running_job.status_popover_title }}",
                icon: 'icon-job-{{ running_job.status }}',
                iconOnly: true,
                ngClick:"viewJobLog(running_job.id)"
            },
            inventory: {
                label: 'Inventory ID',
                searchType: 'int',
                searchOnly: true
            },
            started: {
                label: 'Started On',
                link: false,
                searchable: false,
                filter: "date:'MM/dd/yy HH:mm:ss'",
                columnClass: "col-md-2 hidden-xs"
            },
            type: {
                label: 'Type',
                ngBind: 'running_job.type_label',
                link: false,
                columnClass: "col-md-2 hidden-sm hidden-xs"
            },
            name: {
                label: 'Name',
                columnClass: 'col-md-3 col-xs-5',
                ngClick: "viewJobLog(running_job.id, running_job.nameHref)"
            }
        },

        actions: {
            columnClass: 'col-md-2 col-sm-3 col-xs-3',
            refresh: {
                mode: 'all',
                awToolTip: "Refresh the page",
                ngClick: "refreshJobs()"
            }
        },
       
        fieldActions: {
            submit: {
                icon: 'icon-rocket',
                mode: 'all',
                ngClick: 'relaunchJob(running_job.id)',
                awToolTip: 'Relaunch using the same parameters',
                dataPlacement: 'top'
            },
            cancel: {
                mode: 'all',
                ngClick: 'deleteJob(running_job.id)',
                awToolTip: 'Cancel the job',
                dataPlacement: 'top'
            },
            dropdown: {
                type: 'DropDown',
                ngShow: "running_job.type === 'job'",
                label: 'View',
                icon: 'fa-search-plus',
                'class': 'btn-default btn-xs',
                options: [
                    //{ ngHref: '/#/jobs/{{ running_job.id }}', label: 'Status' },
                    { ngHref: '/#/jobs/{{ running_job.id }}/job_events', label: 'Events' },
                    { ngHref: '/#/jobs/{{ running_job.id }}/job_host_summaries', label: 'Host Summary' }
                ]
            }
        }
    });
