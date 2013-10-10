/*********************************************
 *  Copyright (c) 2013 AnsibleWorks, Inc.
 *
 *  Credentials.js 
 *  List view object for Credential data model.
 *
 *  @dict
 */
angular.module('CredentialsListDefinition', [])
    .value(
    'CredentialList', {
        
        name: 'credentials',
        iterator: 'credential',
        selectTitle: 'Add Credentials',
        editTitle: 'Credentials',
        selectInstructions: '<p>Select existing credentials by clicking each credential or checking the related checkbox. When finished, click the blue ' +
            '<em>Select</em> button, located bottom right.</p> <p>Create a brand new credential by clicking the green <em>Create New</em> button.</p>',
        editInstructions: 'Create a new credential from either the Teams tab or the Users tab. Teams and Users each have an associated set of Credentials.',
        index: true,
        hover: true,
        
        fields: {
            name: {
                key: true,
                label: 'Name'
                },
            description: {
                label: 'Description',
                excludeModal: true
                },
            team: {
                label: 'Team',
                ngBind: 'credential.team_name',
                sourceModel: 'team',
                sourceField: 'name'
                },
            user: {
                label: 'User',
                ngBind: 'credential.user_username',
                sourceModel: 'user',
                sourceField: 'username'
                }
            },
        
        actions: {
            add: {
                icon: 'icon-plus',
                label: 'Create New',
                mode: 'all',                         // One of: edit, select, all
                ngClick: 'addCredential()',
                basePaths: ['teams','users'],        // base path must be in list, or action not available
                "class": 'btn-success btn-xs',
                awToolTip: 'Create a new credential'
                }
            },

        fieldActions: {
            edit: {
                ngClick: "editCredential(\{\{ credential.id \}\})",
                icon: 'icon-edit',
                label: 'Edit',
                "class": 'btn-xs btn-default',
                awToolTip: 'View/Edit credential'
                },

            "delete": {
                ngClick: "deleteCredential(\{\{ credential.id \}\},'\{\{ credential.name \}\}')",
                icon: 'icon-trash',
                label: 'Delete',
                "class": 'btn-xs btn-danger',
                awToolTip: 'Delete credential'
                }
            }
        });
