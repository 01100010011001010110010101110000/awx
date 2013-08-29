/*********************************************
 *  Copyright (c) 2013 AnsibleWorks, Inc.
 *
 *  Groups.js
 *  Form definition for Group model
 *
 *  
 */
angular.module('GroupFormDefinition', [])
    .value(
    'GroupForm', {
        
        addTitle: 'Create Group',                            //Legend in add mode
        editTitle: '{{ name }}',                             //Legend in edit mode
        name: 'group',                                       //Form name attribute
        well: false,                                         //Wrap the form with TB well
        formLabelSize: 'col-lg-3',
        formFieldSize: 'col-lg-9',
        
        fields: {
            /*has_active_failures: {
                label: 'Status',
                control: '<div class="job-failures-\{\{ has_active_failures \}\}">' +
                    '<i class="icon-exclamation-sign"></i> Contains hosts with failed jobs</div>',
                type: 'custom',
                ngShow: 'has_active_failures',
                readonly: true
                },*/
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
            variables: {
                label: 'Variables',
                type: 'textarea',
                addRequired: false,
                editRequird: false, 
                rows: 10,
                "class": 'modal-input-xlarge',
                "default": "---",
                dataTitle: 'Group Variables',
                dataPlacement: 'right',
                awPopOver: "<p>Enter variables using either JSON or YAML syntax. Use the radio button to toggle between the two.</p>" +
                    "JSON:<br />\n" +
                    "<blockquote>{<br />\"somevar\": \"somevalue\",<br />\"password\": \"magic\"<br /> }</blockquote>\n" +
                    "YAML:<br />\n" +
                    "<blockquote>---<br />somevar: somevalue<br />password: magic<br /></blockquote>\n" +
                    '<p>View JSON examples at <a href="http://www.json.org" target="_blank">www.json.org</a></p>' +
                    '<p>View YAML examples at <a href="http://www.ansibleworks.com/docs/YAMLSyntax.html" target="_blank">ansibleworks.com</a></p>',
                dataContainer: '#form-modal .modal-content'
                }
            },

        buttons: { //for now always generates <button> tags 
            save: { 
                label: 'Save', 
                icon: 'icon-ok',
                "class": 'btn btn-success',
                ngClick: 'formSave()',    //$scope.function to call on click, optional
                ngDisabled: true          //Disable when $pristine or $invalid, optional
                },
            reset: { 
                ngClick: 'formReset()',
                label: 'Reset',
                'class': "btn btn-default",
                icon: 'icon-trash',
                ngDisabled: true          //Disabled when $pristine
                }
            },

        related: { //related colletions (and maybe items?)
               
            }

    }); //UserForm

