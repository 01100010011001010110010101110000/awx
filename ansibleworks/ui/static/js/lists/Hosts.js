/*********************************************
 *  Copyright (c) 2013 AnsibleWorks, Inc.
 *
 *  Hosts.js 
 *  List view object for Users data model.
 *
 *  
 */
angular.module('HostListDefinition', [])
    .value(
    'HostList', {
        
        name: 'hosts',
        iterator: 'host',
        selectTitle: 'Add Host',
        selectInstructions: 'Click on a row to select it, and click Finished when done. Use the green <i class=\"icon-plus\"></i> button to create a new row.', 
        editTitle: 'Hosts',
        index: true,
        well: true,
        
        fields: {
            name: {
                key: true,
                label: 'Name',
                linkTo: "/inventories/\{\{ inventory_id \}\}/hosts/\{\{ host.id \}\}"
                },
            description: {
                label: 'Description'
                }
            },
        
        actions: {
            add: {
                icon: 'icon-plus',
                label: 'Add',
                mode: 'all',             // One of: edit, select, all
                ngClick: 'createHost()',
                ngHide: 'showAddButton == false',
                "class": 'btn-success btn-small',
                awToolTip: 'Create a new host'
                }
            },

        fieldActions: {
            edit: {
                label: 'Edit',
                ngClick: "editHost(\{\{ host.id \}\})",
                icon: 'icon-edit',
                "class": 'btn-small btn-success',
                awToolTip: 'View/Edit host'
                },

            "delete": {
                label: 'Delete',
                ngClick: "deleteHost(\{\{ host.id \}\},'\{\{ host.name \}\}')",
                icon: 'icon-remove',
                "class": 'btn-small btn-danger',
                awToolTip: 'Delete host'
                }
            }
        });
