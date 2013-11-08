/************************************
 * Copyright (c) 2013 AnsibleWorks, Inc.
 *
 *
 *  Home.js
 *  
 *  Controller functions for Home tab
 *
 */

'use strict';

function Home ($routeParams, $scope, $rootScope, $location, Wait, ObjectCount, JobStatus, InventorySyncStatus, SCMSyncStatus, 
    ClearScope, Stream) {
    
    ClearScope('home');  //Garbage collection. Don't leave behind any listeners/watchers from the prior
                         //scope.

    var waitCount = 4;
    var loadedCount = 0;
    
    if (!$routeParams['login']) {
        // If we're not logging in, start the Wait widget. Otherwise, it's already running.
        Wait('start');
    }
    
    JobStatus({ target: 'container1' });
    InventorySyncStatus({ target: 'container2' });
    SCMSyncStatus({ target: 'container4' });
    ObjectCount({ target: 'container3' });

    $rootScope.showActivity = function() { Stream(); }
     
    $rootScope.$on('WidgetLoaded', function() {
        // Once all the widgets report back 'loaded', turn off Wait widget
        loadedCount++; 
        if ( loadedCount == waitCount ) {
           Wait('stop');
        }
        });
    }

Home.$inject=[ '$routeParams', '$scope', '$rootScope', '$location', 'Wait', 'ObjectCount', 'JobStatus', 'InventorySyncStatus',
    'SCMSyncStatus', 'ClearScope', 'Stream'];


function HomeGroups ($location, $routeParams, HomeGroupList, GenerateList, ProcessErrors, LoadBreadCrumbs, ReturnToCaller, ClearScope, 
    GetBasePath, SearchInit, PaginateInit, FormatDate, HostsStatusMsg, UpdateStatusMsg, ViewUpdateStatus) {

    ClearScope('htmlTemplate');  //Garbage collection. Don't leave behind any listeners/watchers from the prior
                                 //scope.

    var generator = GenerateList;
    var list = HomeGroupList;
    var defaultUrl=GetBasePath('groups');

    var scope = generator.inject(list, { mode: 'edit' });
    var base = $location.path().replace(/^\//,'').split('/')[0];

    if (scope.removePostRefresh) {
       scope.removePostRefresh();
    }
    scope.removePostRefresh = scope.$on('PostRefresh', function() {
        var msg, update_status, last_update;
        for (var i=0; i < scope.groups.length; i++) {
            
            scope['groups'][i]['inventory_name'] = scope['groups'][i]['summary_fields']['inventory']['name'];

            last_update = (scope.groups[i].summary_fields.inventory_source.last_updated == null) ? null : 
                FormatDate(new Date(scope.groups[i].summary_fields.inventory_source.last_updated));    
             
            // Set values for Failed Hosts column
            scope.groups[i].failed_hosts = scope.groups[i].hosts_with_active_failures + ' / ' + scope.groups[i].total_hosts;
            
            msg = HostsStatusMsg({
                active_failures: scope.groups[i].hosts_with_active_failures,
                total_hosts: scope.groups[i].total_hosts,
                inventory_id: scope.groups[i].inventory
                });
            
            update_status = UpdateStatusMsg({ status: scope.groups[i].summary_fields.inventory_source.status });

            scope.groups[i].failed_hosts_tip = msg['tooltip']; 
            scope.groups[i].failed_hosts_link = msg['url'];
            scope.groups[i].failed_hosts_class = msg['class'];
            scope.groups[i].status = update_status['status'];
            scope.groups[i].source = scope.groups[i].summary_fields.inventory_source.source;
            scope.groups[i].last_updated = last_update;
            scope.groups[i].status_badge_class = update_status['class'];
            scope.groups[i].status_badge_tooltip = update_status['tooltip'];
        }
        });

    SearchInit({ scope: scope, set: 'groups', list: list, url: defaultUrl });
    PaginateInit({ scope: scope, list: list, url: defaultUrl });

    if ($routeParams['status']) {
        // with status param, called post update-submit
        scope[list.iterator + 'SearchField'] = 'status';
        scope[list.iterator + 'SelectShow'] = true;
        scope[list.iterator + 'SearchSelectOpts'] = list.fields['status'].searchOptions;
        scope[list.iterator + 'SearchFieldLabel'] = list.fields['status'].label.replace(/\<br\>/g,' ');
        for (var opt in list.fields['status'].searchOptions) {
            if (list.fields['status'].searchOptions[opt].value == $routeParams['status']) {
               scope[list.iterator + 'SearchSelectValue'] = list.fields['status'].searchOptions[opt];
               break;
            }
        }
    }

    scope.search(list.iterator);
   
    LoadBreadCrumbs();

    scope.viewUpdateStatus = function(id) { ViewUpdateStatus({ scope: scope, group_id: id }) };

    }

HomeGroups.$inject = [ '$location', '$routeParams', 'HomeGroupList', 'GenerateList', 'ProcessErrors', 'LoadBreadCrumbs', 'ReturnToCaller', 
    'ClearScope', 'GetBasePath', 'SearchInit', 'PaginateInit', 'FormatDate', 'HostsStatusMsg', 'UpdateStatusMsg', 'ViewUpdateStatus'
    ]; 
  