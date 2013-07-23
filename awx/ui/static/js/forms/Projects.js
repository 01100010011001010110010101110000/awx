/*********************************************
 *  Copyright (c) 2013 AnsibleWorks, Inc.
 *
 *  Projects.js
 *
 *  Form definition for Projects model
 *
 *  
 */
angular.module('ProjectFormDefinition', [])
    .value(
    'ProjectsForm', {
        
        addTitle: 'Create Project',                             //Title in add mode
        editTitle: '{{ name }}',                                //Title in edit mode
        name: 'project',                                        //entity or model name in singular form
        well: true,                                             //Wrap the form with TB well/           

        fields: {
            name: {
                label: 'Name',
                type: 'text',
                addRequired: true,
                editRequired: true,
                capitalize: true
                },
            description: { 
                label: 'Description',
                type: 'text',
                addRequired: false,
                editRequired: false
                },
            base_dir: {
                label: 'Project Base Path',
                type: 'textarea',
                "class": 'span6',
                showonly: true,
                awPopOver: '<p>Base path used for locating playbooks. Directories found inside this path will be listed in the playbook directory drop-down. ' +
                  'Together the base path and selected playbook directory provide the full path used to locate playbooks.</p>' + 
                  '<p>Use PROJECTS_ROOT in your environment settings file to determine the base path value.</p>',
                dataTitle: 'Project Base Path',
                dataPlacement: 'right'
                },
            local_path: { 
                label: 'Playbook Directory',
                type: 'select',
                id: 'local-path-select',
                ngOptions: 'path for path in project_local_paths',
                addRequired: true,
                editRequired: true,
                awPopOver: '<p>Select from the list of directories found in the base path.' +
                  'Together the base path and the playbook directory provide the full path used to locate playbooks.</p>' + 
                  '<p>Use PROJECTS_ROOT in your environment settings file to determine the base path value.</p>',
                dataTitle: 'Project Path',
                dataPlacement: 'right'
                }
            },

        buttons: { //for now always generates <button> tags 
            save: { 
                label: 'Save', 
                icon: 'icon-ok',
                "class": 'btn-success',
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
            organizations: {
                type: 'collection',
                title: 'Organizations',
                iterator: 'organization',
                open: false,

                actions: { 
                    add: {
                        ngClick: "add('organizations')",
                        icon: 'icon-plus',
                        label: 'Add',
                        awToolTip: 'Add an organization'
                        }
                    },

                fields: {
                    name: {
                        key: true,
                        label: 'Name'
                        },
                    description: {
                        label: 'Description'
                        }
                    },

                fieldActions: {
                    edit: {
                        label: 'Edit',
                        ngClick: "edit('organizations', \{\{ organization.id \}\}, '\{\{ organization.name \}\}')",
                        icon: 'icon-edit',
                        awToolTip: 'Edit the credential'
                        },
                    "delete": {
                        label: 'Delete',
                        ngClick: "delete('organizations', \{\{ organization.id \}\}, '\{\{ organization.name \}\}', 'organizations')",
                        icon: 'icon-remove',
                        "class": 'btn-danger',
                        awToolTip: 'Delete the credential'
                        }
                    }
                }
            }

    }); // Form

    