/*********************************************
 *  Copyright (c) 2013 AnsibleWorks, Inc.
 *
 *  Hosts.js
 *  Form definition for Host model
 *
 *
 */
angular.module('HostFormDefinition', [])
    .value(
    'HostForm', {
        
        addTitle: 'Create Host',                             //Legend in add mode
        editTitle: '{{ name }}',                             //Legend in edit mode
        name: 'host',                                        //Form name attribute
        well: true,                                          //Wrap the form with TB well          

        fields: {
            name: {
                label: 'Name',
                type: 'text',
                addRequired: true,
                editRequired: true
                },
            description: { 
                label: 'Description',
                type: 'text',
                addRequired: false,
                editRequired: false
                },
            inventory: {
                type: 'hidden',
                includeOnEdit: true, 
                includeOnAdd: true
                },
            variables: {
                label: 'Variables',
                type: 'textarea',
                addRequired: false,
                editRequird: false, 
                rows: 10,
                class: 'span12',
                default: "\{\}"
                }
            },

        buttons: { //for now always generates <button> tags 
            save: { 
                label: 'Save', 
                icon: 'icon-ok',
                class: 'btn-success',
                ngClick: 'formSave()',    //$scope.function to call on click, optional
                ngDisabled: true          //Disable when $pristine or $invalid, optional
                },
            reset: { 
                ngClick: 'formReset()',
                label: 'Reset',
                icon: 'icon-remove',
                ngDisabled: true          //Disabled when $pristine
                }
            },

        related: { //related colletions (and maybe items?)
               
            }

    }); //UserForm

