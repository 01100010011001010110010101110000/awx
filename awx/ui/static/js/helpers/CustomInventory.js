/*********************************************
 *  Copyright (c) 2014 AnsibleWorks, Inc.
 */
    /**
 * @ngdoc function
 * @name helpers.function:Schedules
 * @description
 *  Schedules Helper
 *
 *  Display the scheduler widget in a dialog
 *
 */

'use strict';

angular.module('CreateCustomInventoryHelper', [ 'Utilities', 'RestServices', 'SchedulesHelper', 'SearchHelper', 'PaginationHelpers', 'ListGenerator', 'ModalDialog',
    'GeneratorHelpers', 'CustomInventoryFormDefinition'])

    .factory('CreateCustomInventory', ['Wait', 'CreateDialog', 'CustomInventoryList', 'GenerateList', 'GetBasePath' , 'SearchInit' , 'PaginateInit', 'PlaybookRun', 'CustomInventoryAdd',
        'SchedulesList', 'CustomInventoryEdit', 'Rest' , 'ProcessErrors', 'CustomInventoryForm', 'GenerateForm', 'Prompt',
        function(Wait, CreateDialog, CustomInventoryList, GenerateList, GetBasePath, SearchInit, PaginateInit, PlaybookRun, CustomInventoryAdd,
            SchedulesList, CustomInventoryEdit, Rest, ProcessErrors, CustomInventoryForm, GenerateForm, Prompt) {
        return function(params) {
            // Set modal dimensions based on viewport width

            var scope = params.parent_scope.$new(),
                callback = 'OpenConfig',
                defaultUrl = GetBasePath('inventory_scripts'),
                list = CustomInventoryList,
                view = GenerateList,
                buttons = [
                {
                    "label": "Close",
                    "onClick": function() {
                        // $(this).dialog('close');
                        scope.cancelConfigure();
                    },
                    "icon": "fa-times",
                    "class": "btn btn-default",
                    "id": "script-close-button"
                }
            ];

            scope.cleanupJob = true;

            if(scope.removeOpenConfig) {
                scope.removeOpenConfig();
            }
            scope.removeOpenConfig = scope.$on('OpenConfig', function() {
                $('#custom-script-dialog').dialog('open');
                $('#script-close-button').focus();
                $('#script-close-button').blur();
            });

            view.inject( list, {
                id : 'custom-script-dialog',
                mode: 'edit',
                scope: scope,
                breadCrumbs: false,
                activityStream: false,
                showSearch: true
            });

            SearchInit({
                scope: scope,
                set: 'custom_inventories',
                list: list,
                url: defaultUrl
            });
            PaginateInit({
                scope: scope,
                list: list,
                url: defaultUrl
            });

            scope.search(list.iterator);

            // SchedulesControllerInit({
            //     scope: scope,
            //     parent_scope: parent_scope,
            //     // list: list
            // });


            CreateDialog({
                id: 'custom-script-dialog',
                title: 'Inventory Scripts',
                target: 'custom-script-dialog',
                scope: scope,
                buttons: buttons,
                width: 700,
                height: 800,
                minWidth: 400,
                callback: callback,
                onClose: function () {
                    // Destroy on close
                    $('.tooltip').each(function () {
                        // Remove any lingering tooltip <div> elements
                        $(this).remove();
                    });
                    $('.popover').each(function () {
                        // remove lingering popover <div> elements
                        $(this).remove();
                    });
                    // $("#configure-jobs").show();
                    // $("#configure-schedules-form-container").hide();
                    // $('#configure-schedules-list').empty();
                    // $('#configure-schedules-form').empty();
                    // $('#configure-schedules-detail').empty();
                    // $('#configure-tower-dialog').hide();
                    $(this).dialog('destroy');
                    scope.cancelConfigure();
                },
            });



             // Cancel
            scope.cancelConfigure = function () {
                try {
                    $('#custom-script-dialog').dialog('close');
                }
                catch(e) {
                    //ignore
                }
                if (scope.searchCleanup) {
                    scope.searchCleanup();
                }
                // if (!Empty(parent_scope) && parent_scope.restoreSearch) {
                //     parent_scope.restoreSearch();
                // }
                else {
                    Wait('stop');
                }
            };

            scope.editCustomInv = function(id){
                CustomInventoryEdit({
                    scope: scope,
                    id: id
                });
            };
            scope.deleteCustomInv =  function(id, name){

                var action = function () {
                    $('#prompt-modal').modal('hide');
                    Wait('start');
                    var url = defaultUrl + id + '/';
                    Rest.setUrl(url);
                    Rest.destroy()
                        .success(function () {
                            scope.search(list.iterator);
                        })
                        .error(function (data, status) {
                            ProcessErrors(scope, data, status, null, { hdr: 'Error!',
                                msg: 'Call to ' + url + ' failed. DELETE returned status: ' + status });
                        });
                };

                Prompt({
                    hdr: 'Delete',
                    body: "<div class\"alert alert-info\">Are you sure you want to delete  " + name + "?</div>",
                    action: action
                });
            };

            scope.addCustomInv = function(){
                CustomInventoryAdd({
                    scope: scope
                });
            };



        };
    }])


.factory('CustomInventoryAdd', ['$compile','SchedulerInit', 'Rest', 'Wait', 'CustomInventoryList', 'CustomInventoryForm', 'ProcessErrors', 'GetBasePath', 'Empty', 'GenerateForm',
    'SearchInit' , 'PaginateInit', 'GenerateList',
function($compile, SchedulerInit, Rest, Wait, CustomInventoryList, CustomInventoryForm, ProcessErrors, GetBasePath, Empty, GenerateForm,
    SearchInit, PaginateInit, GenerateList) {
    return function(params) {
        var scope = params.scope,
            generator = GenerateForm,
            form = CustomInventoryForm,
            view = GenerateList,
            list = CustomInventoryList,
            url = GetBasePath('inventory_scripts');

        generator.inject(form, { id:'custom-script-dialog', mode: 'add' , scope:scope, related: false, breadCrumbs: false});
        generator.reset();

        // Save
        scope.formSave = function () {
            generator.clearApiErrors();
            Wait('start');
            Rest.setUrl(url);
            Rest.post({ name: scope.name, description: scope.description, script: scope.script })
                .success(function () {
                    view.inject( list, {
                        id : 'custom-script-dialog',
                        mode: 'edit',
                        scope: scope,
                        breadCrumbs: false,
                        activityStream: false,
                        showSearch: true
                    });

                    SearchInit({
                        scope: scope,
                        set: 'custom_inventories',
                        list: list,
                        url: url
                    });
                    PaginateInit({
                        scope: scope,
                        list: list,
                        url: url
                    });

                    scope.search(list.iterator);
                    Wait('stop');
                    Wait('stop');

                })
                .error(function (data, status) {
                    ProcessErrors(scope, data, status, form, { hdr: 'Error!',
                        msg: 'Failed to add new inventory script. Post returned status: ' + status });
                });
        };

        // Cancel
        scope.formReset = function () {
            generator.reset();
        };
    };
}])

.factory('CustomInventoryEdit', ['$compile','CustomInventoryList', 'Rest', 'Wait', 'GenerateList', 'CustomInventoryForm', 'ProcessErrors', 'GetBasePath', 'Empty', 'GenerateForm',
    'SearchInit', 'PaginateInit', '$routeParams',
function($compile, CustomInventoryList, Rest, Wait, GenerateList, CustomInventoryForm, ProcessErrors, GetBasePath, Empty, GenerateForm,
    SearchInit, PaginateInit, $routeParams) {
    return function(params) {
        var scope = params.scope,
            id = params.id,
            generator = GenerateForm,
            form = CustomInventoryForm,
            view = GenerateList,
            list = CustomInventoryList,
            master = {},
            url = GetBasePath('inventory_scripts');

        generator.inject(form, {
                id:'custom-script-dialog',
                mode: 'edit' ,
                scope:scope,
                related: false,
                breadCrumbs: false,
                activityStream: false
            });
        generator.reset();

        // Retrieve detail record and prepopulate the form
        Wait('start');
        Rest.setUrl(url + id+'/');
        Rest.get()
            .success(function (data) {
                var fld;
                for (fld in form.fields) {
                    if (data[fld]) {
                        scope[fld] = data[fld];
                        master[fld] = data[fld];
                    }
                }
                Wait('stop');
            })
            .error(function (data, status) {
                ProcessErrors(scope, data, status, form, { hdr: 'Error!',
                    msg: 'Failed to retrieve inventory script: ' + $routeParams.id + '. GET status: ' + status });
            });

        scope.formSave = function () {
            generator.clearApiErrors();
            Wait('start');
            Rest.setUrl(url+ id+'/');
            Rest.put({ name: scope.name, description: scope.description, script: scope.script })
                .success(function () {
                    view.inject( list, {
                        id : 'custom-script-dialog',
                        mode: 'edit',
                        scope: scope,
                        breadCrumbs: false,
                        activityStream: false,
                        showSearch: true
                    });

                    SearchInit({
                        scope: scope,
                        set: 'custom_inventories',
                        list: list,
                        url: url
                    });
                    PaginateInit({
                        scope: scope,
                        list: list,
                        url: url
                    });

                    scope.search(list.iterator);

                    Wait('stop');

                })
                .error(function (data, status) {
                    ProcessErrors(scope, data, status, form, { hdr: 'Error!',
                        msg: 'Failed to add new inventory script. Post returned status: ' + status });
                });
        };

        scope.formReset = function () {
            generator.reset();
        };
    };
}]);
