/*********************************************
 *  Copyright (c) 2014 AnsibleWorks, Inc.
 *
 *  InventoryGroups.js 
 * 
 */
angular.module('InventoryGroupsDefinition', [])
    .value('InventoryGroups', {

        name: 'groups',
        iterator: 'group',
        editTitle: '{{ inventory_name }}',
        showTitle: false,
        well: true,
        index: false,
        hover: false,
        hasChildren: true,
        filterBy: '{ show: true }',
        'class': 'table-condensed table-no-border',
        
        fields: {
            name: {
                label: 'Groups',
                key: true,
                ngClick: "showHosts(group.id,group.group_id, false)",
                columnClick: "showHosts(group.id,group.group_id, false)",
                ngClass: "group.selected_class",
                hasChildren: true,
                columnClass: 'col-lg-10 col-md-10 col-sm-10 col-xs-8',
                nosort: true,
                awDroppable: "{{ group.isDroppable }}",
                awDraggable: "{{ group.isDraggable }}",
                dataContainment: "#groups_table",
                dataTreeId: "{{ group.id }}",
                dataGroupId: "{{ group.group_id }}",
                dataType: "group"
            }
        },

        actions: {        
            create: {
                mode: 'all',
                ngClick: "createGroup()",
                awToolTip: "Create a new group"
            },
            properties: {
                mode: 'all',
                awToolTip: "Edit inventory properties",
                ngClick: 'editInventoryProperties()'
            },
            stream: {
                ngClick: "showGroupActivity()",
                awToolTip: "View Activity Stream",
                mode: 'all'
            },
            help: {
                mode: 'all',
                awToolTip: "Get help building your inventory",
                ngClick: "showGroupHelp()",
                id: "inventory-summary-help"
            }
        },

        fieldActions: {
            
            columnClass: 'col-lg-2 col-md-2 col-sm-2 col-xs-4',

            sync_status: {
                mode: 'all',
                ngClick: "viewUpdateStatus(group.id, group.group_id)",
                ngShow: "group.id > 1", // hide for all hosts
                awToolTip: "{{ group.status_tooltip }}",
                dataTipWatch: "group.status_tooltip",
                iconClass: "{{ 'fa icon-cloud-' + group.status_class }}",
                ngClass: "group.status_class",
                dataPlacement: "top"
            },
            failed_hosts: {
                mode: 'all',
                awToolTip: "{{ group.hosts_status_tip }}",
                ngShow: "group.id > 1", // hide for all hosts
                dataPlacement: "top",
                ngClick: "showHosts(group.id, group.group_id, group.show_failures)",
                iconClass: "{{ 'fa icon-job-' + group.hosts_status_class }}"
            },
            group_update: {
                //label: 'Sync',
                mode: 'all',
                ngClick: 'updateGroup(group.id)',
                awToolTip: "{{ group.launch_tooltip }}",
                dataTipWatch: "group.launch_tooltip",
                ngShow: "group.id > 1 && (group.status !== 'running' && group.status !== 'pending' && group.status !== 'updating')",
                ngClass: "group.launch_class",
                dataPlacement: "top"
            },
            cancel: {
                //label: 'Cancel',
                mode: 'all',
                ngClick: "cancelUpdate(group.id)",
                awToolTip: "Cancel sync process",
                'class': 'red-txt',
                ngShow: "group.id > 1 && (group.status == 'running' || group.status == 'pending' || group.status == 'updating')",
                dataPlacement: "top"
            },
            edit: {
                //label: 'Edit',
                mode: 'all',
                ngClick: "editGroup(group.group_id, group.id)",
                awToolTip: 'Edit group',
                ngShow: "group.id > 1", // hide for all hosts
                dataPlacement: "top"
            },
            "delete": {
                //label: 'Delete',
                mode: 'all',
                ngClick: "deleteGroup(group.id, group.group_id)",
                awToolTip: 'Delete group',
                ngShow: "group.id != 1", // hide for all hosts
                dataPlacement: "top"
            }
        }
    });
            
