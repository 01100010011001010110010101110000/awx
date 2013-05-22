/*********************************************
 *  Copyright (c) 2013 AnsibleWorks, Inc.
 *
 *  Credentials.js 
 *  List view object for Credential data model.
 *
 *
 */
angular.module('CredentialsListDefinition', [])
    .value(
    'CredentialList', {
        
        name: 'credentials',
        iterator: 'credential',
        selectTitle: 'Add Credentials',
        editTitle: 'Credentials',
        selectInstructions: 'Check the Select checkbox next to each credential to be added, and click Finished when done. Use the green <i class=\"icon-plus\"></i> button to create a new user.', 
        editInstructions: 'Add a new credential record from either the Teams tab or the Users tab. Teams and Users each have an associated set of Credentials.',
        index: true,
        index: true,
        
        fields: {
            name: {
                key: true,
                label: 'Name'
                },
            description: {
                label: 'Description'
                },
            team: {
                label: 'Team',
                ngBind: 'credential.summary_fields.team.name',
                sourceModel: 'team',
                sourceField: 'name'
                },
            user: {
                label: 'User',
                ngBind: 'credential.summary_fields.user.usename',
                sourceModel: 'user',
                sourceField: 'username'
                }
            },
        
        actions: {
            add: {
                icon: 'icon-plus',
                mode: 'all',                         // One of: edit, select, all
                ngClick: 'addCredential()',
                basePaths: ['teams','users'],        // base path must be in list, or action not available
                class: 'btn-success',
                awToolTip: 'Create a new credential'
                }
            },

        fieldActions: {
            edit: {
                ngClick: "editCredential(\{\{ credential.id \}\})",
                icon: 'icon-edit',
                class: 'btn-mini',
                awToolTip: 'View/Edit credential'
                },

            delete: {
                ngClick: "deleteCredential(\{\{ credential.id \}\},'\{\{ credential.name \}\}')",
                icon: 'icon-remove',
                class: 'btn-mini btn-danger',
                awToolTip: 'Delete credential'
                }
            }
        });
