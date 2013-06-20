/*********************************************
 *  Copyright (c) 2013 AnsibleWorks, Inc.
 *
 *  Inventories.js 
 *  List view object for Inventories data model.
 *
 * 
 */
angular.module('InventoriesListDefinition', [])
    .value(
    'InventoryList', {
        
        name: 'inventories',
        iterator: 'inventory',
        selectTitle: 'Add Inventories',
        editTitle: 'Inventories',
        selectInstructions: 'Click on a row to select it, and click Finished when done. Use the green <i class=\"icon-plus\"></i> button to create a new row.', 
        index: true,
        hover: true,
        
        fields: {
            name: {
                key: true,
                label: 'Name'
                },
            description: {
                label: 'Descriptions'
                },
            organization: {
                label: 'Organization',
                ngBind: 'inventory.summary_fields.organization.name',
                sourceModel: 'organization',
                sourceField: 'name'
                },
            has_active_failures: {
                label: 'Host Status',
                showValue: false,
                text: 'Failed jobs',
                ngShow: "\{\{ inventory.has_active_failures \}\}",
                icon: 'icon-exclamation-sign',
                "class": 'active-failures-\{\{ inventory.has_active_failures \}\}',
                searchField: 'has_active_failures',
                searchType: 'boolean',
                searchOptions: [{ name: "No", value: 0 }, { name: "Yes", value: 1 }]
                }
            },
        
        actions: {
            add: {
                label: 'Add',
                icon: 'icon-plus',
                mode: 'all',             // One of: edit, select, all
                ngClick: 'addInventory()',
                "class": 'btn-small btn-success',
                awToolTip: 'Create a new row'
                }
            },

        fieldActions: {
            edit: {
                label: 'Edit',
                ngClick: "editInventory(\{\{ inventory.id \}\})",
                icon: 'icon-edit',
                "class": 'btn-small btn-success',
                awToolTip: 'View/Edit inventory'
                },

            "delete": {
                label: 'Delete',
                ngClick: "deleteInventory(\{\{ inventory.id \}\},'\{\{ inventory.name \}\}')",
                icon: 'icon-remove',
                "class": 'btn-small btn-danger',
                awToolTip: 'Delete'
                }
            }
        });
