/*************************************************
 * Copyright (c) 2015 Ansible, Inc.
 *
 * All Rights Reserved
 *************************************************/

 /**
 * @ngdoc function
 * @name forms.function:Permissions
 * @description This form is for adding/editing persmissions
*/

export default function() {
    return {
        addTitle: 'Add Permission', //Title in add mode
        editTitle: '{{ name }}', //Title in edit mode
        name: 'permission', //entity or model name in singular form
        well: true, //Wrap the form with TB well
        forceListeners: true,

        fields: {
            category: {
                label: 'Permission Type',
                labelClass: 'prepend-asterisk',
                type: 'radio_group',
                options: [{
                    label: 'Inventory',
                    value: 'Inventory',
                    selected: true
                }, {
                    label: 'Job Template',
                    value: 'Deploy'
                }],
                ngChange: 'selectCategory()'
            },
            name: {
                label: 'Name',
                type: 'text',
                addRequired: true,
                editRequired: true,
                capitalize: false
            },
            description: {
                label: 'Description',
                type: 'text',
                addRequired: false,
                editRequired: false
            },
            user: {
                label: 'User',
                type: 'hidden'
            },
            team: {
                label: 'Team',
                type: 'hidden'
            },
            project: {
                label: 'Project',
                type: 'lookup',
                sourceModel: 'project',
                sourceField: 'name',
                ngShow: "category == 'Deploy'",
                ngClick: 'lookUpProject()',
                awRequiredWhen: {
                    variable: "projectrequired",
                    init: "false"
                }
            },
            inventory: {
                label: 'Inventory',
                type: 'lookup',
                sourceModel: 'inventory',
                sourceField: 'name',
                ngClick: 'lookUpInventory()',
                awRequiredWhen: {
                    variable: "inventoryrequired",
                    init: "true"
                }
            },
            permission_type: {
                label: 'Permission',
                labelClass: 'prepend-asterisk',
                type: 'radio_group',
                class: 'squeeze',
                ngChange: 'changeAdhocCommandCheckbox()',
                options: [{
                    label: '{{ permission_label.read }}',
                    value: 'read',
                    ngShow: "category == 'Inventory'"
                }, {
                    label: '{{ permission_label.write }}',
                    value: 'write',
                    ngShow: "category == 'Inventory'"
                }, {
                    label: '{{ permission_label.admin }}',
                    value: 'admin',
                    ngShow: "category == 'Inventory'"
                }, {
                    label: '{{ permission_label.create }}',
                    value: 'create',
                    ngShow: "category == 'Deploy'"
                }, {
                    label: '{{ permission_label.run }}',
                    value: 'run',
                    ngShow: "category == 'Deploy'"
                }, {
                    label: '{{ permission_label.check }}',
                    value: 'check',
                    ngShow: "category == 'Deploy'"
                }],
                // hack: attach helpCollapse here if the permissions
                // category is deploy
                helpCollapse: [{
                    hdr: 'Permission',
                    ngBind: 'permissionTypeHelp',
                    ngHide: "category == 'Inventory'"
                }]
            },
            run_ad_hoc_commands: {
                label: '{{ permission_label.adhoc }}',
                type: 'checkbox',
                // hack: attach helpCollapse here if the permissions
                // category is inventory
                helpCollapse: [{
                    hdr: 'Permission',
                    ngBind: 'permissionTypeHelp'
                }],
                ngShow: "category == 'Inventory'",
                associated: 'permission_type'
            },
        },

        buttons: {
            save: {
                ngClick: 'formSave()',
                ngDisabled: true
            },
            reset: {
                ngClick: 'formReset()',
                ngDisabled: true
            }
        },

        related: { }

    };
}
