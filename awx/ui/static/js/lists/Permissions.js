/*********************************************
 *  Copyright (c) 2014 AnsibleWorks, Inc.
 *
 *  Permissions.js
 *  List view object for Permissions data model.
 *
 *
 */

'use strict';

angular.module('PermissionListDefinition', [])
    .value('PermissionList', {

        name: 'permissions',
        iterator: 'permission',
        selectTitle: 'Add Permission',
        selectInstructions: "Click on a row to select it, and click Finished when done. Use the green <i class=\"icon-plus\"></i> " +
            "button to create a new row.",
        editTitle: 'Permissions',
        index: true,
        well: true,

        fields: {
            name: {
                key: true,
                label: 'Name',
                ngClick: 'editPermission(permission.id)'
            },
            inventory: {
                label: 'Inventory',
                sourceModel: 'inventory',
                sourceField: 'name',
                ngBind: 'permission.summary_fields.inventory.name'
            },
            project: {
                label: 'Project',
                sourceModel: 'project',
                sourceField: 'name',
                ngBind: 'permission.summary_fields.project.name'
            },
            permission_type: {
                label: 'Permission'
            }
        },

        actions: {
            add: {
                mode: 'all', // One of: edit, select, all
                ngClick: 'addPermission()',
                awToolTip: 'Add a new permission',
                ngShow: 'PermissionAddAllowed'
            },
            stream: {
                ngClick: "showActivity()",
                awToolTip: "View Activity Stream",
                mode: 'edit'
            }
        },

        fieldActions: {
            edit: {
                label: 'Edit',
                ngClick: "editPermission(permission.id)",
                icon: 'icon-edit',
                "class": 'btn-xs btn-default',
                awToolTip: 'Edit permission',
                dataPlacement: 'top'
            },

            "delete": {
                label: 'Delete',
                ngClick: "deletePermission(permission.id, permission.name)",
                icon: 'icon-trash',
                "class": 'btn-xs btn-danger',
                awToolTip: 'Delete permission',
                ngShow: 'PermissionAddAllowed',
                dataPlacement: 'top'
            }
        }
    });