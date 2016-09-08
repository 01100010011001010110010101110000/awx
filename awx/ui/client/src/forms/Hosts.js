/*************************************************
 * Copyright (c) 2015 Ansible, Inc.
 *
 * All Rights Reserved
 *************************************************/

 /**
 * @ngdoc function
 * @name forms.function:Hosts
 * @description This form is for adding/editing a host on the inventory page
*/

export default
    angular.module('HostFormDefinition', [])
        .value('HostForm', {

            addTitle: 'Create Host',
            editTitle: '{{ host.name }}',
            name: 'host',
            well: false,
            formLabelSize: 'col-lg-3',
            formFieldSize: 'col-lg-9',
            iterator: 'host',
            headerFields:{
                enabled: {
                    class: 'Form-header-field',
                    ngClick: 'toggleHostEnabled(host)',
                    type: 'toggle',
                    editRequired: false,
                    awToolTip: "<p>Indicates if a host is available and should be included in running jobs.</p><p>For hosts that " +
                    "are part of an external inventory, this flag cannot be changed. It will be set by the inventory sync process.</p>",
                    dataTitle: 'Host Enabled',
                }
            },
            fields: {
                name: {
                    label: 'Host Name',
                    type: 'text',
                    addRequired: true,
                    editRequired: true,
                    awPopOver: "<p>Provide a host name, ip address, or ip address:port. Examples include:</p>" +
                        "<blockquote>myserver.domain.com<br/>" +
                        "127.0.0.1<br />" +
                        "10.1.0.140:25<br />" +
                        "server.example.com:25" +
                        "</blockquote>",
                    dataTitle: 'Host Name',
                    dataPlacement: 'right',
                    dataContainer: 'body',
                    ngDisabled: '!canEdit'
                },
                description: {
                    label: 'Description',
                    type: 'text',
                    addRequired: false,
                    editRequired: false,
                    ngDisabled: '!canEdit'
                },
                variables: {
                    label: 'Variables',
                    type: 'textarea',
                    addRequired: false,
                    editRequird: false,
                    rows: 6,
                    "class": "modal-input-xlarge Form-textArea Form-formGroup--fullWidth",
                    "default": "---",
                    awPopOver: "<p>Enter variables using either JSON or YAML syntax. Use the radio button to toggle between the two.</p>" +
                        "JSON:<br />\n" +
                        "<blockquote>{<br />&emsp;\"somevar\": \"somevalue\",<br />&emsp;\"password\": \"magic\"<br /> }</blockquote>\n" +
                        "YAML:<br />\n" +
                        "<blockquote>---<br />somevar: somevalue<br />password: magic<br /></blockquote>\n" +
                        '<p>View JSON examples at <a href="http://www.json.org" target="_blank">www.json.org</a></p>' +
                        '<p>View YAML examples at <a href="http://docs.ansible.com/YAMLSyntax.html" target="_blank">docs.ansible.com</a></p>',
                    dataTitle: 'Host Variables',
                    dataPlacement: 'right',
                    dataContainer: 'body'
                },
                inventory: {
                    type: 'hidden',
                    includeOnEdit: true,
                    includeOnAdd: true
                }
            },

            buttons: {
                cancel: {
                    ngClick: 'formCancel()',
                    ngShow: 'canEdit'
                },
                close: {
                    ngClick: 'formCancel()',
                    ngShow: '!canEdit'
                },
                save: {
                    ngClick: 'formSave()',
                    ngDisabled: true,
                    ngShow: 'canEdit'
                }
            },

            related: {}

        });
