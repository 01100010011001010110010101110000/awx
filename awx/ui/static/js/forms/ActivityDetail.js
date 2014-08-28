/*********************************************
 *  Copyright (c) 2014 AnsibleWorks, Inc.
 *
 *  ActivityDetail.js
 *  Form definition for Activity Stream detail
 *
 */
 /**
 * @ngdoc overview
 * @name forms
 * @description These are all the controllers that are used throughout the application
 *
*/
/**
 * @ngdoc function
 * @name forms.function:ActivityDetail
 * @description This form is for activity detail modal that can be shown on most pages.
*/
angular.module('ActivityDetailDefinition', [])
    .value('ActivityDetailForm', {

        name: 'activity',
        editTitle: 'Activity Detail',
        well: false,
        'class': 'horizontal-narrow',
        formFieldSize: 'col-lg-10',
        formLabelSize: 'col-lg-2',

        fields: {
            user: {
                label: "Initiated by",
                type: 'text',
                readonly: true
            },
            operation: {
                label: 'Action',
                type: 'text',
                readonly: true
            },
            changes: {
                label: 'Changes',
                type: 'textarea',
                ngHide: "!changes || changes =='' || changes == 'null'",
                readonly: true
            }
        }

    }); //Form
