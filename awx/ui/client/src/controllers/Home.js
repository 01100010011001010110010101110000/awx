/*************************************************
 * Copyright (c) 2016 Ansible, Inc.
 *
 * All Rights Reserved
 *************************************************/

/**
 * @ngdoc function
 * @name controllers.function:Home
 * @description This controller's for the dashboard
*/


/**
 * @ngdoc method
 * @name controllers.function:Home#Home
 * @methodOf controllers.function:Home
 * @description this function loads all the widgets on the dashboard.
 *  dashboardReady (emit) - this is called when the preliminary parts of the dashboard have been loaded, and loads each of the widgets. Note that the
 *                  Host count graph should only be loaded if the user is a super user
 *
*/

export function Home($scope, $compile, $stateParams, $rootScope, $location, $log, Wait,
    ClearScope, Rest, GetBasePath, ProcessErrors, $window, graphData){

    ClearScope('home');

    var dataCount = 0;

    $rootScope.$on('JobStatusChange-home', function () {
        Rest.setUrl(GetBasePath('dashboard'));
        Rest.get()
        .success(function (data) {
            $scope.dashboardData = data;
        })
        .error(function (data, status) {
            ProcessErrors($scope, data, status, null, { hdr: 'Error!', msg: 'Failed to get dashboard host graph data: ' + status });
        });

        Rest.setUrl(GetBasePath("jobs") + "?order_by=-finished&page_size=5&finished__isnull=false");
        Rest.get()
        .success(function (data) {
            $scope.dashboardJobsListData = data.results;
        })
        .error(function (data, status) {
            ProcessErrors($scope, data, status, null, { hdr: 'Error!', msg: 'Failed to get dashboard jobs list: ' + status });
        });

        Rest.setUrl(GetBasePath("job_templates") + "?order_by=-last_job_run&page_size=5&last_job_run__isnull=false");
        Rest.get()
        .success(function (data) {
            $scope.dashboardJobTemplatesListData = data.results;
        })
        .error(function (data, status) {
            ProcessErrors($scope, data, status, null, { hdr: 'Error!', msg: 'Failed to get dashboard jobs list: ' + status });
        });

    });

    if ($scope.removeDashboardDataLoadComplete) {
        $scope.removeDashboardDataLoadComplete();
    }
    $scope.removeDashboardDataLoadComplete = $scope.$on('dashboardDataLoadComplete', function () {
        dataCount++;
        if (dataCount === 3) {
            Wait("stop");
            dataCount = 0;
        }
    });

    if ($scope.removeDashboardReady) {
        $scope.removeDashboardReady();
    }
    $scope.removeDashboardReady = $scope.$on('dashboardReady', function (e, data) {
        $scope.dashboardCountsData = data;
        $scope.graphData = graphData;
        $scope.$emit('dashboardDataLoadComplete');

        var cleanupJobListener =
            $rootScope.$on('DataReceived:JobStatusGraph', function(e, data) {
                $scope.graphData.jobStatus = data;
            });

        $scope.$on('$destroy', function() {
            cleanupJobListener();
        });
    });

    if ($scope.removeDashboardJobsListReady) {
        $scope.removeDashboardJobsListReady();
    }
    $scope.removeDashboardJobsListReady = $scope.$on('dashboardJobsListReady', function (e, data) {
        $scope.dashboardJobsListData = data;
        $scope.$emit('dashboardDataLoadComplete');
    });

    if ($scope.removeDashboardJobTemplatesListReady) {
        $scope.removeDashboardJobTemplatesListReady();
    }
    $scope.removeDashboardJobTemplatesListReady = $scope.$on('dashboardJobTemplatesListReady', function (e, data) {
        $scope.dashboardJobTemplatesListData = data;
        $scope.$emit('dashboardDataLoadComplete');
    });

    $scope.refresh = function () {
        Wait('start');
        Rest.setUrl(GetBasePath('dashboard'));
        Rest.get()
        .success(function (data) {
            $scope.dashboardData = data;
            $scope.$emit('dashboardReady', data);
        })
        .error(function (data, status) {
            ProcessErrors($scope, data, status, null, { hdr: 'Error!', msg: 'Failed to get dashboard: ' + status });
        });
        Rest.setUrl(GetBasePath("jobs") + "?order_by=-finished&page_size=5&finished__isnull=false");
        Rest.get()
        .success(function (data) {
            data = data.results;
            $scope.$emit('dashboardJobsListReady', data);
        })
        .error(function (data, status) {
            ProcessErrors($scope, data, status, null, { hdr: 'Error!', msg: 'Failed to get dashboard jobs list: ' + status });
        });
        Rest.setUrl(GetBasePath("job_templates") + "?order_by=-last_job_run&page_size=5&last_job_run__isnull=false");
        Rest.get()
        .success(function (data) {
            data = data.results;
            $scope.$emit('dashboardJobTemplatesListReady', data);
        })
        .error(function (data, status) {
            ProcessErrors($scope, data, status, null, { hdr: 'Error!', msg: 'Failed to get dashboard job templates list: ' + status });
        });
    };

    $scope.refresh();
}

Home.$inject = ['$scope', '$compile', '$stateParams', '$rootScope', '$location', '$log','Wait',
    'ClearScope', 'Rest', 'GetBasePath', 'ProcessErrors', '$window', 'graphData'
];


/**
 * @ngdoc method
 * @name controllers.function:Home#HomeGroups
 * @methodOf controllers.function:Home
 * @description This controls the 'home/groups' page that is loaded from the dashboard
 *
*/
export function HomeGroups($rootScope, $log, $scope, $filter, $compile, $location, $stateParams, HomeGroupList, GenerateList, ProcessErrors, ReturnToCaller, ClearScope,
    GetBasePath, SearchInit, PaginateInit, FormatDate, GetHostsStatusMsg, GetSyncStatusMsg, ViewUpdateStatus, GroupsEdit, Wait,
    Alert, Rest, Empty, InventoryUpdate, Find, GroupsCancelUpdate, Store) {

    ClearScope('htmlTemplate'); //Garbage collection. Don't leave behind any listeners/watchers from the prior
    //scope.
    var generator = GenerateList,
        list = HomeGroupList,
        defaultUrl = GetBasePath('groups'),
        scope = $scope,
        opt, PreviousSearchParams;

    generator.inject(list, { mode: 'edit', scope: scope });

    function ellipsis(a) {
        if (a.length > 20) {
            return a.substr(0,20) + '...';
        }
        return a;
    }

    function attachElem(event, html, title) {
        var elem = $(event.target).parent();
        try {
            elem.tooltip('hide');
            elem.popover('destroy');
        }
        catch(err) {
            //ignore
        }
        $('.popover').each(function() {
            // remove lingering popover <div>. Seems to be a bug in TB3 RC1
            $(this).remove();
        });
        $('.tooltip').each( function() {
            // close any lingering tool tipss
            $(this).hide();
        });
        elem.attr({ "aw-pop-over": html, "data-popover-title": title, "data-placement": "right" });
        $compile(elem)(scope);
        elem.on('shown.bs.popover', function() {
            $('.popover').each(function() {
                $compile($(this))(scope);  //make nested directives work!
            });
            $('.popover-content, .popover-title').click(function() {
                elem.popover('hide');
            });
        });
        elem.popover('show');
    }

    if (scope.removePostRefresh) {
        scope.removePostRefresh();
    }
    scope.removePostRefresh = scope.$on('PostRefresh', function () {
        var i, hosts_status, stat;
        for (i = 0; i < scope.home_groups.length; i++) {
            scope.home_groups[i].inventory_name = scope.home_groups[i].summary_fields.inventory.name;

            stat = GetSyncStatusMsg({
                status: scope.home_groups[i].summary_fields.inventory_source.status,
                source: scope.home_groups[i].summary_fields.inventory_source.source,
                has_inventory_sources: scope.home_groups[i].has_inventory_sources
            }); // from helpers/Groups.js

            hosts_status = GetHostsStatusMsg({
                active_failures: scope.home_groups[i].hosts_with_active_failures,
                total_hosts: scope.home_groups[i].total_hosts,
                inventory_id: scope.home_groups[i].inventory,
                group_id: scope.home_groups[i].id
            });

            scope.home_groups[i].status_class = stat['class'];
            scope.home_groups[i].status_tooltip = stat.tooltip;
            scope.home_groups[i].launch_tooltip = stat.launch_tip;
            scope.home_groups[i].launch_class = stat.launch_class;
            scope.home_groups[i].hosts_status_tip = hosts_status.tooltip;
            scope.home_groups[i].show_failures = hosts_status.failures;
            scope.home_groups[i].hosts_status_class = hosts_status['class'];
            scope.home_groups[i].status = scope.home_groups[i].summary_fields.inventory_source.status;
            scope.home_groups[i].source = (scope.home_groups[i].summary_fields.inventory_source) ?
                scope.home_groups[i].summary_fields.inventory_source.source : null;
        }
    });

    SearchInit({
        scope: scope,
        set: 'home_groups',
        list: list,
        url: defaultUrl
    });

    PaginateInit({
        scope: scope,
        list: list,
        url: defaultUrl
    });

    // Process search params
    if ($stateParams.name) {
        scope[list.iterator + 'InputDisable'] = false;
        scope[list.iterator + 'SearchValue'] = $stateParams.name;
        scope[list.iterator + 'SearchField'] = 'name';
        scope[list.iterator + 'SearchFieldLabel'] = list.fields.name.label;
        scope[list.iterator + 'SearchSelectValue'] = null;
    }

    if ($stateParams.id) {
        scope[list.iterator + 'InputDisable'] = false;
        scope[list.iterator + 'SearchValue'] = $stateParams.id;
        scope[list.iterator + 'SearchField'] = 'id';
        scope[list.iterator + 'SearchFieldLabel'] = list.fields.id.label;
        scope[list.iterator + 'SearchSelectValue'] = null;
    }

    if ($stateParams.has_active_failures) {
        scope[list.iterator + 'InputDisable'] = true;
        scope[list.iterator + 'SearchValue'] = $stateParams.has_active_failures;
        scope[list.iterator + 'SearchField'] = 'has_active_failures';
        scope[list.iterator + 'SearchFieldLabel'] = list.fields.has_active_failures.label;
        scope[list.iterator + 'SearchSelectValue'] = ($stateParams.has_active_failures === 'true') ? { value: 1 } : { value: 0 };
    }

    if ($stateParams.status && !$stateParams.source) {
        scope[list.iterator + 'SearchField'] = 'last_update_failed';
        scope[list.iterator + 'SearchFieldLabel'] = list.fields.last_update_failed.label;
        scope[list.iterator + 'SelectShow'] = false;
        scope[list.iterator + 'SearchValue'] = 'failed';
        scope[list.iterator + 'SearchSelectValue'] = { value: 'failed' };

        //scope[list.iterator + 'SelectShow'] = true;
        //scope[list.iterator + 'SearchSelectOpts'] = list.fields.status.searchOptions;
        //scope[list.iterator + 'SearchFieldLabel'] = list.fields.status.label.replace(/<br\>/g, ' ');
        //for (opt in list.fields.status.searchOptions) {
        //    if (list.fields.status.searchOptions[opt].value === $stateParams.status) {
        //        scope[list.iterator + 'SearchSelectValue'] = list.fields.status.searchOptions[opt];
        //        break;
        //    }
        //}
    }

    if ($stateParams.source) {
        scope[list.iterator + 'SearchField'] = 'source';
        scope[list.iterator + 'SelectShow'] = true;
        scope[list.iterator + 'SearchSelectOpts'] = list.fields.source.searchOptions;
        scope[list.iterator + 'SearchFieldLabel'] = list.fields.source.label.replace(/<br\>/g, ' ');
        for (opt in list.fields.source.searchOptions) {
            if (list.fields.source.searchOptions[opt].value === $stateParams.source) {
                scope[list.iterator + 'SearchSelectValue'] = list.fields.source.searchOptions[opt];
                break;
            }
        }

        if ($stateParams.status) {
            scope[list.iterator + 'ExtraParms'] = 'inventory_source__status__icontains=' + $stateParams.status;
        }
    }

    if ($stateParams.has_external_source) {
        scope[list.iterator + 'SearchField'] = 'has_external_source';
        scope[list.iterator + 'SearchValue'] = list.fields.has_external_source.searchValue;
        scope[list.iterator + 'InputDisable'] = true;
        scope[list.iterator + 'SearchType'] = 'in';
        scope[list.iterator + 'SearchFieldLabel'] = list.fields.has_external_source.label;
    }

    if ($stateParams.inventory_source__id) {
        scope[list.iterator + 'SearchField'] = 'inventory_source';
        scope[list.iterator + 'SearchValue'] = $stateParams.inventory_source__id;
        scope[list.iterator + 'SearchFieldLabel'] = 'Source ID';
    }

    scope.search(list.iterator);

    scope.$emit('WatchUpdateStatus');  // Start watching for live updates

    if ($rootScope.removeJobStatusChange) {
        $rootScope.removeJobStatusChange();
    }
    $rootScope.removeJobStatusChange = $rootScope.$on('JobStatusChange-home', function(e, data) {
        var stat, group;
        if (data.group_id) {
            group = Find({ list: scope[list.name], key: 'id', val: data.group_id });
            if (group && (data.status === "failed" || data.status === "successful")) {
                // job completed, fefresh all groups
                $log.debug('Update completed. Refreshing the list');
                scope.refresh();
            }
            else if (group) {
                // incremental update, just update
                $log.debug('Status of group: ' + data.group_id + ' changed to: ' + data.status);
                stat = GetSyncStatusMsg({
                    status: data.status,
                    has_inventory_sources: group.has_inventory_sources,
                    source: group.source
                });
                $log.debug('changing tooltip to: ' + stat.tooltip);
                group.status = data.status;
                group.status_class = stat['class'];
                group.status_tooltip = stat.tooltip;
                group.launch_tooltip = stat.launch_tip;
                group.launch_class = stat.launch_class;
            }
        }
    });

    scope.editGroup = function (group_id, inventory_id) {
        PreviousSearchParams = Store('group_current_search_params');
        GroupsEdit({
            scope: scope,
            group_id: group_id,
            inventory_id: inventory_id,
            groups_reload: false,
            mode: 'edit'
        });
    };

    scope.restoreSearch = function() {
        SearchInit({
            scope: scope,
            set: PreviousSearchParams.set,
            list: PreviousSearchParams.list,
            url: PreviousSearchParams.defaultUrl,
            iterator: PreviousSearchParams.iterator,
            sort_order: PreviousSearchParams.sort_order,
            setWidgets: false
        });
        scope.refresh();
    };

    scope.viewUpdateStatus = function (id) {
        scope.groups = scope.home_groups;
        ViewUpdateStatus({
            scope: scope,
            group_id: id
        });
    };

    // Launch inventory sync
    scope.updateGroup = function (id) {
        var group = Find({ list: scope.home_groups, key: 'id', val: id });
        if (group) {
            if (Empty(group.source)) {
                // if no source, do nothing.
            } else if (group.status === 'updating') {
                Alert('Update in Progress', 'The inventory update process is currently running for group <em>' +
                    group.name + '</em>. Use the Refresh button to monitor the status.', 'alert-info');
            } else {
                Wait('start');
                Rest.setUrl(group.related.inventory_source);
                Rest.get()
                    .success(function (data) {
                        InventoryUpdate({
                            scope: scope,
                            url: data.related.update,
                            group_name: data.summary_fields.group.name,
                            group_source: data.source,
                            tree_id: group.id,
                            group_id: group.id
                        });
                    })
                    .error(function (data, status) {
                        ProcessErrors(scope, data, status, null, { hdr: 'Error!',
                            msg: 'Failed to retrieve inventory source: ' + group.related.inventory_source + ' POST returned status: ' + status
                        });
                    });
            }
        }
    };

    scope.refresh = function () {
        scope.search(list.iterator);
    };


    if (scope.removeHostSummaryReady) {
        scope.removeHostSummaryReady();
    }
    scope.removeHostSummaryReady = scope.$on('HostSummaryReady', function(e, event, data) {
        var html, title = "Recent Jobs";
        Wait('stop');
        if (data.length > 0) {
            html = "<table class=\"table table-condensed flyout\" style=\"width: 100%\">\n";
            html += "<thead>\n";
            html += "<tr>";
            html += "<th>Status</th>";
            html += "<th>Finished</th>";
            html += "<th>Name</th>";
            html += "</tr>\n";
            html += "</thead>\n";
            html += "<tbody>\n";
            data.forEach(function(row) {
                html += "<tr>\n";
                html += "<td><a href=\"#/jobs/" + row.id + "\" " + "aw-tool-tip=\"" + row.status.charAt(0).toUpperCase() + row.status.slice(1) +
                    ". Click for details\" aw-tip-placement=\"top\"><i class=\"fa icon-job-" +
                    row.status + "\"></i></a></td>\n";
                html += "<td>" + ($filter('longDate')(row.finished)).replace(/ /,'<br />') + "</td>";
                html += "<td><a href=\"#/jobs/" + row.id + "\" " + "aw-tool-tip=\"" + row.status.charAt(0).toUpperCase() + row.status.slice(1) +
                    ". Click for details\" aw-tip-placement=\"top\">" + ellipsis(row.name) + "</a></td>";
                html += "</tr>\n";
            });
            html += "</tbody>\n";
            html += "</table>\n";
        }
        else {
            html = "<p>No recent job data available for this inventory.</p>\n";
        }
        attachElem(event, html, title);
    });

    scope.showHostSummary = function(event, id) {
        var url, jobs = [];
        if (!Empty(id)) {
            Wait('start');
            url = GetBasePath('hosts') + "?groups__id=" + id + "&last_job__isnull=false&order_by=-last_job&page_size=5";
            Rest.setUrl(url);
            Rest.get()
                .success( function(data) {
                    data.results.forEach(function(host) {
                        var found = false;
                        jobs.every(function(existing_job) {
                            if (host.last_job === existing_job.id) {
                                found = true;
                                return false;
                            }
                            return true;
                        });
                        if (!found) {
                            jobs.push({
                                id: host.last_job,
                                status: host.summary_fields.last_job.status,
                                name: host.summary_fields.last_job.name,
                                finished: host.summary_fields.last_job.finished
                            });
                        }
                    });
                    scope.$emit('HostSummaryReady', event, jobs);
                })
                .error( function(data, status) {
                    ProcessErrors( scope, data, status, null, { hdr: 'Error!',
                        msg: 'Call to ' + url + ' failed. GET returned: ' + status
                    });
                });
        }
    };

    scope.cancelUpdate = function(id) {
        var group = Find({ list: scope.home_groups, key: 'id', val: id });
        GroupsCancelUpdate({ scope: scope, group: group });
    };


}

HomeGroups.$inject = ['$rootScope', '$log', '$scope', '$filter', '$compile', '$location', '$stateParams', 'HomeGroupList', 'generateList', 'ProcessErrors', 'ReturnToCaller',
    'ClearScope', 'GetBasePath', 'SearchInit', 'PaginateInit', 'FormatDate', 'GetHostsStatusMsg', 'GetSyncStatusMsg', 'ViewUpdateStatus',
    'GroupsEdit', 'Wait', 'Alert', 'Rest', 'Empty', 'InventoryUpdate', 'Find', 'GroupsCancelUpdate', 'Store', 'Socket'
];

/**
 * @ngdoc method
 * @name controllers.function:Home#HomeHosts
 * @methodOf controllers.function:Home
 * @description This loads the page for 'home/hosts'
 *
*/
