/*********************************************
 *  Copyright (c) 2014 AnsibleWorks, Inc.
 *
 *  Groups.js
 *  List view object for Group data model.
 *
 *
 */

'use strict';

angular.module('GroupListDefinition', [])
    .value('GroupList', {

        name: 'groups',
        iterator: 'group',
        selectTitle: 'Copy Groups',
        editTitle: 'Groups',
        index: true,
        well: false,

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
            help: {
                awPopOver: "Choose groups by clicking on each group you wish to add. Click the <em>Select</em> button to add the groups to " +
                    "the selected inventory group.",
                dataContainer: '#form-modal .modal-content',
                mode: 'all',
                awToolTip: 'Click for help',
                dataTitle: 'Adding Groups'
            }
        },

        fieldActions: {
            edit: {
                label: 'Edit',
                ngClick: "editGroup(group.id)",
                icon: 'icon-edit',
                "class": 'btn-xs',
                awToolTip: 'Edit group',
                dataPlacement: 'top'
            },

            "delete": {
                label: 'Delete',
                ngClick: "deleteGroup(group.id, group.name)",
                icon: 'icon-trash',
                "class": 'btn-xs',
                awToolTip: 'Delete group',
                dataPlacement: 'top'
            }
        }
    });