/*********************************************
 *  Copyright (c) 2014 AnsibleWorks, Inc.
 *
 *  JobTemplates.js
 *  List view object for Job Templates data model.
 *
 *
 */

'use strict';

angular.module('JobTemplatesListDefinition', [])
    .value('JobTemplateList', {

        name: 'job_templates',
        iterator: 'job_template',
        selectTitle: 'Add Job Template',
        editTitle: 'Job Templates',
        selectInstructions: "Click on a row to select it, and click Finished when done. Use the green <i class=\"icon-plus\"></i> " +
            "button to create a new row.",
        index: true,
        hover: true,

        fields: {
            name: {
                key: true,
                label: 'Name'
            },
            description: {
                label: 'Description',
                columnClass: 'hidden-sm hidden-xs'
            }
        },

        actions: {
            add: {
                mode: 'all', // One of: edit, select, all
                ngClick: 'addJobTemplate()',
                basePaths: ['job_templates'],
                awToolTip: 'Create a new template'
            },
            stream: {
                ngClick: "showActivity()",
                awToolTip: "View Activity Stream",
                icon: "icon-comments-alt",
                mode: 'edit'
            }
        },

        fieldActions: {
            edit: {
                label: 'Edit',
                ngClick: "editJobTemplate(job_template.id)",
                awToolTip: 'Edit template',
                "class": 'btn-default btn-xs',
                dataPlacement: 'top'
            },
            submit: {
                label: 'Launch',
                mode: 'all',
                ngClick: 'submitJob(job_template.id)',
                awToolTip: 'Start a job using this template',
                dataPlacement: 'top'
            },
            schedule: {
                label: 'Schedule',
                mode: 'all',
                ngHref: '#/job_templates/{{ job_template.id }}/schedules',
                awToolTip: 'Schedule future job template runs',
                dataPlacement: 'top'
            },
            "delete": {
                label: 'Delete',
                ngClick: "deleteJobTemplate(job_template.id, job_template.name)",
                "class": 'btn-danger btn-xs',
                awToolTip: 'Delete template',
                dataPlacement: 'top'
            }
        }
    });