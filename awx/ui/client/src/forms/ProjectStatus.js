/*************************************************
 * Copyright (c) 2015 Ansible, Inc.
 *
 * All Rights Reserved
 *************************************************/

  /**
 * @ngdoc function
 * @name forms.function:ProjectStatus
 * @description This form is for adding/editing project status
*/

export default
    angular.module('ProjectStatusDefinition', [])
        .value('ProjectStatusForm', {

            name: 'project_update',
            editTitle: 'SCM STATUS',
            well: false,
            'class': 'horizontal-narrow',

            fields: {
                created: {
                    label: 'Created',
                    type: 'text',
                    readonly: true
                },
                status: {
                    label: 'Status',
                    type: 'text',
                    readonly: true
                },
                result_stdout: {
                    label: 'Std Out',
                    type: 'textarea',
                    ngShow: "result_stdout",
                    'class': 'mono-space',
                    readonly: true,
                    rows: 15
                },
                result_traceback: {
                    label: 'Traceback',
                    type: 'textarea',
                    ngShow: "result_traceback",
                    'class': 'mono-space',
                    readonly: true,
                    rows: 15
                }
            }
        }); //Form
