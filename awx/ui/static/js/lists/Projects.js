/*********************************************
 *  Copyright (c) 2013 AnsibleWorks, Inc.
 *
 *  Projects.js 
 *  List view object for Project data model.
 *
 *
 */
angular.module('ProjectsListDefinition', [])
    .value(
    'ProjectList', {
        
        name: 'projects',
        iterator: 'project',
        selectTitle: 'Add Project',
        editTitle: '{{ name }}',
        selectInstructions: '<p>Select existing projects by clicking each project or checking the related checkbox. When finished, click the blue ' +
            'Select button, located bottom right.</p> <p>Create a brand new project by clicking the green <i class=\"icon-plus\"></i>Create New button.</p>', 
        index: true,
        hover: true, 
        
        fields: {
            name: {
                key: true,
                label: 'Name'
                },
            description: {
                label: 'Description'
                }
            },
        
        actions: {
            add: {
                label: 'Create New',
                icon: 'icon-plus',
                mode: 'all',             // One of: edit, select, all
                ngClick: 'addProject()',
                "class": 'btn-success btn-small',
                awToolTip: 'Create a new project'
                }
            },

        fieldActions: {
            edit: {
                label: 'Edit',
                ngClick: "editProject(\{\{ project.id \}\})",
                icon: 'icon-edit',
                "class": 'btn-small',
                awToolTip: 'View/edit project'
                },

            "delete": {
                label: 'Delete',
                ngClick: "deleteProject(\{\{ project.id \}\},'\{\{ project.name \}\}')",
                icon: 'icon-remove',
                "class": 'btn-small btn-danger',
                awToolTip: 'Delete project'
                }
            }
        });
