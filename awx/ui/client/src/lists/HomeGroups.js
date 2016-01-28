/*************************************************
 * Copyright (c) 2015 Ansible, Inc.
 *
 * All Rights Reserved
 *************************************************/


export default
    angular.module('HomeGroupListDefinition', [])
    .value('HomeGroupList', {

        name: 'home_groups',
        iterator: 'group',
        editTitle: 'Groups',
        index: false,
        hover: true,
        well: true,

        fields: {
            status: {
                label: '',
                columnClass: 'List-staticColumn--mediumStatus',
                searchable: false,
                nosort: true,
                ngClick: "null",
                iconOnly: true,
                icons: [{
                    icon: "{{ 'icon-cloud-' + group.status_class }}",
                    awToolTip: "{{ group.status_tooltip }}",
                    dataTipWatch: "group.launch_tooltip",
                    awTipPlacement: "right",
                    ngClick: "viewUpdateStatus(group.id)",
                    ngClass: "group.launch_class"
                },{
                    icon: "{{ 'icon-job-' + group.hosts_status_class }}",
                    awToolTip: "{{ group.hosts_status_tip }}",
                    awTipPlacement: "right",
                    ngClick: "showHostSummary($event, group.id)",
                    ngClass: ""
                }]
            },
            name: {
                key: true,
                label: 'Group',
                ngClick: "editGroup(group.id, group.inventory)",
                columnClass: 'col-lg-6 col-md-5 col-sm-5 col-xs-8 ellipsis List-staticColumnAdjacent'
            },
            inventory_name: {
                label: 'Inventory',
                sourceModel: 'inventory',
                sourceField: 'name',
                columnClass: 'col-lg-4 col-md-5 col-sm-3 hidden-xs elllipsis',
                linkTo: "{{ '/#/inventories/' + group.inventory + '/' }}"
            },
            source: {
                label: 'Source',
                searchType: 'select',
                searchOptions: [{
                    name: "Amazon Web Services",
                    value: "ec2"
                }, {
                    name: "none",
                    value: ""
                }, {
                    name: "Rackspace",
                    value: "rax"
                },{
                    name: "VMware",
                    value: "vmware"
                },{
                    name: "Google Compute Engine",
                    value: "gce"
                },{
                    name: "Microsoft Azure",
                    value: "azure"
                },{
                    name: "OpenStack",
                    value: "openstack"
                }],
                sourceModel: 'inventory_source',
                sourceField: 'source',
                searchOnly: true
            },
            has_external_source: {
                label: 'Has external source?',
                searchType: 'in',
                searchValue: 'ec2,rax,vmware,azure,gce,openstack',
                searchOnly: true,
                sourceModel: 'inventory_source',
                sourceField: 'source'
            },
            has_active_failures: {
                label: 'Has failed hosts?',
                searchSingleValue: true,
                searchType: 'boolean',
                searchValue: 'true',
                searchOnly: true
            },
            last_update_failed: {
                label: 'Update failed?',
                searchType: 'select',
                searchSingleValue: true,
                searchValue: 'failed',
                searchOnly: true,
                sourceModel: 'inventory_source',
                sourceField: 'status'
            },
            id: {
                label: 'ID',
                searchOnly: true
            },
            inventory_source: {
                label: 'Source ID',
                searchType: 'int',
                searchOnly: true
            }
        },

        fieldActions: {

            columnClass: 'col-lg-2 col-md-2 col-sm-4 col-xs-4',

            /*
            sync_status: {
                mode: 'all',
                ngClick: "viewUpdateStatus(group.id, group.group_id)",
                awToolTip: "{{ group.status_tooltip }}",
                ngClass: "group.status_class",
                dataPlacement: "top"
            },
            failed_hosts: {
                mode: 'all',
                awToolTip: "{{ group.hosts_status_tip }}",
                dataPlacement: "top",
                ngHref: "/#/inventories/{{ group.inventory }}/",
                iconClass: "{{ 'fa icon-failures-' + group.hosts_status_class }}"
            },
            */
            group_update: {
                //label: 'Sync',
                mode: 'all',
                ngClick: 'updateGroup(group.id)',
                awToolTip: "{{ group.launch_tooltip }}",
                ngShow: "(group.status !== 'running' && group.status !== 'pending' && group.status !== 'updating')",
                ngClass: "group.launch_class",
                dataPlacement: "top"
            },
            cancel: {
                //label: 'Cancel',
                mode: 'all',
                ngClick: "cancelUpdate(group.id)",
                awToolTip: "Cancel sync process",
                'class': 'red-txt',
                ngShow: "(group.status == 'running' || group.status == 'pending' || group.status == 'updating')",
                dataPlacement: "top"
            },
            edit: {
                label: 'Edit',
                mode: 'all',
                ngClick: "editGroup(group.id, group.inventory)",
                awToolTip: 'Edit group',
                dataPlacement: "top"
            }
        },

        actions: {

        }

    });
