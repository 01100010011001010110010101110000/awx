/*********************************************
 *  Copyright (c) 2014 AnsibleWorks, Inc.
 *
 *  Projects.js
 *  List view object for Project data model.
 *
 *
 */

'use strict';

angular.module('ProjectsListDefinition', [])
    .value('ProjectList', {

        name: 'projects',
        iterator: 'project',
        selectTitle: 'Add Project',
        editTitle: 'Projects',
        selectInstructions: '<p>Select existing projects by clicking each project or checking the related checkbox. When finished, click the blue ' +
            '<em>Select</em> button, located bottom right.</p> <p>Create a brand new project by clicking the green <em>Create New</em> button.</p>',
        index: true,
        hover: true,

        fields: {
            name: {
                key: true,
                label: 'Name'
            },
            description: {
                label: 'Description',
                excludeModal: true,
                columnClass: 'hidden-sm hidden-xs'
            },
            scm_type: {
                label: 'Type',
                searchType: 'select',
                searchOptions: [], // will be set by Options call to projects resource
                excludeModal: true,
                columnClass: 'hidden-sm hidden-xs',
                nosort: true
            },
            status: {
                label: 'Status',
                ngClick: 'showSCMStatus(project.id)',
                awToolTip: 'View details of last SCM Update',
                dataPlacement: 'top',
                badgeIcon: "{{ 'fa icon-failures-' + project.badge }}",
                badgePlacement: 'left',
                searchType: 'select',
                searchOptions: [], // will be set by Options call to projects resource
                excludeModal: true
            },
            last_updated: {
                label: 'Last Updated',
                type: 'date',
                excludeModal: true,
                searchable: false
            }
        },

        actions: {
            add: {
                mode: 'all', // One of: edit, select, all
                ngClick: 'addProject()',
                awToolTip: 'Create a new project'
            },
            help: {
                awPopOver: "<dl>\n<dt>Updating</dt><dd>A source control update is in progress.</dd>\n" +
                    "<dt>Never Updated</dt><dd>This project has not yet been updated from source control.</dd>\n" +
                    "<dt>Failed</dt><dd>An error occurred during the most recent source control update, click the status " +
                    "text for more information.</dd>\n" +
                    "<dt>Successful</dt><dd>TThe latest source control update completed successfully.</dd>\n" +
                    "<dt>Missing</dt><dd>The previously configured local project directory is missing.</dd>\n" +
                    "<dt>N/A</dt><dd>The project is not linked to source control, so updates are not applicable.</dd>\n" +
                    "</dl>\n",
                dataPlacement: 'left',
                dataContainer: 'body',
                mode: 'edit',
                awToolTip: 'Click for help',
                awTipPlacement: 'top'
            },
            refresh: {
                mode: 'all',
                awToolTip: "Refresh the page",
                ngClick: "refresh()"
            },
            stream: {
                ngClick: "showActivity()",
                awToolTip: "View Activity Stream",
                mode: 'edit'
            }
        },

        fieldActions: {
            scm_update: {
                ngClick: 'SCMUpdate(project.id)',
                awToolTip: "{{ project.scm_update_tooltip }}",
                ngClass: "project.scm_type_class",
                dataPlacement: 'top'
            },
            cancel: {
                ngClick: "cancelUpdate(project.id, project.name)",
                awToolTip: 'Cancel the SCM update',
                ngShow: "project.status == 'updating'",
                dataPlacement: 'top'
            },
            schedule: {
                mode: 'all',
                ngHref: '#/projects/{{ project.id }}/schedules',
                awToolTip: 'Schedule future SCM updates',
                dataPlacement: 'top'
            },
            edit: {
                ngClick: "editProject(project.id)",
                awToolTip: 'Edit the project',
                dataPlacement: 'top'
            },
            "delete": {
                ngClick: "deleteProject(project.id, project.name)",
                awToolTip: 'Delete the project',
                ngShow: "project.status !== 'updating'",
                dataPlacement: 'top'
            }
        }
    });