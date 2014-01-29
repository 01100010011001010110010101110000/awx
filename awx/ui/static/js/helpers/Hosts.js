/*********************************************
 *  Copyright (c) 2014 AnsibleWorks, Inc.
 *
 *  HostsHelper
 *
 *  Routines that handle host add/edit/delete on the Inventory detail page.
 *  
 */

angular.module('HostsHelper', [ 'RestServices', 'Utilities', 'ListGenerator', 'HostListDefinition',
                                'SearchHelper', 'PaginationHelpers', 'ListGenerator', 'AuthService', 'HostsHelper',
                                'InventoryHelper', 'RelatedSearchHelper', 'InventoryFormDefinition', 'SelectionHelper', 
                                'HostGroupsFormDefinition'
                                ])
  

    .factory('SetEnabledMsg', [ function() {
    return function(host) { 
        if (host.has_inventory_sources) {
            // Inventory sync managed, so not clickable 
            host.enabledToolTip = (host.enabled) ? 'Host is available' : 'Host is not available';
        }
        else {
            // Clickable
            host.enabledToolTip = (host.enabled) ? 'Host is available. Click to toggle.' : 'Host is not available. Click to toggle.';
        }
        }
        }])

    .factory('SetHostStatus', ['SetEnabledMsg', function(SetEnabledMsg) {
    return function(host) {  
        // Set status related fields on a host object
        host.activeFailuresLink = '/#/hosts/' + host.id + '/job_host_summaries/?inventory=' + host.inventory +
            '&host_name=' + escape(host.name); 
        if (host.has_active_failures == true) {
            host.badgeToolTip = 'Most recent job failed. Click to view jobs.';
            host.active_failures = 'failed';
        }
        else if (host.has_active_failures == false && host.last_job == null) {
           host.has_active_failures = 'none';
           host.badgeToolTip = "No job data available.";
           host.active_failures = 'n/a';
        }
        else if (host.has_active_failures == false && host.last_job !== null) {
           host.badgeToolTip = "Most recent job successful. Click to view jobs.";
           host.active_failures = 'success';
        }

        host.enabled_flag = host.enabled; 
        SetEnabledMsg(host);
      
        }
        }])

    .factory('SetStatus', ['SetEnabledMsg', 'Empty', function(SetEnabledMsg, Empty) {
    return function(params) {
        
        var scope = params.scope;
        var host = params.host;
        var html, title;
  
        function setMsg(host) {
            if (host.has_active_failures == true || (host.has_active_failures == false && host.last_job !== null)) {
                if (host.has_active_failures === true) {
                    host.badgeToolTip = 'Most recent job failed. Click to view jobs.';
                    host.active_failures = 'failed';
                }
                else {
                    host.badgeToolTip = "Most recent job successful. Click to view jobs.";
                    host.active_failures = 'success';
                }
                if (host.summary_fields.recent_jobs.length > 0) {
                    // build html table of job status info
                    var jobs = host.summary_fields.recent_jobs.sort( 
                        function(a,b) {
                            // reverse numerical order
                            return -1 * (a - b);  
                        });
                    title = "Recent Jobs";
                    html = "<table class=\"table table-condensed\" style=\"width: 100%\">\n";
                    html += "<thead>\n";
                    html += "<tr>\n";
                    html += "<th>ID</td>\n";
                    html += "<th class=\"text-center\">Status</td>\n";
                    html += "<th>Name</td>\n";
                    html += "</tr>\n";
                    html += "</thead>\n";
                    html += "<tbody>\n";
                    for (var j=0; j < jobs.length; j++) {
                         var job = jobs[j];     
                         html += "<tr>\n";
                         html += "<td><a ng-click=\"showJobSummary(" + job.id + ")\">" + job.id + "</a></td>\n";
                         html += "<td class=\"text-center\"><a ng-click=\"showJobSummary(" + job.id + ")\"><i class=\"fa icon-job-" + job.status + "\"></i></a></td>\n";
                         html += "<td>" + job.name + "</td>\n";
                         html += "</tr>\n";
                    }
                    html += "</tbody>\n";
                    html += "</table>\n";
                }
                else {
                    title = 'No job data';
                    html = '<p>No recent job data available for this host.</p>';
                }
            }
            else if (host.has_active_failures == false && host.last_job == null) {
                host.has_active_failures = 'none';
                host.badgeToolTip = "No job data available.";
                host.active_failures = 'n/a';
            }
            host.job_status_html = html; 
            host.job_status_title = title;
            }

        if (!Empty(host)) {
            // update single host
            setMsg(host);
            SetEnabledMsg(host);
        }
        else {
            // update all hosts
            for (var i=0; i < scope.hosts.length; i++) {
                setMsg(scope.hosts[i]);
                SetEnabledMsg(scope.hosts[i]);
            }
        }

        }
        }])
    
    .factory('HostsReload', [ '$routeParams', 'Empty', 'InventoryHosts', 'GetBasePath', 'SearchInit', 'PaginateInit', 'Wait', 
    'SetHostStatus', 'SetStatus', 'ApplyEllipsis',
    function($routeParams, Empty, InventoryHosts, GetBasePath, SearchInit, PaginateInit, Wait, SetHostStatus, SetStatus,
    ApplyEllipsis) {
    return function(params) {
        
        var scope = params.scope;
        var group_id = params.group_id;
        var tree_id = params.tree_id
        var inventory_id = params.inventory_id;
        
        var list = InventoryHosts;
        var url = ( !Empty(group_id) ) ? GetBasePath('groups') + group_id + '/all_hosts/' :
            GetBasePath('inventory') + inventory_id + '/hosts/';
        
        scope.search_place_holder='Search ' + scope.selected_group_name;

        if (scope.removePostRefresh) {
            scope.removePostRefresh();
        }
        scope.removePostRefresh = scope.$on('PostRefresh', function(e) {
            for (var i=0; i < scope.hosts.length; i++) {
                //Set tooltip for host enabled flag
                scope.hosts[i].enabled_flag = scope.hosts[i].enabled;
                //SetHostStatus(scope.hosts[i]);
            }
            SetStatus({ scope: scope });
            setTimeout(function() { ApplyEllipsis('#hosts_table .host-name a'); }, 2500);
            Wait('stop');
            scope.$emit('HostReloadComplete');
            });

        SearchInit({ scope: scope, set: 'hosts', list: list, url: url });
        PaginateInit({ scope: scope, list: list, url: url });

        if ($routeParams['host_name']) {
            scope[list.iterator + 'InputDisable'] = false;
            scope[list.iterator + 'SearchValue'] = $routeParams['host_name'];
            scope[list.iterator + 'SearchField'] = 'name';
            scope[list.iterator + 'SearchFieldLabel'] = list.fields['name'].label;
            scope[list.iterator + 'SearchSelectValue'] = null;
        }

        if (scope.show_failures) {
            scope[list.iterator + 'InputDisable'] = true;
            scope[list.iterator + 'SearchValue'] = 'true';
            scope[list.iterator + 'SearchField'] = 'has_active_failures';
            scope[list.iterator + 'SearchFieldLabel'] = list.fields['has_active_failures'].label;
            scope[list.iterator + 'SearchSelectValue'] = { value: 1 };
        }

        scope.search(list.iterator);

        }  
        }])

    .factory('InjectHosts', ['GenerateList', 'InventoryHosts', 'HostsReload',
    function(GenerateList, InventoryHosts, HostsReload) {
    return function(params) {

        var scope = params.scope;
        var inventory_id = params.inventory_id;
        var group_id = params.group_id;
        var tree_id = params.tree_id;
        
        // Inject the list html
        var generator = GenerateList;
        generator.inject(InventoryHosts, { scope: scope, mode: 'edit', id: 'hosts-container', breadCrumbs: false, searchSize: 'col-lg-6 col-md-6 col-sm-6' });

        // Load data
        HostsReload({ scope: scope, group_id: group_id, tree_id: tree_id, inventory_id: inventory_id });
        }
        }])

    .factory('ToggleHostEnabled', [ 'GetBasePath', 'Rest', 'Wait', 'ProcessErrors', 'Alert', 'Find', 'SetEnabledMsg',
    function(GetBasePath, Rest, Wait, ProcessErrors, Alert, Find, SetEnabledMsg) {
    return function(params) {
        
        var id = params.host_id; 
        var external_source = params.external_source;
        var scope = params.scope 

        var host;
        
        function setMsg(host) {
            host.enabled = (host.enabled) ? false : true;  
            host.enabled_flag = host.enabled; 
            SetEnabledMsg(host);
            }

        if (!external_source) {
            // Host is not managed by an external source
            Wait('start');
            host = Find({ list: scope.hosts, key: 'id', val: id });
            setMsg(host);
            
            Rest.setUrl(GetBasePath('hosts') + id + '/');
            Rest.put(host)
                .success( function(data, status, headers, config) {
                    Wait('stop');
                    })
                .error( function(data, status, headers, config) {
                    // Flip the enabled flag back
                    setMsg(host);   
                    Wait('stop');
                    ProcessErrors(scope, data, status, null,
                        { hdr: 'Error!', msg: 'Failed to update host. PUT returned status: ' + status });
                    });
        }
        else {
            Alert('Action Not Allowed', 'This host is part of a cloud inventory. It can only be disabled in the cloud.' +
                ' After disabling it, run an inventory sync to see the new status reflected here.',
                'alert-info');
        }
        }
        }])

    .factory('HostsList', ['$rootScope', '$location', '$log', '$routeParams', 'Rest', 'Alert', 'HostList', 'GenerateList', 
        'Prompt', 'SearchInit', 'PaginateInit', 'ProcessErrors', 'GetBasePath', 'HostsAdd', 'HostsReload',
        'SelectionInit',
    function($rootScope, $location, $log, $routeParams, Rest, Alert, HostList, GenerateList, Prompt, SearchInit,
        PaginateInit, ProcessErrors, GetBasePath, HostsAdd, HostsReload, SelectionInit) {
    return function(params) {
        
        var inventory_id = params.inventory_id;
        var group_id = params.group_id;
        
        var list = HostList;

        list.iterator = 'subhost';  //Override the iterator and name so the scope of the modal dialog
        list.name = 'subhosts';     //will not conflict with the parent scope

        var view = GenerateList;

        var scope = view.inject(list, {
            id: 'form-modal-body', 
            mode: 'select',
            breadCrumbs: false,
            selectButton: false
            });
        
        var defaultUrl = GetBasePath('inventory') + inventory_id + '/hosts/?not__groups__id=' + scope.group_id;
        
        scope.formModalActionLabel = 'Select';
        scope.formModalHeader = 'Add Existing Hosts';
        scope.formModalCancelShow = true;
    
        SelectionInit({ scope: scope, list: list, url: GetBasePath('groups') + group_id + '/hosts/' });

        if (scope.removeModalClosed) {
           scope.removeModalClosed();
        }
        scope.removeModalClosed = scope.$on('modalClosed', function() {
            // if the modal closed, assume something got changed and reload the host list
            HostsReload(params);
        });
        
        $('.popover').popover('hide');  //remove any lingering pop-overs
        $('#form-modal .btn-none').removeClass('btn-none').addClass('btn-success');
        $('#form-modal').modal({ backdrop: 'static', keyboard: false });
        
        SearchInit({ scope: scope, set: 'subhosts', list: list, url: defaultUrl });
        PaginateInit({ scope: scope, list: list, url: defaultUrl, mode: 'lookup' });
        scope.search(list.iterator);

        if (!scope.$$phase) {
           scope.$digest();
        }

        scope.createHost = function() {
            $('#form-modal').modal('hide');
            HostsAdd({ scope: params.scope, inventory_id: inventory_id, group_id: group_id });
            }

        }
        }])


    .factory('HostsCreate', ['$rootScope', '$location', '$log', '$routeParams', 'Rest', 'Alert', 'HostForm', 'GenerateForm', 
        'Prompt', 'ProcessErrors', 'GetBasePath', 'HostsReload', 'ParseTypeChange', 'Wait', 'WatchInventoryWindowResize',
    function($rootScope, $location, $log, $routeParams, Rest, Alert, HostForm, GenerateForm, Prompt, ProcessErrors,
        GetBasePath, HostsReload, ParseTypeChange, Wait, WatchInventoryWindowResize) {
    return function(params) {
        
        var parent_scope = params.scope;
        var inventory_id = parent_scope.inventory_id;
        var group_id = parent_scope.selected_group_id; 

        // Inject dynamic view
        var defaultUrl = GetBasePath('groups') + group_id + '/hosts/';
        var form = HostForm;
        var generator = GenerateForm;
        var scope = generator.inject(form, {mode: 'add', modal: true, related: false});
        
        scope.formModalActionLabel = 'Save';
        scope.formModalHeader = 'Create New Host';
        scope.formModalCancelShow = true;
        scope.parseType = 'yaml';
        ParseTypeChange(scope);
        
        if (scope.removeHostsReload) {
           scope.removeHostsReload();
        }
        scope.removeHostsReload = scope.$on('hostsReload', function() {
            HostsReload(params);
        });

        $('#form-modal .btn-none').removeClass('btn-none').addClass('btn-success');
        //$('#form-modal').unbind('hidden');
        //$('#form-modal').on('hidden', function () { scope.$emit('hostsReload'); });
        
        generator.reset();
        var master={};

        if (!scope.$$phase) {
           scope.$digest();
        }
       
        if (scope.removeHostSaveComplete) {
            scope.removeHostSaveComplete();
        }
        scope.removeHostSaveComplete = scope.$on('HostSaveComplete', function() {
            Wait('stop');
            $('#form-modal').modal('hide');
            
            HostsReload({
                scope: parent_scope,
                group_id: parent_scope.selected_group_id,
                tree_id: parent_scope.selected_tree_id,
                inventory_id: parent_scope.inventory_id });

            WatchInventoryWindowResize();
            });

        // Save
        scope.formModalAction  = function() {
           
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

               var data = {}
               for (var fld in form.fields) {
                   if (fld != 'variables') {
                      data[fld] = scope[fld];   
                   }
               }
               
               data['inventory'] = inventory_id;
               
               if ($.isEmptyObject(json_data)) {
                  data['variables'] = "";
               }
               else {
                  data['variables'] = JSON.stringify(json_data, undefined, '\t');
               }

               Rest.setUrl(defaultUrl);
               Rest.post(data)
                   .success( function(data, status, headers, config) {
                       scope.$emit('HostSaveComplete');
                       })
                   .error( function(data, status, headers, config) {
                       Wait('stop');
                       scope.formModalActionDisabled = false;
                       ProcessErrors(scope, data, status, form,
                           { hdr: 'Error!', msg: 'Failed to add new host. POST returned status: ' + status });
                       });
           }
           catch(err) {
               Wait('stop');
               scope.formModalActionDisabled = false;
               Alert("Error", "Error parsing host variables. Parser returned: " + err);  
           }
           }

        // Cancel
        scope.formReset = function() {
           // Defaults
           generator.reset();
           }; 
        
        scope.cancelModal = function() {
           WatchInventoryWindowResize();
           }
       
        }
        }])


    .factory('HostsEdit', ['$rootScope', '$location', '$log', '$routeParams', 'Rest', 'Alert', 'HostForm', 'GenerateForm', 
        'Prompt', 'ProcessErrors', 'GetBasePath', 'HostsReload', 'ParseTypeChange', 'Wait', 'Find', 'SetStatus', 'ApplyEllipsis',
        'WatchInventoryWindowResize',
    function($rootScope, $location, $log, $routeParams, Rest, Alert, HostForm, GenerateForm, Prompt, ProcessErrors,
        GetBasePath, HostsReload, ParseTypeChange, Wait, Find, SetStatus, ApplyEllipsis, WatchInventoryWindowResize) {
    return function(params) {
        
        var parent_scope = params.scope;
        var host_id = params.host_id;
        var inventory_id = params.inventory_id;
        var group_id = params.group_id;
        
        var generator = GenerateForm;
        var form = HostForm;
        var defaultUrl =  GetBasePath('hosts') + host_id + '/';
        var scope = generator.inject(form, { mode: 'edit', modal: true, related: false, show_modal: false });
        var master = {};
        var relatedSets = {};
        
        generator.reset();
        scope.formModalActionLabel = 'Save';
        scope.formModalHeader = 'Host Properties';
        scope.formModalCancelShow = true;
        scope.parseType = 'yaml';
        ParseTypeChange(scope);

        
        if (scope.hostLoadedRemove) {
            scope.hostLoadedRemove();
        }
        scope.hostLoadedRemove = scope.$on('hostLoaded', function() {
            // Retrieve host variables
            if (scope.variable_url) {
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
                       $('#form-modal').modal('show');
                       })
                   .error( function(data, status, headers, config) {
                       scope.variables = null;
                       ProcessErrors(scope, data, status, form,
                           { hdr: 'Error!', msg: 'Failed to retrieve host variables. GET returned status: ' + status });
                       });
            }
            else {
               scope.variables = "---";
               Wait('stop');
               $('#form-modal').modal('show');
            }
            master.variables = scope.variables;
            });
         
        Wait('start');

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
                scope.$emit('hostLoaded');
                })
            .error( function(data, status, headers, config) {
                ProcessErrors(scope, data, status, form,
                    { hdr: 'Error!', msg: 'Failed to retrieve host: ' + host_id + '. GET returned status: ' + status });
                });
       

        if (scope.removeSaveCompleted) {
            scope.removeSaveCompleted();
        }
        scope.removeSaveCompleted = scope.$on('saveCompleted', function() {
            // Update the name on the list
            var host = Find({ list: parent_scope.hosts, key: 'id', val: host_id });
            var old_name = host.name;
            host.name = scope.name;
            host.enabled = scope.enabled;
            host.enabled_flag = scope.enabled;
            SetStatus({ scope: parent_scope, host: host });

            // Update any titles attributes created by ApplyEllipsis
            if (old_name) {
                setTimeout(function() { 
                    $('#hosts_table .host-name a[title="' + old_name + '"').attr('title', host.name);
                    ApplyEllipsis('#hosts_table .host-name a');
                    // Close modal
                    Wait('stop');
                    $('#form-modal').modal('hide');
                    }, 2000);
            }
            else {
                // Close modal
                Wait('stop');
                $('#form-modal').modal('hide');
            }
            // Restore ellipsis response to window resize
            WatchInventoryWindowResize();
            });

        // Save changes to the parent
        scope.formModalAction = function() {
            
            Wait('start');

            try { 
                
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

                if ($.isEmptyObject(json_data)) {
                   data['variables'] = "";
                }
                else {
                   data['variables'] = JSON.stringify(json_data, undefined, '\t');
                }

                Rest.setUrl(defaultUrl);
                Rest.put(data)
                    .success( function(data, status, headers, config) {
                        scope.$emit('saveCompleted');
                        })
                    .error( function(data, status, headers, config) {
                        Wait('stop');
                        ProcessErrors(scope, data, status, form,
                            { hdr: 'Error!', msg: 'Failed to update host: ' + host_id + '. PUT returned status: ' + status });
                        });
            }
            catch(err) {
               Wait('stop');
               Alert("Error", "Error parsing host variables. Parser returned: " + err);     
            }
            };

        // Cancel
        scope.formReset = function() {
           generator.reset();
           for (var fld in master) {
               scope[fld] = master[fld];
           }
           scope.parseType = 'yaml';
           }

        scope.cancelModal = function() {
           WatchInventoryWindowResize();
           }
           
        }
        }])


    .factory('HostsDelete', ['$rootScope', '$location', '$log', '$routeParams', 'Rest', 'Alert', 'Prompt', 'ProcessErrors', 'GetBasePath',
        'HostsReload', 'Wait', 'Find',
    function($rootScope, $location, $log, $routeParams, Rest, Alert, Prompt, ProcessErrors, GetBasePath, HostsReload, Wait, Find) {
    return function(params) {
        // Remove the selected host from the current group by disassociating
       
        var scope = params.scope;
        var host_id = params.host_id;
        var host_name = params.host_name;
        
        var url = (scope.selected_group_id == null) ? GetBasePath('inventory') + scope.inventory_id + '/hosts/' : 
            GetBasePath('groups') + scope.selected_group_id + '/hosts/';
        
        var group = (scope.selected_tree_id) ? Find({ list: scope.groups, key: 'id', val: scope.selected_tree_id }) : null;
        
        if (scope.removeHostsReload) {
           scope.removeHostsReload();
        }
        scope.removeHostsReload = scope.$on('hostsReload', function() {
            scope.showHosts(scope.selected_tree_id, scope.selected_group_id, false);
            });

        var action_to_take = function() {
            $('#prompt-modal').on('hidden.bs.modal', function(){ Wait('start'); });
            $('#prompt-modal').modal('hide');
            Rest.setUrl(url);
            Rest.post({ id: host_id, disassociate: 1 })
                .success( function(data, status, headers, config) { 
                    scope.$emit('hostsReload'); 
                    })
                .error( function(data, status, headers, config) {
                    Wait('stop');
                    ProcessErrors(scope, data, status, null,
                        { hdr: 'Error!', msg: 'Attempt to delete ' + host_name + ' failed. POST returned status: ' + status });
                    });    
            }
            
        var body = (group) ? '<p>Are you sure you want to delete host <em>' + host_name + '</em> from group <em>' + group.name + '</em>?</p>' :
            '<p>Are you sure you want to delete host <em>' + host_name + '</em>?</p>';
            
        Prompt({ hdr: 'Delete Host', body: body, action: action_to_take, 'class': 'btn-danger' });

        }
        }])

/*
    .factory('HostsReload', ['$location', '$routeParams', 'SearchInit', 'PaginateInit', 'InventoryHostsForm', 'GetBasePath', 'Wait',
    'SetHostStatus',
    function($location, $routeParams, SearchInit, PaginateInit, InventoryHostsForm, GetBasePath, Wait, SetHostStatus) {
    return function(params) {
        // Rerfresh the Hosts view on right side of page
        
        var scope = params.scope;
        var group_id = scope.group_id;
        var postAction = params.action;
        
        scope['hosts'] = null;
        scope['toggleAllFlag'] = false;
        scope['hostDeleteHide'] = true;
        
        var url = (group_id !== null && group_id !== undefined) ? GetBasePath('groups') + group_id + '/all_hosts/' :
                  GetBasePath('inventory') + params.inventory_id + '/hosts/';

        // Set the groups value in each element of hosts array
        if (scope.removePostRefresh) {
           scope.removePostRefresh();
        }
        scope.removePostRefresh = scope.$on('PostRefresh', function() {

            // Add a list of groups to each host
            var groups, descr, found, list;
            for (var i=0; i < scope.hosts.length; i++) {
                groups = scope.hosts[i].summary_fields.groups;
                scope.hosts[i].groups = '';
                for (var k=0; k < groups.length; k++) {
                    if (!groups[k].name.match(/^_deleted/)) {
                       scope.hosts[i].groups += groups[k].name + ', '
                    }
                }
                scope.hosts[i].groups = scope.hosts[i].groups.replace(/\, $/,'');
            }
          
            for (var i=0; i < scope.hosts.length; i++) {
                SetHostStatus(scope.hosts[i]);
            }

            if (group_id == null || group_id == undefined) {
               if (!scope.hosts.length) {
                  scope.$emit('ShowHelp');
               }
            }
         
            if (postAction) {
               postAction();
            }

            });
        
        SearchInit({ scope: scope, set: 'hosts', list: InventoryHostsForm, url: url });
        PaginateInit({ scope: scope, list: InventoryHostsForm, url: url });
        
        if ($routeParams['has_active_failures']) {
           //scope.resetSearch(InventoryHostsForm.iterator);
           scope[InventoryHostsForm.iterator + 'InputDisable'] = true;
           scope[InventoryHostsForm.iterator + 'SearchValue'] = $routeParams['has_active_failures'];
           scope[InventoryHostsForm.iterator + 'SearchField'] = 'has_active_failures';
           scope[InventoryHostsForm.iterator + 'SearchFieldLabel'] = InventoryHostsForm.fields['has_active_failures'].label;
           scope[InventoryHostsForm.iterator + 'SearchSelectValue'] = ($routeParams['has_active_failures'] == 'true') ? { value: 1 } : { value: 0 };
           
        }
        else if ($routeParams['name']) {
           scope[InventoryHostsForm.iterator + 'InputDisable'] = false;
           scope[InventoryHostsForm.iterator + 'SearchValue'] = $routeParams['name'];
           scope[InventoryHostsForm.iterator + 'SearchField'] = 'name';
           scope[InventoryHostsForm.iterator + 'SearchFieldLabel'] = InventoryHostsForm.fields['name'].label;
           scope[InventoryHostsForm.iterator + 'SearchSelectValue'] = null;
        }

        scope.search(InventoryHostsForm.iterator);
        
        if (!params.scope.$$phase) {
           params.scope.$digest();
        }
        }
        }])

*/

    .factory('EditHostGroups', ['$rootScope', '$location', '$log', '$routeParams', 'Rest', 'Alert', 'GenerateForm', 
        'Prompt', 'ProcessErrors', 'GetBasePath', 'HostsReload', 'ParseTypeChange', 'Wait',
    function($rootScope, $location, $log, $routeParams, Rest, Alert, GenerateForm, Prompt, ProcessErrors,
        GetBasePath, HostsReload, ParseTypeChange, Wait) {
    return function(params) {
        
        var host_id = params.host_id;
        var inventory_id = params.inventory_id;
        var generator = GenerateForm;
        var actions = [];
        
        //var html="<div class=\"host-groups-title\"><h4>{{ host.name }}</h4></div>\n";
        var html = "<div class=\"row host-groups\">\n";
        html += "<div class=\"col-lg-6\">\n";
        html += "<label>Available Groups:</label>\n";
        html += "<select multiple class=\"form-control\" name=\"available-groups\" ng-model=\"selectedGroups\" ng-change=\"leftChange()\" " +
            "ng-options=\"avail_group.name for avail_group in available_groups\"></select>\n";
        html += "</div>\n";
        html += "<div class=\"col-lg-6\">\n";
        html += "<label>Belongs to Groups:</label>\n";
        html += "<select multiple class=\"form-control\" name=\"selected-groups\" ng-model=\"assignedGroups\" ng-change=\"rightChange()\" " +
            "ng-options=\"host_group.name for host_group in host_groups\"></select>\n";
        html += "</div>\n";
        html += "</div>\n";
        html += "<div class=\"row host-group-buttons\">\n";
        html += "<div class=\"col-lg-12\">\n";
        html += "<button type=\"button\" ng-click=\"moveLeft()\" class=\"btn btn-sm btn-primary left-button\" ng-disabled=\"leftButtonDisabled\">" +
            "<i class=\"icon-arrow-left\"></i></button>\n";
        html += "<button type=\"button\" ng-click=\"moveRight()\" class=\"btn btn-sm btn-primary right-button\" ng-disabled=\"rightButtonDisabled\">" +
            "<i class=\"icon-arrow-right\"></i></button>\n";
        html += "<p>(move selected groups)</p>\n";
        html += "</div>\n";
        html += "</div>\n";

        var defaultUrl =  GetBasePath('hosts') + host_id + '/';
        var scope = generator.inject(null, { mode: 'edit', modal: true, related: false, html: html });
        
        for (var i=0; i < scope.hosts.length; i++) {
           if (scope.hosts[i].id == host_id) {
               scope.host = scope.hosts[i];
           }  
        }

        scope.selectedGroups = null;
        scope.assignedGroups = null;
        scope.leftButtonDisabled = true;
        scope.rightButtonDisabled = true; 

        scope.formModalActionLabel = 'Save';
        //scope.formModalHeader = 'Host Groups';
        scope.formModalHeader = scope.host.name + ' - <span class=\"subtitle\">Groups</span>';
        scope.formModalCancelShow = true;
        scope.formModalActionDisabled = true;

        $('#form-modal .btn-none').removeClass('btn-none').addClass('btn-success');

        if (scope.hostGroupChangeRemove) {
           scope.hostGroupChangeRemove();
        }
        scope.hostGroupChangeRemove = scope.$on('hostGroupChange', function(e) {
            actions.pop();
            if (actions.length == 0) {
               var postAction = function() { 
                   setTimeout(function() { Wait('stop') }, 500); 
                   };
               HostsReload({ scope: scope, inventory_id: inventory_id, group_id: scope.group_id , action: postAction });
            }
            }); 
        
        // Save changes
        scope.formModalAction = function() {
            var found;
          
            $('#form-modal').modal('hide');
            Wait('start');

            // removed host from deleted groups
            for (var i=0; i < scope.original_groups.length; i++) {
                found = false;
                for (var j=0; j < scope.host_groups.length; j++) {
                    if (scope.original_groups[i].id == scope.host_groups[j].id) {
                       found = true;
                    }
                }
                if (!found) {
                   // group was removed 
                   actions.push({ group_id: scope.original_groups[i].id , action: 'delete' });
                   Rest.setUrl(GetBasePath('groups') + scope.original_groups[i].id + '/hosts/');
                   Rest.post({ id: host_id, disassociate: 1 })
                       .success( function(data, status, headers, config) {
                           scope.$emit('hostGroupChange');
                           })
                       .error( function(data, status, headers, config) {
                           scope.$emit('hostGroupChange');
                           ProcessErrors(scope, data, status, null,
                               { hdr: 'Error!', msg: 'Attempt to remove host from group ' + scope.original_groups[i].name +
                               ' failed. POST returned status: ' + status });
                           });
                }
            }

            // add host to new groups
            for (var i=0; i < scope.host_groups.length; i++) {
                found = false; 
                for (var j=0; j < scope.original_groups.length; j++) {
                    if (scope.original_groups[j].id == scope.host_groups[i].id) {
                       found = true;
                    } 
                } 
                if (!found) {
                   // group was added
                   actions.push({ group_id: scope.host_groups[i].id , action: 'add' });
                   Rest.setUrl(GetBasePath('groups') + scope.host_groups[i].id + '/hosts/');
                   Rest.post(scope.host)
                       .success( function(data, status, headers, config) {
                           scope.$emit('hostGroupChange');
                           })
                       .error( function(data, status, headers, config) {
                           scope.$emit('hostGroupChange');
                           ProcessErrors(scope, data, status, null,
                               { hdr: 'Error!', msg: 'Attempt to add host to group ' + scope.host_groups[i].name +
                               ' failed. POST returned status: ' + status });
                           });
                }
            }
            }

        scope.leftChange = function() {
            // Select/deselect on available groups list
            if (scope.selectedGroups !== null && scope.selectedGroups.length > 0) {
               scope.assignedGroups = null;
               scope.leftButtonDisabled = true;
               scope.rightButtonDisabled = false;
            }
            else {
               scope.rightButtonDisabled = true;
            }
            }
 
        scope.rightChange = function() {
            // Select/deselect made on host groups list
            if (scope.assignedGroups !== null && scope.assignedGroups.length > 0) {
               scope.selectedGroups = null;
               scope.leftButtonDisabled = false;
               scope.rightButtonDisabled = true;
            }
            else {
               scope.leftButtonDisabled = true;
            }
            }

        scope.moveLeft = function() {
            // Remove selected groups from the list of assigned groups
            for (var i=0; i < scope.assignedGroups.length; i++){
               for (var j=0 ; j < scope.host_groups.length; j++) {
                   if (scope.host_groups[j].id == scope.assignedGroups[i].id) {
                      scope.host_groups.splice(j,1);
                      break;
                   }
               }  
            }
            var found, placed;
            for (var i=0; i < scope.assignedGroups.length; i++){
               found = false;
               for (var j=0; j < scope.available_groups.length && !found; j++){
                   if (scope.available_groups[j].id == scope.assignedGroups[i].id) {
                      found=true;
                   }
               }
               if (!found) {
                  placed = false; 
                  for (var j=0; j < scope.available_groups.length && !placed; j++){
                      if (j == 0 && scope.assignedGroups[i].name.toLowerCase() < scope.available_groups[j].name.toLowerCase()) {
                         // prepend to the beginning of the array
                         placed=true;
                         scope.available_groups.unshift(scope.assignedGroups[i]);
                      }
                      else if (j + 1 < scope.available_groups.length) {
                         if (scope.assignedGroups[i].name.toLowerCase() > scope.available_groups[j].name.toLowerCase() && 
                             scope.assignedGroups[i].name.toLowerCase() < scope.available_groups[j + 1].name.toLowerCase() ) {
                             // insert into the middle of the array
                             placed = true;
                             scope.available_groups.splice(j + 1, 0, scope.assignedGroups[i]);
                         }
                      }
                  }
                  if (!placed) {
                     // append to the end of the array
                     scope.available_groups.push(scope.assignedGroups[i]);
                  }
               }
            }
            scope.assignedGroups = null;
            scope.leftButtonDisabled = true; 
            scope.rightButtonDisabled = true;
            scope.formModalActionDisabled = false;
            }

        scope.moveRight = function() {
             // Remove selected groups from list of available groups
            for (var i=0; i < scope.selectedGroups.length; i++){
               for (var j=0 ; j < scope.available_groups.length; j++) {
                   if (scope.available_groups[j].id == scope.selectedGroups[i].id) {
                      scope.available_groups.splice(j,1);
                      break; 
                   }
               }
            }
            var found, placed;
            for (var i=0; i < scope.selectedGroups.length; i++){
               found = false;
               for (var j=0; j < scope.host_groups.length && !found; j++){
                   if (scope.host_groups[j].id == scope.selectedGroups[i].id) {
                      found=true;
                   }
               }
               if (!found) {
                  placed = false; 
                  for (var j=0; j < scope.host_groups.length && !placed; j++){
                      if (j == 0 && scope.selectedGroups[i].name.toLowerCase() < scope.host_groups[j].name.toLowerCase()) {
                         // prepend to the beginning of the array
                         placed=true;
                         scope.host_groups.unshift(scope.selectedGroups[i]);
                      }
                      else if (j + 1 < scope.host_groups.length) {
                         if (scope.selectedGroups[i].name.toLowerCase() > scope.host_groups[j].name.toLowerCase() && 
                             scope.selectedGroups[i].name.toLowerCase() < scope.host_groups[j + 1].name.toLowerCase() ) {
                             // insert into the middle of the array
                             placed = true;
                             scope.host_groups.splice(j + 1, 0, scope.selectedGroups[i]);
                         }
                      }
                  }
                  if (!placed) {
                     // append to the end of the array
                     scope.host_groups.push(scope.selectedGroups[i]);
                  }
               }
            }
            scope.selectedGroups = null;
            scope.leftButtonDisabled = true; 
            scope.rightButtonDisabled = true;
            scope.formModalActionDisabled = false;
            }


        // Load the host's current list of groups
        scope.host_groups = [];
        scope.original_groups = [];
        scope.available_groups = [];
        Rest.setUrl(scope.host.related.groups + '?order_by=name');
        Rest.get()
            .success( function(data, status, headers, config) {
                for (var i=0; i < data.results.length; i++) {
                    scope.host_groups.push({ 
                        id: data.results[i].id, 
                        name: data.results[i].name,
                        description: data.results[i].description
                        });
                    scope.original_groups.push({ 
                        id: data.results[i].id, 
                        name: data.results[i].name,
                        description: data.results[i].description
                        });
                }
                var found; 
                for (var i=0; i < scope.inventory_groups.length; i++) {
                    found =  false;
                    for (var j=0; j < scope.host_groups.length; j++) {
                        if (scope.inventory_groups[i].id == scope.host_groups[j].id) {
                           found = true; 
                        }  
                    }
                    if (!found) {
                       scope.available_groups.push(scope.inventory_groups[i]);
                    }
                }
                })
            .error( function(data, status, headers, config) {
                ProcessErrors(scope, data, status, null,
                     { hdr: 'Error!', msg: 'Failed to get current groups for host: ' + host_id + '. GET returned: ' + status });
                });

        if (scope.removeHostsReload) {
           scope.removeHostsReload();
        }
        scope.removeHostsReload = scope.$on('hostsReload', function() {
            HostsReload(params);
        });
       
        if (!scope.$$phase) {
           scope.$digest();
        }
        
           
        }
        }]);

     




