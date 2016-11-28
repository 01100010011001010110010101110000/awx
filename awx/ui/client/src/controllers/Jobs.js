/*************************************************
 * Copyright (c) 2015 Ansible, Inc.
 *
 * All Rights Reserved
 *************************************************/

/**
 * @ngdoc function
 * @name controllers.function:Jobs
 * @description This controller's for the jobs page
 */



export function JobsListController($state, $rootScope, $log, $scope, $compile, $stateParams,
    ClearScope, Find, DeleteJob, RelaunchJob, AllJobsList, ScheduledJobsList, GetBasePath, Dataset, GetChoices) {

    ClearScope();

    var list = AllJobsList;

    init();

    function init() {
        // search init
        $scope.list = list;
        $scope[`${list.iterator}_dataset`] = Dataset.data;
        $scope[list.name] = $scope[`${list.iterator}_dataset`].results;

        $scope.showJobType = true;

        _.forEach($scope[list.name], buildTooltips);
        if ($scope.removeChoicesReady) {
            $scope.removeChoicesReady();
        }
        $scope.removeChoicesReady = $scope.$on('choicesReady', function() {
            $scope[list.name].forEach(function(item, item_idx) {
                var fld, field,
                    itm = $scope[list.name][item_idx];

                // Set the item type label
                if (list.fields.type) {
                    $scope.type_choices.every(function(choice) {
                        if (choice.value === item.type) {
                            itm.type_label = choice.label;
                            return false;
                        }
                        return true;
                    });
                }
            });
        });

        GetChoices({
            scope: $scope,
            url: GetBasePath('unified_jobs'),
            field: 'type',
            variable: 'type_choices',
            callback: 'choicesReady'
        });
    }

    function buildTooltips(job) {
        job.status_tip = 'Job ' + job.status + ". Click for details.";
    }

    $scope.deleteJob = function(id) {
        DeleteJob({ scope: $scope, id: id });
    };

    $scope.relaunchJob = function(event, id) {
        var job, typeId;
        try {
            $(event.target).tooltip('hide');
        } catch (e) {
            //ignore
        }

        job = Find({ list: $scope.jobs, key: 'id', val: id });
        if (job.type === 'inventory_update') {
            typeId = job.inventory_source;
        } else if (job.type === 'project_update') {
            typeId = job.project;
        } else if (job.type === 'job' || job.type === "system_job" || job.type === 'ad_hoc_command') {
            typeId = job.id;
        }
        RelaunchJob({ scope: $scope, id: typeId, type: job.type, name: job.name });
    };

    $scope.refreshJobs = function() {
        $state.go('.', null, { reload: true });
    };

    $scope.viewJobDetails = function(job) {

        var goToJobDetails = function(state) {
            $state.go(state, { id: job.id }, { reload: true });
        };
        switch (job.type) {
            case 'job':
                goToJobDetails('jobDetail');
                break;
            case 'ad_hoc_command':
                goToJobDetails('adHocJobStdout');
                break;
            case 'system_job':
                goToJobDetails('managementJobStdout');
                break;
            case 'project_update':
                goToJobDetails('scmUpdateStdout');
                break;
            case 'inventory_update':
                goToJobDetails('inventorySyncStdout');
                break;
            case 'workflow_job':
                goToJobDetails('workflowResults');
                break;
        }

    };

    $scope.$on('ws-jobs', function(){
        $scope.refreshJobs();
    });

    $scope.$on('ws-schedules', function(){
        $state.reload();
    });
}

JobsListController.$inject = ['$state', '$rootScope', '$log', '$scope', '$compile', '$stateParams',
    'ClearScope', 'Find', 'DeleteJob', 'RelaunchJob', 'AllJobsList', 'ScheduledJobsList', 'GetBasePath', 'Dataset', 'GetChoices'
];
