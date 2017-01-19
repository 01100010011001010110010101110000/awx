/*************************************************
 * Copyright (c) 2016 Ansible, Inc.
 *
 * All Rights Reserved
 *************************************************/

/**
 * @ngdoc function
 * @name controllers.function:Inventories
 * @description This controller's for the Inventory page
 */

function InventoriesAdd($scope, $rootScope, $compile, $location, $log,
    $stateParams, GenerateForm, InventoryForm, rbacUiControlService, Rest, Alert, ProcessErrors,
    ClearScope, GetBasePath, ParseTypeChange, Wait, ToJSON,
    $state) {

    $scope.canAdd = false;
    rbacUiControlService.canAdd(GetBasePath('inventory'))
        .then(function(canAdd) {
            $scope.canAdd = canAdd;
        });

    Rest.setUrl(GetBasePath('inventory'));
    Rest.options()
        .success(function(data) {
            if (!data.actions.POST) {
                $state.go("^");
                Alert('Permission Error', 'You do not have permission to add an inventory.', 'alert-info');
            }
        });

    ClearScope();

    // Inject dynamic view
    var defaultUrl = GetBasePath('inventory'),
        form = InventoryForm();

    init();

    function init() {
        form.formLabelSize = null;
        form.formFieldSize = null;

        // apply form definition's default field values
        GenerateForm.applyDefaults(form, $scope);

        $scope.parseType = 'yaml';
        ParseTypeChange({
            scope: $scope,
            variable: 'variables',
            parse_variable: 'parseType',
            field_id: 'inventory_variables'
        });
    }

    // Save
    $scope.formSave = function() {
        Wait('start');
        try {
            var fld, json_data, data;

            json_data = ToJSON($scope.parseType, $scope.variables, true);

            data = {};
            for (fld in form.fields) {
                if (form.fields[fld].realName) {
                    data[form.fields[fld].realName] = $scope[fld];
                } else {
                    data[fld] = $scope[fld];
                }
            }

            Rest.setUrl(defaultUrl);
            Rest.post(data)
                .success(function(data) {
                    var inventory_id = data.id;
                    Wait('stop');
                    $location.path('/inventories/' + inventory_id + '/manage');
                })
                .error(function(data, status) {
                    ProcessErrors($scope, data, status, form, {
                        hdr: 'Error!',
                        msg: 'Failed to add new inventory. Post returned status: ' + status
                    });
                });
        } catch (err) {
            Wait('stop');
            Alert("Error", "Error parsing inventory variables. Parser returned: " + err);
        }

    };

    $scope.formCancel = function() {
        $state.go('inventories');
    };
}

export default ['$scope', '$rootScope', '$compile', '$location',
    '$log', '$stateParams', 'GenerateForm', 'InventoryForm', 'rbacUiControlService', 'Rest', 'Alert',
    'ProcessErrors', 'ClearScope', 'GetBasePath', 'ParseTypeChange',
    'Wait', 'ToJSON', '$state', InventoriesAdd
];
