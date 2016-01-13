/*************************************************
 * Copyright (c) 2015 Ansible, Inc.
 *
 * All Rights Reserved
 *************************************************/

export default
    [   '$rootScope', 'pagination', '$compile','SchedulerInit', 'Rest', 'Wait',
        'inventoryScriptsFormObject', 'ProcessErrors', 'GetBasePath', 'Empty',
        'GenerateForm', 'SearchInit' , 'PaginateInit',
        'LookUpInit', 'OrganizationList', '$scope', '$state',
        function(
            $rootScope, pagination, $compile, SchedulerInit, Rest, Wait,
            inventoryScriptsFormObject, ProcessErrors, GetBasePath, Empty,
            GenerateForm, SearchInit, PaginateInit,
            LookUpInit, OrganizationList, $scope, $state
        ) {
            var scope = $scope,
                generator = GenerateForm,
                form = inventoryScriptsFormObject,
                url = GetBasePath('inventory_scripts');

            generator.inject(form, {
                mode: 'add' ,
                scope:scope,
                related: false
            });
            generator.reset();

            LookUpInit({
                    url: GetBasePath('organization'),
                    scope: scope,
                    form: form,
                    list: OrganizationList,
                    field: 'organization',
                    input_type: 'radio'
                });

            // Save
            scope.formSave = function () {

                generator.clearApiErrors();
                Wait('start');
                Rest.setUrl(url);
                Rest.post({
                    name: scope.name,
                    description: scope.description,
                    organization: scope.organization,
                    script: scope.script
                })
                .success(function (data) {
                    $rootScope.addedItem = data.id;
                    $state.go('inventoryScripts', {}, {reload: true});
                    Wait('stop');
                })
                .error(function (data, status) {
                    ProcessErrors(scope, data, status, form, { hdr: 'Error!',
                        msg: 'Failed to add new inventory script. POST returned status: ' + status });
                });
            };

            scope.formCancel = function () {
                $state.transitionTo('inventoryScripts');
            };

        }
    ];
