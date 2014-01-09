/*********************************************
 *  Copyright (c) 2014 AnsibleWorks, Inc.
 *
 *  GroupsHelper
 *
 *  Routines that handle group add/edit/delete on the Inventory tree widget.
 *  
 */

'use strict';

angular.module('GroupsHelper', [ 'RestServices', 'Utilities', 'ListGenerator', 'GroupListDefinition',
                                 'SearchHelper', 'PaginateHelper', 'ListGenerator', 'AuthService', 'GroupsHelper',
                                 'InventoryHelper', 'SelectionHelper', 'JobSubmissionHelper', 'RefreshHelper',
                                 'PromptDialog', 'InventorySummaryHelpDefinition', 'CredentialsListDefinition',
                                 'InventoryTree'
                                 ])

    .factory('GetSourceTypeOptions', [ 'Rest', 'ProcessErrors', 'GetBasePath', function(Rest, ProcessErrors, GetBasePath) {
        return function(params) {
            // Lookup options for source and build an array of drop-down choices
            var scope = params.scope;
            var variable = params.variable;
            if (scope[variable] == undefined) {
                scope[variable] = [];
                Rest.setUrl(GetBasePath('inventory_sources'));
                Rest.options()
                    .success( function(data, status, headers, config) { 
                        var choices = data.actions.GET.source.choices
                        for (var i=0; i < choices.length; i++) {
                            if (choices[i][0] !== 'file') {
                                scope[variable].push({ label: (choices[i][0] == "") ? 'Manual' : choices[i][1] , value: choices[i][0] });
                            }
                        }
                        })
                    .error( function(data, status, headers, config) { 
                        ProcessErrors(scope, data, status, null,
                            { hdr: 'Error!', msg: 'Failed to retrieve options for inventory_sources.source. OPTIONS status: ' + status });
                    });
            }
        }
        }])

    .factory('GetUpdateIntervalOptions', [ function() {
        return function() {
            return [
                { label: 'none', value: 0 },
                { label: '5 minutes', value: 5 },
                { label: '10 minutes', value: 10 },
                { label: '15 minutes', value: 15 },
                { label: '30 minutes', value: 30 },
                { label: '45 minutes', value: 45 },
                { label: '1 hour', value: 60 },
                { label: '2 hours', value: 120 }, 
                { label: '3 hours', value: 180 },
                { label: '4 hours', value: 240 },
                { label: '5 hours', value: 300 },
                { label: '6 hours', value: 360 },
                { label: '7 hours', value: 420 },
                { label: '8 hours', value: 480 },
                { label: '9 hours', value: 540 },
                { label: '10 hours', value: 600 },
                { label: '11 hours', value: 660 },
                { label: '12 hours', value: 720 },
                { label: '13 hours', value: 780 },
                { label: '14 hours', value: 840 },
                { label: '15 hours', value: 900 },
                { label: '16 hours', value: 960 },
                { label: '17 hours', value: 1020 },
                { label: '18 hours', value: 1080 },
                { label: '19 hours', value: 1140},
                { label: '20 hours', value: 1200 },
                { label: '21 hours', value: 1260 },
                { label: '22 hours', value: 1320 },
                { label: '23 hours', value: 1380 },
                { label: '24 hours', value: 1440 },
                { label: '48 hours', value: 1880 },
                { label: '72 hours', value: 4320 },
                { label: 'weekly (every 7 days)', value: 10080 },
                { label: 'monthly (every 30 days)', value: 43200 }
                ];
        }
        }])
    
    .factory('ViewUpdateStatus', [ 'Rest', 'ProcessErrors', 'GetBasePath', 'ShowUpdateStatus', 'Alert', 'Wait', 'Empty', 
    function(Rest, ProcessErrors, GetBasePath, ShowUpdateStatus, Alert, Wait, Empty) {
        return function(params) {
        
        var scope = params.scope;
        var id = params.tree_id;
        var found = false;
        var group;
        for (var i=0; i < scope.groups.length; i++) {
            if (scope.groups[i].id == id) {
               found = true;
               group = scope.groups[i];
            }  
        }
        if (found) {
           if (Empty(group.source)) {
              Alert('Missing Configuration', 'The selected group is not configured for inventory sync. ' +
                  'You must first edit the group, provide Source settings, and then run the sync process.', 'alert-info');
           }
           else if (Empty(group.status) || group.status == "never updated") {
              Alert('No Status Available', 'An inventory sync has not been performed for the selected group. Start the process by ' +
                  'clicking the <i class="fa fa-exchange"></i> button.', 'alert-info');
           }
           else {
              Wait('start');
              Rest.setUrl(group.related.inventory_source);
              Rest.get()
                  .success( function(data, status, headers, config) {
                      var url = (data.related.current_update) ? data.related.current_update : data.related.last_update;
                      ShowUpdateStatus({ 
                          group_name: data.summary_fields.group.name,
                          last_update: url,
                          license_error: (data.summary_fields.last_update && data.summary_fields.last_update.license_error) ? true : false
                          });
                      })
                  .error( function(data, status, headers, config) {
                      Wait('stop');
                      ProcessErrors(scope, data, status, form,
                          { hdr: 'Error!', msg: 'Failed to retrieve inventory source: ' + group.related.inventory_source + 
                          ' POST returned status: ' + status });
                      });
           }
        }

        }
        }])
    
    .factory('GetHostsStatusMsg', [ function() {
    return function(params) {  
        
        var active_failures = params.active_failures; 
        var total_hosts = params.total_hosts;
        var inventory_id = params.inventory_id;
        var group_id = params.group_id;

        var tip, failures, html_class;

        // Return values for use on host status indicator
        
        if (active_failures > 0) {
            tip = "Contains " + active_failures +
                [ (active_failures == 1) ? ' host' : ' hosts' ] + ' with failed jobs.' +
                [ (active_failures == 1) ? ' host' : ' hosts' ] + '.';
            html_class = 'true';
            failures = true;
        }
        else {
           failures = false;
           if (total_hosts == 0) {
               // no hosts
               tip = "There are no hosts in this group.";
               html_class = 'na';
           }
           else if (total_hosts == 1) {
               // on host with 0 failures
               tip = "The host in this group does not have a recent job failure.";
               html_class = 'false';
           }
           else {
               // many hosts with 0 failures
               tip = "None of the " + total_hosts + " hosts in this group have a recent job failure.";
               html_class = 'false';
           }
        }

        return { tooltip: tip, failures: failures, 'class': html_class };
        
        }
        }])

    .factory('GetSyncStatusMsg', [ function() {
    return function(params) {  
        
        var status = params.status;

        var launch_class = '';
        var launch_tip = 'Start sync process';        
        var stat, stat_class, status_tip;
        stat = status;
        stat_class = 'icon-cloud-' + stat;
      
        switch (status) {
            case 'never updated':
                stat = 'never';
                stat_class = 'icon-cloud-na disabled';
                status_tip = 'Sync not performed. Click <i class="fa fa-rocket"></i> to start it now.';
                break;
            case 'none':
            case '':
                launch_class = 'btn-disabled',
                stat = 'n/a';
                stat_class = 'icon-cloud-na disabled';
                status_tip = 'Group source not configured. Click <i class="fa fa-pencil"></i> to update.';
                launch_tip = status_tip;
                break;
            case 'failed':
                status_tip = 'Failed with errors. Click to view log.';
                break;
            case 'successful':
                status_tip = 'Success! Click to view log.';
                break; 
            case 'updating':
                status_tip = 'Running';
                break;
            }

        return { 
            'class': stat_class, 
            tooltip: status_tip,
            status: stat,
            'launch_class': launch_class, 
            'launch_tip': launch_tip
            }

        }
        }])

    .factory('GroupsList', ['$rootScope', '$location', '$log', '$routeParams', 'Rest', 'Alert', 'GroupList', 'GenerateList', 
        'Prompt', 'SearchInit', 'PaginateInit', 'ProcessErrors', 'GetBasePath', 'GroupsAdd', 'SelectionInit',
    function($rootScope, $location, $log, $routeParams, Rest, Alert, GroupList, GenerateList, Prompt, SearchInit, PaginateInit,
        ProcessErrors, GetBasePath, GroupsAdd, SelectionInit) {
    return function(params) {
        
        // build and present the list of groups we can add to an existing group

        var inventory_id = params.inventory_id;
        var group_id = (params.group_id !== undefined) ? params.group_id : null;

        var list = GroupList;
        var defaultUrl = GetBasePath('inventory') + inventory_id + '/groups/';
        var view = GenerateList;
        
        var scope = view.inject(GroupList, {
            id: 'form-modal-body', 
            mode: 'select',
            breadCrumbs: false,
            selectButton: false 
            });

        scope.formModalActionLabel = 'Select';
        scope.formModalHeader = 'Copy Groups';
        scope.formModalCancelShow = true;
        scope.formModalActionClass = 'btn btn-success';
        
        $('.popover').popover('hide');  //remove any lingering pop-overs
        $('#form-modal .btn-none').removeClass('btn-none').addClass('btn-success');
        $('#form-modal').modal({ backdrop: 'static', keyboard: false });
        
        // Initialize the selection list
        var url = (group_id) ? GetBasePath('groups') + group_id + '/children/' :
            GetBasePath('inventory') + inventory_id + '/groups/'; 
        var selected = [];
        SelectionInit({ scope: scope, list: list, url: url, selected: selected });
        
        scope.formModalAction = function() {
            var groups = [];
            for (var j=0; j < selected.length; j++) {
                if (scope.inventoryRootGroups.indexOf(selected[j].id) > -1) {
                   groups.push(selected[j].name);
                }
            }

            if (groups.length > 0) {
               var action = function() {
                   $('#prompt-modal').modal('hide');
                   scope.finishSelection();
                   }
               if (groups.length == 1) {
                  Prompt({ hdr: 'Warning', body: 'Be aware that ' + groups[0] + 
                      ' is a top level group. Adding it to ' + scope.selectedNodeName + ' will remove it from the top level. Do you ' + 
                      ' want to continue with this action?', 
                      action: action });
               }
               else {
                  var list = '';
                  for (var i=0; i < groups.length; i++) {
                      if (i+1 == groups.length) {
                         list += ' and ' + groups[i];
                      }
                      else {
                         list += groups[i] + ', ';
                      }
                  }
                  Prompt({ hdr: 'Warning', body: 'Be aware that ' + list + 
                      ' are top level groups. Adding them to ' + scope.selectedNodeName + ' will remove them from the top level. Do you ' + 
                      ' want to continue with this action?', 
                      action: action });
               }
            }
            else {
               scope.finishSelection();
            }
            }
        
        var searchUrl = (group_id) ? GetBasePath('groups') + group_id + '/potential_children/' :
            GetBasePath('inventory') + inventory_id + '/groups/'; 

        SearchInit({ scope: scope, set: 'groups', list: list, url: searchUrl });
        PaginateInit({ scope: scope, list: list, url: searchUrl, mode: 'lookup' });
        scope.search(list.iterator);

        if (!scope.$$phase) {
           scope.$digest();
        }

        if (scope.removeModalClosed) {
           scope.removeModalClosed();
        }
        scope.removeModalClosed = scope.$on('modalClosed', function() {
            /*BuildTree({
                scope: scope,
                inventory_id: inventory_id,
                emit_on_select: 'NodeSelect',
                target_id: 'search-tree-container',
                refresh: true,
                moveable: true
                });*/
            });
        }
        }])

    .factory('InventoryStatus', [ '$rootScope', '$routeParams', 'Rest', 'Alert', 'ProcessErrors', 'GetBasePath', 'FormatDate', 'InventorySummary',
        'GenerateList', 'ClearScope', 'SearchInit', 'PaginateInit', 'Refresh', 'InventoryUpdate', 'GroupsEdit', 'HelpDialog',
        'InventorySummaryHelp', 'ClickNode', 'GetHostsStatusMsg', 'GetSyncStatusMsg', 'ViewUpdateStatus', 'Wait',
    function($rootScope, $routeParams, Rest, Alert, ProcessErrors, GetBasePath, FormatDate, InventorySummary, GenerateList, ClearScope, 
        SearchInit, PaginateInit, Refresh, InventoryUpdate, GroupsEdit, HelpDialog, InventorySummaryHelp, ClickNode,
        GetHostsStatusMsg, GetSyncStatusMsg, ViewUpdateStatus, Wait) {
    return function(params) {
        //Build a summary of a given inventory
        
        ClearScope('tree-form');
        
        $('#tree-form').hide().empty();
        var view = GenerateList;
        var list = InventorySummary;
        var scope = view.inject(InventorySummary, { mode: 'summary', id: 'tree-form', breadCrumbs: false });
        var defaultUrl = GetBasePath('inventory') + scope['inventory_id'] + '/groups/';
            //?group__isnull=false';
        var msg, update_status;

        if (scope.PostRefreshRemove) {
           scope.PostRefreshRemove();
        }
        scope.PostRefreshRemove = scope.$on('PostRefresh', function() {
            for (var i=0; i < scope.groups.length; i++) {
                var last_update = (scope.groups[i].summary_fields.inventory_source.last_updated == null) ? null : 
                    FormatDate(new Date(scope.groups[i].summary_fields.inventory_source.last_updated));    
                 
                // Set values for Failed Hosts column
                scope.groups[i].failed_hosts = scope.groups[i].hosts_with_active_failures + ' / ' + scope.groups[i].total_hosts;
                
                msg = GetHostsStatusMsg({
                    active_failures: scope.groups[i].hosts_with_active_failures,
                    total_hosts: scope.groups[i].total_hosts,
                    inventory_id: scope['inventory_id'],
                    group_id: scope['groups'][i]['id']
                    });
                
                update_status = GetSyncStatusMsg({ status: scope.groups[i].summary_fields.inventory_source.status });

                scope.groups[i].failed_hosts_tip = msg['tooltip']; 
                scope.groups[i].failed_hosts_link = msg['url'];
                scope.groups[i].failed_hosts_class = msg['class'];
                scope.groups[i].status = update_status['status'];
                scope.groups[i].source = scope.groups[i].summary_fields.inventory_source.source;
                scope.groups[i].last_updated = last_update;
                scope.groups[i].status_badge_class = update_status['class'];
                scope.groups[i].status_badge_tooltip = update_status['tooltip'];
                
                // Set cancel button attributes
                if (scope.groups[i].summary_fields.inventory_source.status == 'updating' ||
                     scope.groups[i].summary_fields.inventory_source.status == 'updating') {
                     scope.groups[i].cancel_tooltip = "Cancel the update process";
                     scope.groups[i].cancel_class = "";
                }
                else {
                    scope.groups[i].cancel_tooltip = "Update process is not running";
                    scope.groups[i].cancel_class = "btn-disabled";    
                }

                // Set update button attributes
                if (scope.groups[i].summary_fields.inventory_source.source == "" || 
                     scope.groups[i].summary_fields.inventory_source.source == null) {
                     scope.groups[i].update_tooltip = "No external source. Does not require an update.";
                     scope.groups[i].update_class = "btn-disabled";
                }
                else {
                    scope.groups[i].update_tooltip = "Start the inventory update process";
                    scope.groups[i].update_class = "";    
                }
            }

            if (scope.groups.length == 0) {
                // Force display for help tooltip when no groups exist
                $('#inventory-summary-help').focus();
            }
            
            });
        
        SearchInit({ scope: scope, set: 'groups', list: list, url: defaultUrl });
        PaginateInit({ scope: scope, list: list, url: defaultUrl });
        
        if (scope['inventorySummaryGroup'] || $routeParams['name']) {
           scope[list.iterator + 'SearchField'] = 'name';
           scope[list.iterator + 'SearchType'] = 'iexact';
           scope[list.iterator + 'SearchValue'] = (scope['inventorySummaryGroup']) ?
               scope['inventorySummaryGroup'] : $routeParams['name'];
           scope[list.iterator + 'SearchFieldLabel'] = list.fields['name'].label;
        }
        else if ($routeParams['has_external_source']) {
           scope[list.iterator + 'SearchField'] = 'has_external_source';
           scope[list.iterator + 'SearchValue'] = list.fields['has_external_source'].searchValue; 
           scope[list.iterator + 'InputDisable'] = true;
           scope[list.iterator + 'SearchType'] = 'in';
           scope[list.iterator + 'SearchFieldLabel'] = list.fields['has_external_source'].label;
        }
        else if ($routeParams['status']) {
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

        scope.search(list.iterator, false, true);
 
        scope.showHelp = function() {
            // Display help dialog
            $('.btn').blur();  //remove focus from the help button and all buttons
                               //this stops the tooltip from continually displaying
            HelpDialog({ defn: InventorySummaryHelp });
            }
        
        scope.viewUpdateStatus = function(group_id) { ViewUpdateStatus({ scope: scope, group_id: group_id }) };
        
        // Click on group name
        scope.GroupsEdit = function(group_id) {
            // On the tree, select the first occurrance of the requested group
            ClickNode({ selector: '#inventory-tree li[data-group-id="' + group_id + '"]' });
            }

        
        // Respond to refresh button
        scope.refresh = function() {
            /*scope.search(list.iterator, false, true);
            BuildTree({
                scope: scope,
                inventory_id: scope['inventory_id'],
                emit_on_select: 'NodeSelect',
                target_id: 'search-tree-container',
                refresh: true,
                moveable: true
                });*/
            }

        // Start the update process
        scope.updateGroup = function(id) {
            for (var i=0; i < scope.groups.length; i++) {
                if (scope.groups[i].id == id) {
                   if (scope.groups[i].summary_fields.inventory_source.source == "" || scope.groups[i].summary_fields.inventory_source.source == null) {
                      //Alert('Missing Configuration', 'The selected group is not configured for updates. You must first edit the group and provide ' +
                      //    'external Source settings before attempting an update.', 'alert-info');
                      // Do nothing. Act as though button is disabled.
                   }
                   else if (scope.groups[i].summary_fields.inventory_source.status == 'updating') {
                      Alert('Update in Progress', 'The inventory update process is currently running for group <em>' +
                          scope.groups[i].name + '</em>. Use the Refresh button to monitor the status.', 'alert-info'); 
                   }
                   else {
                      /*if (scope.groups[i].summary_fields.inventory_source.source == 'ec2') {
                         scope.sourceUsernameLabel = 'Access Key ID';
                         scope.sourcePasswordLabel = 'Secret Access Key';
                         scope.sourcePasswordConfirmLabel = 'Confirm Secret Access Key';
                      }
                      else {
                         scope.sourceUsernameLabel = 'Username';
                         scope.sourcePasswordLabel = 'Password'; 
                         scope.sourcePasswordConfirmLabel = 'Confirm Password';
                      }*/
                      Wait('start');
                      Rest.setUrl(scope.groups[i].related.inventory_source);
                      Rest.get()
                          .success( function(data, status, headers, config) {
                              InventoryUpdate({
                                  scope: scope, 
                                  group_id: id,
                                  url: data.related.update,
                                  group_name: data.summary_fields.group.name, 
                                  group_source: data.source
                                  });
                              })
                          .error( function(data, status, headers, config) {
                              Wait('stop');
                              ProcessErrors(scope, data, status, form,
                                  { hdr: 'Error!', msg: 'Failed to retrieve inventory source: ' + scope.groups[i].related.inventory_source + 
                                  ' POST returned status: ' + status });
                              });
                   }
                   break;
                }
            }
            }
        } 
        }])

    .factory('SourceChange', [ 'GetBasePath', 'CredentialList', 'LookUpInit',
    function(GetBasePath, CredentialList, LookUpInit){
    return function(params) {
        
        var scope = params.scope; 
        var form = params.form; 

        if (scope['source'].value == 'file') {
            scope.sourcePathRequired = true;
        }
        else {
            scope.sourcePathRequired = false;
            // reset fields
            scope.source_path = '';
            scope[form.name + '_form']['source_path'].$setValidity('required',true);
        }
        if (scope['source'].value == 'rax') {
            scope['source_region_choices'] = scope['rax_regions'];
            //$('#s2id_group_source_regions').select2('data', []);
            $('#s2id_group_source_regions').select2('data', [{ id: 'all', text: 'All' }]);
        }
        else if (scope['source'].value == 'ec2') {
            scope['source_region_choices'] = scope['ec2_regions'];
            //$('#s2id_group_source_regions').select2('data', []);
            $('#s2id_group_source_regions').select2('data', [{ id: 'all', text: 'All' }]);
        }
        var kind = (scope.source.value == 'rax') ? 'rax' : 'aws';
        var url = GetBasePath('credentials') + '?cloud=true&kind=' + kind;  
        LookUpInit({
            url: url, 
            scope: scope,
            form: form,
            list: CredentialList,
            field: 'credential' 
            });
        } 
        }])

    
    // Cancel a pending or running inventory sync
    .factory('GroupsCancelUpdate', ['Rest', 'ProcessErrors', 'Alert', 'Wait', 'Find',
    function(Rest, ProcessErrors, Alert, Wait, Find) {
    return function(params) {
        
        var scope = params.scope;
        var id = params.tree_id;

        if (scope.removeCancelUpdate) {
           scope.removeCancelUpdate();
        }
        scope.removeCancelUpdate = scope.$on('CancelUpdate', function(e, url) {
            // Cancel the update process
            Rest.setUrl(url)
            Rest.post()
                .success( function(data, status, headers, config) {
                    Wait('stop');
                    Alert('Inventory Sync Cancelled', 'Your request to cancel the update was submitted to the task maanger. ' +
                        'Click the <i class="fa fa-refresh fa-lg"></i> to check the sync status.', 'alert-info');        
                    })
                .error( function(data, status, headers, config) {
                    Wait('stop');
                    ProcessErrors(scope, data, status, null,
                        { hdr: 'Error!', msg: 'Call to ' + url + ' failed. POST status: ' + status });
                    });  
            });

        if (scope.removeCheckCancel) {
           scope.removeCheckCancel();
        }
        scope.removeCheckCancel = scope.$on('CheckCancel', function(e, last_update, current_update) {
            // Check that we have access to cancelling an update
            var url = (current_update) ? current_update : last_update;
            url += 'cancel/';
            Rest.setUrl(url);
            Rest.get()
                .success( function(data, status, headers, config) {
                    if (data.can_cancel) {
                        scope.$emit('CancelUpdate', url);
                    }
                    else {
                        Wait('stop');
                        Alert('Cancel Inventory Sync', 'Either you do not have access or the sync process completed. ' + 
                            'Click the <i class="fa fa-refresh fa-lg"></i> to view the latest status.', 'alert-info');
                    }
                    })
                .error( function(data, status, headers, config) {
                    Wait('stop');
                    ProcessErrors(scope, data, status, null,
                        { hdr: 'Error!', msg: 'Call to ' + url + ' failed. GET status: ' + status });
                    });
            });

        // Cancel the update process
        var group = Find({ list: scope.groups, key: 'id', val: id });
        if (group && (group.status == 'updating' || group.status == 'pending')) {
            // We found the group, and there is a running update
            Wait('start');
            Rest.setUrl(group.related.inventory_source);
            Rest.get()
                .success( function(data, status, headers, config) {
                    scope.$emit('CheckCancel', data.related.last_update, data.related.current_update);
                    })
                .error( function(data, status, headers, config) {
                    Wait('stop');
                    ProcessErrors(scope, data, status, null,
                        { hdr: 'Error!', msg: 'Call to ' + group.related.inventory_source + ' failed. GET status: ' + status });
                    });
        }
        else {
            Alert('Cancel Inventory Sync', 'The sync process completed. Click the <i class="fa fa-refresh fa-lg"></i> to' +
                  ' view the latest status.', 'alert-info');
        }
      
        }
        }])

    .factory('GroupsAdd', ['$rootScope', '$location', '$log', '$routeParams', 'Rest', 'Alert', 'GroupForm', 'GenerateForm', 
        'Prompt', 'ProcessErrors', 'GetBasePath', 'ParseTypeChange', 'GroupsEdit', 'ClickNode', 'Wait', 'GetChoices',
        'GetSourceTypeOptions', 'LookUpInit', 'BuildTree', 'SourceChange',
    function($rootScope, $location, $log, $routeParams, Rest, Alert, GroupForm, GenerateForm, Prompt, ProcessErrors,
        GetBasePath, ParseTypeChange, GroupsEdit, ClickNode, Wait, GetChoices, GetSourceTypeOptions, LookUpInit, BuildTree,
        SourceChange) {
    return function(params) {

        var inventory_id = params.inventory_id;
        var group_id = (params.group_id !== undefined) ? params.group_id : null;
        var inventory_scope = params.scope;

        // Inject dynamic view
        var defaultUrl = (group_id !== null) ? GetBasePath('groups') + group_id + '/children/' : 
            GetBasePath('inventory') + inventory_id + '/groups/';
        var form = GroupForm;
        var generator = GenerateForm;
        var scope = generator.inject(form, {mode: 'add', modal: true, related: false});
        var groupCreated = false;
        
        scope.formModalActionLabel = 'Save';
        scope.formModalCancelShow = true;
        scope.parseType = 'yaml';
        scope.source = null;
        ParseTypeChange(scope);

        $('#form-modal .btn-none').removeClass('btn-none').addClass('btn-success');
        $('#form-modal').on('hidden.bs.modal', function () {
            //if (!groupCreated) {
            //   ClickNode({ selector: '#' + scope['selectedNode'].attr('id') });
            //} 
            });
        
        generator.reset();
        var master={};

        if (scope.removeAddTreeRefreshed) {
            scope.removeAddTreeRefreshed();
        }
        scope.removeAddTreeRefreshed = scope.$on('groupTreeRefreshed', function(e) {
            Wait('stop');
            $('#form-modal').modal('hide');
            scope.removeAddTreeRefreshed();
            });

        if (scope.removeSaveComplete) {
           scope.removeSaveComplete();
        }
        scope.removeSaveComplete = scope.$on('SaveComplete', function(e, error) {
            if (!error) {
                scope.formModalActionDisabled = false;
                scope.showGroupHelp = false;  //get rid of the Hint
                BuildTree({ scope: inventory_scope, inventory_id: inventory_id, refresh: true });
            }
            });

        if (scope.removeFormSaveSuccess) {
           scope.removeFormSaveSuccess();
        }
        scope.removeFormSaveSuccess = scope.$on('formSaveSuccess', function(e, group_id, url) {
            
            // Source data gets stored separately from the group. Validate and store Source
            // related fields, then call SaveComplete to wrap things up.

            var parseError = false;
            var saveError = false;
            
            // Update the selector tree with new group name, descr
            //SetNodeName({ scope: scope['selectedNode'], group_id: group_id,
            //    name: scope.name, description: scope.description });

            if (scope.source.value !== null && scope.source.value !== '') {
                var data = {
                    group: group_id, 
                    source: scope['source'].value,
                    source_path: scope['source_path'],
                    credential: scope['credential'],
                    overwrite: scope['overwrite'],
                    overwrite_vars: scope['overwrite_vars'],
                    update_on_launch: scope['update_on_launch']
                    //update_interval: scope['update_interval'].value
                    };

                // Create a string out of selected list of regions
                var regions = $('#s2id_group_source_regions').select2("data");
                var r = [];
                for (var i=0; i < regions.length; i++) {
                    r.push(regions[i].id);
                }
                data['source_regions'] = r.join();
                
                if (scope['source'].value == 'ec2') {
                    // for ec2, validate variable data
                    try {
                         if (scope.envParseType == 'json') {
                            var json_data = JSON.parse(scope.source_vars);  //make sure JSON parses
                         }
                         else {
                            var json_data = jsyaml.load(scope.source_vars);  //parse yaml
                         }
                        
                         // Make sure our JSON is actually an object
                         if (typeof json_data !== 'object') {
                            throw "failed to return an object!";
                         }
                         
                         // Send JSON as a string
                         if ($.isEmptyObject(json_data)) {
                            data.source_vars = "";
                         }
                         else {
                            data.source_vars = JSON.stringify(json_data, undefined, '\t'); 
                         }
                    }
                    catch(err) {
                         parseError = true;
                         scope.$emit('SaveComplete', true);
                         Alert("Error", "Error parsing extra variables. Parser returned: " + err);     
                    }
                }

                if (!parseError) {           
                  Rest.setUrl(url)
                  Rest.put(data)
                      .success( function(data, status, headers, config) {
                          scope.$emit('SaveComplete', false);
                          })
                      .error( function(data, status, headers, config) {
                          scope.$emit('SaveComplete', true);
                          ProcessErrors(scope, data, status, form,
                              { hdr: 'Error!', msg: 'Failed to update group inventory source. PUT status: ' + status });
                          });
                }
            }
            else {
               // No source value
               scope.$emit('SaveComplete', false);
            }
            });


        // Save
        scope.formModalAction = function() {
            Wait('start');
            try { 
                scope.formModalActionDisabled = true;

                // Make sure we have valid variable data
                if (scope.parseType == 'json') {
                    var json_data = JSON.parse(scope.variables);  //make sure JSON parses
                }
                else {
                    var json_data = jsyaml.load(scope.variables);  //parse yaml
                }

                // Make sure our JSON is actually an object
                if (typeof json_data !== 'object') {
                    throw "failed to return an object!";
                }

                var data = { 
                    name: scope['name'],
                    description: scope['description']
                    };

                if (inventory_id) {
                    data['inventory'] = inventory_id;
                }

                if ($.isEmptyObject(json_data)) {
                    data['variables'] = "";
                }
                else {
                   data['variables'] = JSON.stringify(json_data, undefined, '\t');
                }

                Rest.setUrl(defaultUrl);
                Rest.post(data)
                    .success( function(data, status, headers, config) {
                        scope.$emit('formSaveSuccess', data.id, GetBasePath('inventory_sources') + data.id + '/');
                        }) 
                    .error( function(data, status, headers, config) {
                        Wait('stop');
                        scope.formModalActionDisabled = false;
                        ProcessErrors(scope, data, status, form,
                            { hdr: 'Error!', msg: 'Failed to add new group. POST returned status: ' + status });
                        });
            }
            catch(err) {
                Wait('stop');
                scope.formModalActionDisabled = false;
                Alert("Error", "Error parsing group variables. Parser returned: " + err);     
            }
            }

        scope.sourceChange = function() {
            SourceChange({
                scope: scope, 
                form: GroupForm
                });
            }

        // Cancel
        scope.formReset = function() {
            // Defaults
            generator.reset();
            }; 

        var choicesReady = 0;

        if (scope.removeChoicesReady) {
            scope.removeChoicesReady();  
        }
        scope.removeChoicesReady = scope.$on('choicesReadyGroup', function() {
            choicesReady++; 
            if (choicesReady == 2) {
                Wait('stop');
            }
            });

        // Load options for source regions
        GetChoices({
            scope: scope, 
            url: GetBasePath('inventory_sources'),
            field: 'source_regions',
            variable: 'rax_regions',
            choice_name: 'rax_region_choices',
            callback: 'choicesReadyGroup'
            });

        GetChoices({
            scope: scope, 
            url: GetBasePath('inventory_sources'),
            field: 'source_regions',
            variable: 'ec2_regions',
            choice_name: 'ec2_region_choices',
            callback: 'choicesReadyGroup'
            });

        GetSourceTypeOptions({ scope: scope, variable: 'source_type_options' });
        
        Wait('start');

        }
        }])

    .factory('GroupsEdit', ['$rootScope', '$location', '$log', '$routeParams', 'Rest', 'Alert', 'GroupForm', 'GenerateForm', 
        'Prompt', 'ProcessErrors', 'GetBasePath', 'SetNodeName', 'ParseTypeChange', 'GetSourceTypeOptions', 'InventoryUpdate',
        'GetUpdateIntervalOptions', 'ClickNode', 'LookUpInit', 'Empty', 'Wait', 'GetChoices', 'UpdateGroup', 'SourceChange',
    function($rootScope, $location, $log, $routeParams, Rest, Alert, GroupForm, GenerateForm, Prompt, ProcessErrors,
        GetBasePath, SetNodeName, ParseTypeChange, GetSourceTypeOptions, InventoryUpdate, GetUpdateIntervalOptions, ClickNode,
        LookUpInit, Empty, Wait, GetChoices, UpdateGroup, SourceChange) {
    return function(params) {
       
        var group_id = params.group_id;
        var inventory_id = params.inventory_id;
        var generator = GenerateForm;
        var form = GroupForm;
        var defaultUrl =  GetBasePath('groups') + group_id + '/';
        var groups_scope = params.scope;

        //var scope = 
        var scope = generator.inject(form, { mode: 'edit', modal: true, related: false });
        generator.reset();
        
        var master = {};
        var relatedSets = {};
        
        GetSourceTypeOptions({ scope: scope, variable: 'source_type_options' });
        
        //scope.update_interval_options = GetUpdateIntervalOptions();
        scope.formModalActionLabel = 'Save';
        scope.formModalCancelShow = true;
        scope.source = form.fields.source['default'];
        scope.parseType = 'yaml';
        scope[form.fields['source_vars'].parseTypeName] = 'yaml';
        scope.sourcePathRequired = false;
        
        ParseTypeChange(scope);
        ParseTypeChange(scope, 'source_vars', form.fields['source_vars'].parseTypeName);

        // After the group record is loaded, retrieve related data
        if (scope.groupLoadedRemove) {
           scope.groupLoadedRemove();
        }
        scope.groupLoadedRemove = scope.$on('groupLoaded', function() {
            for (var set in relatedSets) {
                scope.search(relatedSets[set].iterator);
            }

            if (scope.variable_url) {
                // get group variables
                Rest.setUrl(scope.variable_url);
                Rest.get()
                   .success( function(data, status, headers, config) {
                       if ($.isEmptyObject(data)) {
                           scope.variables = "---";
                       }
                       else {
                           scope.variables = jsyaml.safeDump(data);
                       }
                       Wait('stop');
                       })
                   .error( function(data, status, headers, config) {
                       scope.variables = null;
                       Wait('stop');
                       ProcessErrors(scope, data, status, form,
                           { hdr: 'Error!', msg: 'Failed to retrieve group variables. GET returned status: ' + status });
                       });
            }
            else {
                scope.variables = "---";
            }
            master.variables = scope.variables;

            if (scope.source_url) {
                // get source data
                Rest.setUrl(scope.source_url);
                Rest.get()
                    .success( function(data, status, headers, config) {
                        for (var fld in form.fields) {
                            if (fld == 'checkbox_group') {
                               for (var i = 0; i < form.fields[fld].fields.length; i++) {
                                   var flag = form.fields[fld].fields[i];
                                   if (data[flag.name] !== undefined) {
                                       scope[flag.name] = data[flag.name];
                                       master[flag.name] = scope[flag.name];
                                   }
                               }
                            }
                            if (fld == 'source') {
                                var found = false;
                                for (var i=0; i < scope.source_type_options.length; i++) {
                                    if (scope.source_type_options[i].value == data['source']) {
                                        scope['source'] = scope.source_type_options[i];
                                        found = true;
                                    }  
                                }
                                if (!found || scope['source'].value == "") {
                                    scope['groupUpdateHide'] = true;
                                }
                                else {
                                    scope['groupUpdateHide'] = false;
                                }
                                master['source'] = scope['source'];
                            }
                            else if (fld == 'update_interval') {
                                if (data[fld] == '' || data[fld] == null || data[fld] == undefined) {
                                    data[fld] = 0;
                                }
                                for (var i=0; i < scope.update_interval_options.length; i++) { 
                                    if (scope.update_interval_options[i].value == 
                                        data[fld]) {
                                        scope[fld] = scope.update_interval_options[i];
                                    }
                                }
                            }
                            else if (fld == 'source_vars') {
                                // Parse source_vars, converting to YAML.  
                                if ($.isEmptyObject(data.source_vars) || data.source_vars == "\{\}" || 
                                    data.source_vars == "null" || data.source_vars == "") {
                                    scope.source_vars = "---";
                                }
                                else {
                                    var json_obj = JSON.parse(data.extra_vars);
                                    scope.source_vars = jsyaml.safeDump(json_obj);
                                }
                                master.source_vars = scope.variables;
                            }
                            else if (data[fld]) {
                                scope[fld] = data[fld];
                                master[fld] = scope[fld];
                            }

                            if (form.fields[fld].sourceModel && data.summary_fields &&
                                data.summary_fields[form.fields[fld].sourceModel]) {
                                scope[form.fields[fld].sourceModel + '_' + form.fields[fld].sourceField] = 
                                    data.summary_fields[form.fields[fld].sourceModel][form.fields[fld].sourceField];
                                master[form.fields[fld].sourceModel + '_' + form.fields[fld].sourceField] = 
                                    data.summary_fields[form.fields[fld].sourceModel][form.fields[fld].sourceField];
                            }
                        }
                       
                        scope.sourceChange();   //set defaults that rely on source value
                       
                        if (data['source_regions']) {
                            if (data['source'] == 'ec2' || data['source'] == 'rax') {
                                var set = (data['source'] == 'ec2') ? scope['ec2_regions'] : scope['rax_regions'];
                                var opts = [];
                                var list = data['source_regions'].split(','); 
                                for (var i=0; i < list.length; i++) {
                                    for (var j=0; j < set.length; j++) {
                                        if (list[i] == set[j].value) {
                                           opts.push({ id: set[j].value, text: set[j].label });
                                        }
                                    }
                                }
                                master['source_regions'] = opts;
                                $('#s2id_group_source_regions').select2('data', opts);
                            }
                        }
                        else {
                            // If empty, default to all
                            master['source_regions'] = [{ id: 'all', text: 'All' }];
                        }
                        scope['group_update_url'] = data.related['update'];    
                        Wait('stop');
                        })
                    .error( function(data, status, headers, config) {
                        scope.source = "";
                        Wait('stop');
                        ProcessErrors(scope, data, status, form,
                            { hdr: 'Error!', msg: 'Failed to retrieve inventory source. GET status: ' + status });
                        });
            }
            });

            
        if (scope.removeChoicesComplete) {
            scope.removeChoicesComplete();
        }
        scope.removeChoicesComplete = scope.$on('choicesCompleteGroup', function() {      
            // Retrieve detail record and prepopulate the form
            Rest.setUrl(defaultUrl); 
            Rest.get()
                .success( function(data, status, headers, config) {
                    for (var fld in form.fields) {
                        if (data[fld]) {
                            scope[fld] = data[fld];
                            master[fld] = scope[fld];
                        }
                    }
                    var related = data.related;
                    for (var set in form.related) {
                        if (related[set]) {
                            relatedSets[set] = { url: related[set], iterator: form.related[set].iterator };
                        }
                    }
                    scope.variable_url = data.related.variable_data;
                    scope.source_url = data.related.inventory_source;
                    scope.$emit('groupLoaded');
                    })
                .error( function(data, status, headers, config) {
                    ProcessErrors(scope, data, status, form,
                        { hdr: 'Error!', msg: 'Failed to retrieve group: ' + defaultUrl + '. GET status: ' + status });
                    });
            });
        
        var choicesReady = 0;

        if (scope.removeChoicesReady) {
            scope.removeChoicesReady();  
        }
        scope.removeChoicesReady = scope.$on('choicesReadyGroup', function() {
            choicesReady++; 
            if (choicesReady == 2) {
                scope.$emit('choicesCompleteGroup');
            }
            });

        // Load options for source regions
        GetChoices({
            scope: scope, 
            url: GetBasePath('inventory_sources'),
            field: 'source_regions',
            variable: 'rax_regions',
            choice_name: 'rax_region_choices',
            callback: 'choicesReadyGroup'
            });

        GetChoices({
            scope: scope, 
            url: GetBasePath('inventory_sources'),
            field: 'source_regions',
            variable: 'ec2_regions',
            choice_name: 'ec2_region_choices',
            callback: 'choicesReadyGroup'
            }); 
        
        Wait('start');

        //if (!scope.$$phase) {
        //   scope.$digest();
        //}

        if (scope.removeSaveComplete) {
           scope.removeSaveComplete();
        }
        scope.removeSaveComplete = scope.$on('SaveComplete', function(e, error) {
            if (!error) {
                UpdateGroup({ 
                    scope: groups_scope,
                    group_id: group_id,
                    properties: {
                        name: scope.name,
                        description: scope.description, 
                        has_inventory_sources: (scope.source) ? true : false 
                        }
                    });
                scope.formModalActionDisabled = false;
                scope.showGroupHelp = false;  //get rid of the Hint
                Wait('stop');
                $('#form-modal').modal('hide');
            }
            });

        if (scope.removeFormSaveSuccess) {
           scope.removeFormSaveSuccess();
        }
        scope.removeFormSaveSuccess = scope.$on('formSaveSuccess', function(e, group_id) {
            
            // Source data gets stored separately from the group. Validate and store Source
            // related fields, then call SaveComplete to wrap things up.

            var parseError = false;
            var saveError = false;
            
            // Update the selector tree with new group name, descr
            //SetNodeName({ scope: scope['selectedNode'], group_id: group_id,
            //    name: scope.name, description: scope.description });

            if (scope.source.value !== null && scope.source.value !== '') {
                var data = { group: group_id, 
                   source: scope['source'].value,
                   source_path: scope['source_path'],
                   credential: scope['credential'],
                   overwrite: scope['overwrite'],
                   overwrite_vars: scope['overwrite_vars'],
                   update_on_launch: scope['update_on_launch']
                   //update_interval: scope['update_interval'].value
                   };

                // Create a string out of selected list of regions
                var regions = $('#s2id_group_source_regions').select2("data");
                var r = [];
                for (var i=0; i < regions.length; i++) {
                    r.push(regions[i].id);
                }
                data['source_regions'] = r.join();
                
                if (scope['source'].value == 'ec2') {
                    // for ec2, validate variable data
                    try {
                         if (scope.envParseType == 'json') {
                            var json_data = JSON.parse(scope.source_vars);  //make sure JSON parses
                         }
                         else {
                            var json_data = jsyaml.load(scope.source_vars);  //parse yaml
                         }
                        
                         // Make sure our JSON is actually an object
                         if (typeof json_data !== 'object') {
                            throw "failed to return an object!";
                         }
                         
                         // Send JSON as a string
                         if ($.isEmptyObject(json_data)) {
                            data.source_vars = "";
                         }
                         else {
                            data.source_vars = JSON.stringify(json_data, undefined, '\t'); 
                         }
                    }
                    catch(err) {
                         parseError = true;
                         scope.$emit('SaveComplete', true);
                         Alert("Error", "Error parsing extra variables. Parser returned: " + err);     
                    }
                }

                if (!parseError) {           
                  Rest.setUrl(scope.source_url)
                  Rest.put(data)
                      .success( function(data, status, headers, config) {
                          scope.$emit('SaveComplete', false);
                          })
                      .error( function(data, status, headers, config) {
                          scope.$emit('SaveComplete', true);
                          ProcessErrors(scope, data, status, form,
                              { hdr: 'Error!', msg: 'Failed to update group inventory source. PUT status: ' + status });
                          });
                }
            }
            else {
               // No source value
               scope.$emit('SaveComplete', false);
            }
            });

        // Save
        scope.formModalAction = function() {
            Wait('start');
            try {
                var refreshHosts = false;
       
                // Make sure we have valid variable data
                if (scope.parseType == 'json') {
                   var json_data = JSON.parse(scope.variables);  //make sure JSON parses
                }
                else {
                   var json_data = jsyaml.load(scope.variables);  //parse yaml
                }

                // Make sure our JSON is actually an object
                if (typeof json_data !== 'object') {
                   throw "failed to return an object!";
                }

                var data = {}
                for (var fld in form.fields) {
                    data[fld] = scope[fld];   
                }
                
                data['inventory'] = inventory_id;
                
                Rest.setUrl(defaultUrl);
                Rest.put(data)
                    .success( function(data, status, headers, config) {
                        if (scope.variables) {
                           //update group variables
                           Rest.setUrl(scope.variable_url);
                           Rest.put(json_data)
                               .error( function(data, status, headers, config) {
                                   ProcessErrors(scope, data, status, form,
                                       { hdr: 'Error!', msg: 'Failed to update group variables. PUT status: ' + status });
                                   });
                        }
                        scope.$emit('formSaveSuccess', data.id);
                        })
                    .error( function(data, status, headers, config) {
                        Wait('stop');
                        ProcessErrors(scope, data, status, form,
                            { hdr: 'Error!', msg: 'Failed to update group: ' + group_id + '. PUT status: ' + status });
                        });
            }
            catch(err) {
               Wait('stop');
               Alert("Error", "Error parsing group variables. Parser returned: " + err);     
            }
            };

        // Start the update process
        scope.updateGroup = function() {
            if (scope.source == "" || scope.source == null) {
              Alert('Missing Configuration', 'The selected group is not configured for updates. You must first edit the group, provide Source settings, ' + 
                  'and then run an update.', 'alert-info');
            }
            else if (scope.status == 'updating') {
              Alert('Update in Progress', 'The inventory update process is currently running for group <em>' +
                  scope.summary_fields.group.name + '</em>. Use the Refresh button to monitor the status.', 'alert-info'); 
            }
            else {
              /*if (scope.source == 'Amazon EC2') {
                 scope.sourceUsernameLabel = 'Access Key ID';
                 scope.sourcePasswordLabel = 'Secret Access Key';
                 scope.sourcePasswordConfirmLabel = 'Confirm Secret Access Key';
              }
              else {
                 scope.sourceUsernameLabel = 'Username';
                 scope.sourcePasswordLabel = 'Password'; 
                 scope.sourcePasswordConfirmLabel = 'Confirm Password';
              }*/
              InventoryUpdate({
                  scope: scope, 
                  group_id: group_id,
                  url: scope.group_update_url,
                  group_name: scope.name, 
                  group_source: scope.source.value
                  });
            }
            }
        
        // Change the lookup and regions when the source changes
        scope.sourceChange = function() {
            SourceChange({
                scope: scope, 
                form: GroupForm
                });
            }
        
        // Cancel
        scope.formReset = function() {
            generator.reset();
            for (var fld in master) {
                scope[fld] = master[fld];
            }
            scope.parseType = 'yaml';
            $('#s2id_group_source_regions').select2('data', master['source_regions']);
            }
            
        }
        }])


    .factory('GroupsDelete', ['$rootScope', '$location', '$log', '$routeParams', 'Rest', 'Alert', 'GroupForm', 'GenerateForm', 
        'Prompt', 'ProcessErrors', 'GetBasePath', 'Wait', 'ClickNode', 'BuildTree',
    function($rootScope, $location, $log, $routeParams, Rest, Alert, GroupForm, GenerateForm, Prompt, ProcessErrors,
        GetBasePath, Wait, ClickNode, BuildTree) {
    return function(params) {
        // Delete the selected group node. Disassociates it from its parent.
        
        var scope = params.scope;
        var tree_id = params.tree_id; 
        var inventory_id = params.inventory_id;
        
        var node, parent, url, parent_name; 

        for (var i=0; i < scope.groups.length; i++) {
            if (scope.groups[i].id == tree_id) {
                node = scope.groups[i];
            }
        }
        //if (node.parent != 0) {
        //   for (var i=0; i < scope.groups.length; i++) {
        //        if (scope.groups[i].id == node.parent) {
        //            parent = scope.groups[i];
         //           parent_name = scope.groups[i].name;
          //      }
        //   }
       // }
       // else {
       //    parent_name = scope.inventory_name;
       // }
        
        //if (parent) {
        //   url = GetBasePath('base') + 'groups/' + parent.group_id + '/children/';
        //}
        //else {
           url = GetBasePath('inventory') + inventory_id + '/groups/';
        //}
        var action_to_take = function() {
            $('#prompt-modal').on('hidden.bs.modal', function(){ Wait('start'); });
            $('#prompt-modal').modal('hide');
            Rest.setUrl(url);
            Rest.post({ id: node.group_id, disassociate: 1 })
               .success( function(data, status, headers, config) {
                   $('#prompt-modal').off();
                   scope.$emit('groupDeleteCompleted'); // Signal a group refresh to start
                   })
               .error( function(data, status, headers, config) {
                   Wait('stop');
                   ProcessErrors(scope, data, status, null,
                       { hdr: 'Error!', msg: 'Call to ' + url + ' failed. POST returned status: ' + status });
                   });      
            };
        
        Prompt({ hdr: 'Delete Group', body: '<p>Are you sure you want to delete group <em>' + node.name + '?</p>',
            action: action_to_take, 'class': 'btn-danger' });
  
        //'</em> from <em>' + parent_name + '</em>
        //Force binds to work. Not working usual way.
        //$('#prompt-header').text('Delete Group');
        //$('#prompt-body').html('<p>Are you sure you want to remove group <em>' + $(obj).attr('data-name') + '</em> from group <em>' +
        //    parent.attr('data-name') + '</em>?</p>');
        //$('#prompt-action-btn').addClass('btn-danger');
        //scope.promptAction = action_to_take;  // for some reason this binds?
        //('#prompt-modal').modal({
        //    backdrop: 'static',
        //    keyboard: true,
        //    show: true
        //    });
        }
        }])


    .factory('ShowUpdateStatus', ['$rootScope', '$location', '$log', '$routeParams', 'Rest', 'Alert', 'GenerateForm', 
        'Prompt', 'ProcessErrors', 'GetBasePath', 'FormatDate', 'InventoryStatusForm', 'Wait',
    function($rootScope, $location, $log, $routeParams, Rest, Alert, GenerateForm, Prompt, ProcessErrors, GetBasePath,
          FormatDate, InventoryStatusForm, Wait) {
    return function(params) {

        var group_name = params.group_name;
        var last_update = params.last_update;
        var generator = GenerateForm;
        var form = InventoryStatusForm;
        var license_error = params.license_error
        var scope;
   
        if (last_update == undefined || last_update == null || last_update == ''){
            Wait('stop');
            Alert('Missing Configuration', 'The selected group is not configured for inventory updates. ' +
                'You must first edit the group, provide Source settings, and then run an update.', 'alert-info');
        }
        else {
            // Retrieve detail record and prepopulate the form
            Rest.setUrl(last_update);
            Rest.get()
                .success( function(data, status, headers, config) {
                    $('#form-modal').on('shown.bs.modal', function() {
                        Wait('stop');
                        });
                    scope = generator.inject(form, { mode: 'edit', modal: true, related: false});
                    generator.reset();
                    for (var fld in form.fields) {
                        if (data[fld]) {
                           if (fld == 'created') {
                              scope[fld] = FormatDate(new Date(data[fld]));
                           }
                           else {
                              scope[fld] = data[fld];
                           }
                        }
                    }
                    scope.license_error = license_error; 
                    scope.formModalAction = function() {
                        $('#form-modal').modal("hide");
                        }
                    scope.formModalActionLabel = 'OK';
                    scope.formModalCancelShow = false;
                    scope.formModalInfo = false;
                    scope.formModalHeader = group_name + '<span class="subtitle"> - Inventory Update</span>';
                    $('#form-modal .btn-success').removeClass('btn-success').addClass('btn-none');
                    $('#form-modal').addClass('skinny-modal');
                    if (!scope.$$phase) {
                       scope.$digest();
                    }
                    })
                .error( function(data, status, headers, config) {
                    Wait('stop');
                    $('#form-modal').modal("hide");
                    ProcessErrors(scope, data, status, null,
                        { hdr: 'Error!', msg: 'Failed to retrieve last update: ' + last_update + '. GET status: ' + status });
                    });
        }
        
        }
        }]);








