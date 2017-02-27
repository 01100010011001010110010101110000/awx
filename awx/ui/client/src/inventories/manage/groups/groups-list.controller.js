/*************************************************
 * Copyright (c) 2016 Ansible, Inc.
 *
 * All Rights Reserved
 *************************************************/
 export default
    ['$scope', '$rootScope', '$state', '$stateParams', 'InventoryGroups', 'generateList', 'InventoryUpdate',
    'GroupManageService', 'GroupsCancelUpdate', 'ViewUpdateStatus', 'rbacUiControlService', 'GetBasePath',
    'InventoryManageService', 'groupsUrl', 'GetSyncStatusMsg', 'GetHostsStatusMsg', 'groupsDataset', 'Find', 'QuerySet',
    function($scope, $rootScope, $state, $stateParams, InventoryGroups, generateList, InventoryUpdate,
        GroupManageService, GroupsCancelUpdate, ViewUpdateStatus, rbacUiControlService, GetBasePath,
        InventoryManageService, groupsUrl, GetSyncStatusMsg, GetHostsStatusMsg, groupsDataset, Find, qs){

        let list = InventoryGroups;

        init();

        function init(){
        $scope.inventory_id = $stateParams.inventory_id;

        $scope.canAdd = false;

        rbacUiControlService.canAdd(GetBasePath('inventory') + $scope.inventory_id + "/groups")
            .then(function(canAdd) {
                $scope.canAdd = canAdd;
            });

            // Search init
            $scope.list = list;
            $scope[`${list.iterator}_dataset`] = groupsDataset.data;
            $scope[list.name] = $scope[`${list.iterator}_dataset`].results;

            // The ncy breadcrumb directive will look at this attribute when attempting to bind to the correct scope.
            // In this case, we don't want to incidentally bind to this scope when editing a host or a group.  See:
            // https://github.com/ncuillery/angular-breadcrumb/issues/42 for a little more information on the
            // problem that this solves.
            $scope.ncyBreadcrumbIgnore = true;
            if($state.current.name === "inventoryManage.editGroup") {
                $scope.rowBeingEdited = $state.params.group_id;
                $scope.listBeingEdited = "groups";
            }

            $scope.inventory_id = $stateParams.inventory_id;
            _.forEach($scope[list.name], buildStatusIndicators);

        }

        function buildStatusIndicators(group){
            if (group === undefined || group === null) {
                group = {};
            }

            let group_status, hosts_status;

            group_status = GetSyncStatusMsg({
                status: group.summary_fields.inventory_source.status,
                has_inventory_sources: group.has_inventory_sources,
                source: ( (group.summary_fields.inventory_source) ? group.summary_fields.inventory_source.source : null )
            });
            hosts_status = GetHostsStatusMsg({
                active_failures: group.hosts_with_active_failures,
                total_hosts: group.total_hosts,
                inventory_id: $scope.inventory_id,
                group_id: group.id
            });
            _.assign(group,
                {status_class: group_status.class},
                {status_tooltip: group_status.tooltip},
                {launch_tooltip: group_status.launch_tip},
                {launch_class: group_status.launch_class},
                {group_schedule_tooltip: group_status.schedule_tip},
                {hosts_status_tip: hosts_status.tooltip},
                {hosts_status_class: hosts_status.class},
                {source: group.summary_fields.inventory_source ? group.summary_fields.inventory_source.source : null},
                {status: group.summary_fields.inventory_source ? group.summary_fields.inventory_source.status : null});
        }

        $scope.groupSelect = function(id){
            var group = $stateParams.group === undefined ? [id] : _($stateParams.group).concat(id).value();
            $state.go('inventoryManage', {
                inventory_id: $stateParams.inventory_id,
                group: group,
                group_search: {
                    page_size: '20',
                    page: '1',
                    order_by: 'name',
                }
            }, {reload: true});
        };
        $scope.createGroup = function(){
            $state.go('inventoryManage.addGroup');
        };
        $scope.editGroup = function(id){
            $state.go('inventoryManage.editGroup', {group_id: id});
        };
        $scope.deleteGroup = function(group){
            $scope.toDelete = {};
            angular.extend($scope.toDelete, group);
            if($scope.toDelete.total_groups === 0 && $scope.toDelete.total_hosts === 0) {
                // This group doesn't have any child groups or hosts - the user is just trying to delete
                // the group
                $scope.deleteOption = "delete";
            }
            $('#group-delete-modal').modal('show');
        };
        $scope.confirmDelete = function(){

            // Bind an even listener for the modal closing.  Trying to $state.go() before the modal closes
            // will mean that these two things are running async and the modal may not finish closing before
            // the state finishes transitioning.
            $('#group-delete-modal').off('hidden.bs.modal').on('hidden.bs.modal', function () {
                // Remove the event handler so that we don't end up with multiple bindings
                $('#group-delete-modal').off('hidden.bs.modal');
                // Reload the inventory manage page and show that the group has been removed
                $state.go('inventoryManage', null, {reload: true});
            });

            switch($scope.deleteOption){
                case 'promote':
                    GroupManageService.promote($scope.toDelete.id, $stateParams.inventory_id)
                        .then(() => {
                            if (parseInt($state.params.group_id) === $scope.toDelete.id) {
                                $state.go("inventoryManage", null, {reload: true});
                            } else {
                                $state.go($state.current, null, {reload: true});
                            }
                            $('#group-delete-modal').modal('hide');
                            $('body').removeClass('modal-open');
                            $('.modal-backdrop').remove();
                        });
                    break;
                default:
                    GroupManageService.delete($scope.toDelete.id).then(() => {
                        if (parseInt($state.params.group_id) === $scope.toDelete.id) {
                            $state.go("inventoryManage", null, {reload: true});
                        } else {
                            $state.go($state.current, null, {reload: true});
                        }
                        $('#group-delete-modal').modal('hide');
                        $('body').removeClass('modal-open');
                        $('.modal-backdrop').remove();
                    });
            }
        };
        $scope.updateGroup = function(group) {
            GroupManageService.getInventorySource({group: group.id}).then(res =>InventoryUpdate({
                scope: $scope,
                group_id: group.id,
                url: res.data.results[0].related.update,
                group_name: group.name,
                group_source: res.data.results[0].source
            }));
        };

        $scope.$on(`ws-jobs`, function(e, data){
            var group = Find({ list: $scope.groups, key: 'id', val: data.group_id });

            if (group === undefined || group === null) {
                group = {};
            }

            if(data.status === 'failed' || data.status === 'successful'){
                let path;
                if($stateParams && $stateParams.group && $stateParams.group.length > 0) {
                    path = GetBasePath('groups') + _.last($stateParams.group) + '/children';
                }
                else {
                    //reaches here if the user is on the root level group
                    path = GetBasePath('inventory') + $stateParams.inventory_id + '/root_groups';
                }
                qs.search(path, $state.params[`${list.iterator}_search`])
                .then(function(searchResponse) {
                    $scope[`${list.iterator}_dataset`] = searchResponse.data;
                    $scope[list.name] = $scope[`${list.iterator}_dataset`].results;
                    _.forEach($scope[list.name], buildStatusIndicators);
                });
            } else {
                var status = GetSyncStatusMsg({
                    status: data.status,
                    has_inventory_sources: group.has_inventory_sources,
                    source: group.source
                });
                group.status = data.status;
                group.status_class = status.class;
                group.status_tooltip = status.tooltip;
                group.launch_tooltip = status.launch_tip;
                group.launch_class = status.launch_class;
            }
        });

        $scope.cancelUpdate = function (id) {
            GroupsCancelUpdate({ scope: $scope, id: id });
        };
        $scope.viewUpdateStatus = function (id) {
            ViewUpdateStatus({
                scope: $scope,
                group_id: id
            });
        };
        $scope.showFailedHosts = function() {
            $state.go('inventoryManage', {failed: true}, {reload: true});
        };
        $scope.scheduleGroup = function(id) {
            // Add this group's id to the array of group id's so that it gets
            // added to the breadcrumb trail
            var groupsArr = $stateParams.group ? $stateParams.group : [];
            groupsArr.push(id);
            $state.go('inventoryManage.editGroup.schedules', {group_id: id, group: groupsArr}, {reload: true});
        };
        // $scope.$parent governed by InventoryManageController, for unified multiSelect options
        $scope.$on('multiSelectList.selectionChanged', (event, selection) => {
            $scope.$parent.groupsSelected = selection.length > 0 ? true : false;
            $scope.$parent.groupsSelectedItems = selection.selectedItems;
        });

        $scope.copyMoveGroup = function(id){
            $state.go('inventoryManage.copyMoveGroup', {group_id: id, groups: $stateParams.groups});
        };

        var cleanUpStateChangeListener = $rootScope.$on('$stateChangeSuccess', function(event, toState, toParams) {
             if (toState.name === "inventoryManage.editGroup") {
                 $scope.rowBeingEdited = toParams.group_id;
                 $scope.listBeingEdited = "groups";
             }
             else {
                 delete $scope.rowBeingEdited;
                 delete $scope.listBeingEdited;
             }
        });

        // Remove the listener when the scope is destroyed to avoid a memory leak
        $scope.$on('$destroy', function() {
            cleanUpStateChangeListener();
        });

    }];
