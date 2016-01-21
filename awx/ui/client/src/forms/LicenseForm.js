/*************************************************
 * Copyright (c) 2015 Ansible, Inc.
 *
 * All Rights Reserved
 *************************************************/

/**
 * @ngdoc function
 * @name forms.function:LicenseForm
 * @description This form is for viewing the license information
*/


export default
    angular.module('LicenseFormDefinition', [])
        .value('LicenseForm', {

            name: 'license',
            well: false,
            editTitle: "License",

            licenseTabs: [{
                name: 'license',
                label: 'License'
            }, {
                name: 'managed',
                label: 'Managed Hosts'
            }],

            fields: {
                license_status: {
                    type: 'custom',
                    control: "<div class=\"license-status\" ng-class=\"status_color\"><i class=\"fa fa-circle\"></i> {{ license_status }}</div>",
                    readonly: true,
                    tab: 'license'
                },
                tower_version: {
                    label: 'Tower Version',
                    type: 'text',
                    readonly: true,
                    tab: 'license'
                },
                license_type: {
                    label: 'License Type',
                    type: 'text',
                    readonly: true,
                    tab: 'license'
                },
                subscription_name: {
                    label: 'Subscription Name',
                    type: 'text',
                    readonly: true,
                    tab: 'license'
                },
                license_key: {
                    label: 'License Key',
                    type: 'textarea',
                    'class': 'modal-input-xlarge',
                    readonly: true,
                    tab: 'license'
                },
                license_date: {
                    label: 'Expires On',
                    type: 'text',
                    readonly: true,
                    tab: 'license'
                },
                time_remaining: {
                    label: 'Time Remaining',
                    type: 'text',
                    readonly: true,
                    tab: 'license'
                },
                available_instances: {
                    label: 'Available',
                    type: 'text',
                    readonly: true,
                    tab: 'managed'
                },
                current_instances: {
                    label: 'Used',
                    type: 'text',
                    readonly: true,
                    tab: 'managed'
                },
                free_instances: {
                    label: 'Remaining',
                    type: 'text',
                    readonly: true,
                    controlNGClass: 'free_instances_class',
                    labelNGClass: 'free_instances_class',
                    tab: 'managed'
                }
            }
        });
