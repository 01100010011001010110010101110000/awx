/*********************************************
 *  Copyright (c) 2013 AnsibleWorks, Inc.
 *
 *  GroupsHelper
 *
 *  Routines that handle group add/edit/delete on the Inventory tree widget.
 *  
 */
 
angular.module('GroupsHelper', [ 'RestServices', 'Utilities', 'ListGenerator', 'GroupListDefinition',
                                 'SearchHelper', 'PaginateHelper', 'ListGenerator', 'AuthService', 'GroupsHelper',
                                 'InventoryHelper', 'SelectionHelper', 'JobSubmissionHelper', 'RefreshHelper'
                                 ])

    .factory('getSourceTypeOptions', [ function() {
        return function() {
            return [
                { label: 'Manual', value: null },
                { label: 'Amazon EC2', value: 'ec2' },
                { label: 'Rackspace', value: 'rackspace' },
                { label: 'Local script', value: 'file' }
                ];
        }
        }])

    .factory('GroupsList', ['$rootScope', '$location', '$log', '$routeParams', 'Rest', 'Alert', 'GroupList', 'GenerateList', 
        'Prompt', 'SearchInit', 'PaginateInit', 'ProcessErrors', 'GetBasePath', 'GroupsAdd', 'RefreshTree', 'SelectionInit',
    function($rootScope, $location, $log, $routeParams, Rest, Alert, GroupList, GenerateList, Prompt, SearchInit, PaginateInit,
        ProcessErrors, GetBasePath, GroupsAdd, RefreshTree, SelectionInit) {
    return function(params) {
        
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

        var url = (group_id) ? GetBasePath('groups') + group_id + '/children/' :
            GetBasePath('inventory') + inventory_id + '/groups/'; 
        
        SelectionInit({ scope: scope, list: list, url: url });
        
        scope.formModalAction = function() {
            var groups = [];
            for (var j=0; j < scope.selected.length; j++) {
                if (scope.inventoryRootGroups.indexOf(scope.selected[j].id) > -1) {
                   groups.push(scope.selected[j].name);
                }
            }

            if (groups.length > 0) {
               var action = function() {
                   $('#prompt-modal').modal('hide');
                       finish();
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
            }

        var finish = scope.formModalAction; 
        
        if (scope.PostRefreshRemove) {
           scope.PostRefreshRemove();
        }
        scope.PostRefreshRemove = scope.$on('PostRefresh', function() {
            for (var i=0; i < scope.groups.length; i++) {
                if (scope.groups[i].id == group_id) {
                   scope.groups.splice(i,1);
                }
            }
            });

        SearchInit({ scope: scope, set: 'groups', list: list, url: defaultUrl });
        PaginateInit({ scope: scope, list: list, url: defaultUrl, mode: 'lookup' });
        scope.search(list.iterator);

        if (!scope.$$phase) {
           scope.$digest();
        }

        if (scope.removeModalClosed) {
           scope.removeModalClosed();
        }
        scope.removeModalClosed = scope.$on('modalClosed', function() {
            RefreshTree({ scope: scope });
            });
        }
        }])


    .factory('InventoryStatus', [ '$rootScope', 'Rest', 'Alert', 'ProcessErrors', 'GetBasePath', 'FormatDate', 'InventorySummary',
        'GenerateList', 'ClearScope', 'SearchInit', 'PaginateInit', 'Refresh', 'InventoryUpdate',
    function($rootScope, Rest, Alert, ProcessErrors, GetBasePath, FormatDate, InventorySummary, GenerateList, ClearScope, SearchInit, 
        PaginateInit, Refresh, InventoryUpdate) {
    return function(params) {
        //Build a summary of a given inventory
        
        ClearScope('tree-form');
        
        $('#tree-form').hide().empty();
        var view = GenerateList;
        var list = InventorySummary;
        var scope = view.inject(InventorySummary, { mode: 'summary', id: 'tree-form', breadCrumbs: false });
        var defaultUrl = GetBasePath('inventory') + scope['inventory_id'] + '/inventory_sources/';
        
        if (scope.PostRefreshRemove) {
           scope.PostRefreshRemove();
        }
        scope.PostRefreshRemove = scope.$on('PostRefresh', function() {
            for (var i=0; i < scope.groups.length; i++) {
                var last_update = (scope.groups[i].last_updated == null) ? '' : FormatDate(new Date(scope.groups[i].last_updated));    
                var source = 'Manual';
                var stat;
                var stat_class;

                switch (scope.groups[i].status) {
                    case 'never updated':
                        stat = 'never';
                        stat_class = 'never';
                        break;
                    case 'none':
                        stat = 'n/a';
                        stat_class = 'na';
                        break;
                    default: 
                        stat = scope.groups[i].status;
                        stat_class = stat;
                    }

                switch (scope.groups[i].source) {
                    case 'file':
                        source = 'File';
                        break;
                    case 'ec2':
                        source = 'Amazon EC2';
                        break;
                    case 'rackspace': 
                        source = 'Rackspace';
                        break;   
                    }
                scope.groups[i].status = stat;
                scope.groups[i].source = source;
                scope.groups[i].last_updated = last_update;
                scope.groups[i].status_class = stat_class;
            }
            });

        SearchInit({ scope: scope, set: 'groups', list: list, url: defaultUrl });
        PaginateInit({ scope: scope, list: list, url: defaultUrl });
        scope.search(list.iterator);

        scope.refresh = function() {
            scope['groupSearchSpin'] = true;
            scope['groupLoading'] = true;
            Refresh({ scope: scope, set: 'groups', iterator: 'group', url: scope['current_url'] });
            }

        // Start the update process
        scope.updateGroup = function(id) {
            for (var i=0; i < scope.groups.length; i++) {
                if (scope.groups[i].id == id) {
                   if (scope.groups[i].source == "" || scope.groups[i].source == null) {
                      Alert('Missing Configuration', 'The selected group is not configured for updates. You must first edit the group, provide Source settings, ' + 
                          'and then run an update.', 'alert-info');
                   }
                   else if (scope.groups[i].status == 'updating') {
                      Alert('Update in Progress', 'The inventory update process is currently running for group <em>' +
                          scope.groups[i].summary_fields.group.name + '</em>. Use the Refresh button to monitor the status.', 'alert-info'); 
                   }
                   else {
                      if (scope.groups[i].source == 'Amazon EC2') {
                         scope.sourceUsernameLabel = 'Access Key ID';
                         scope.sourcePasswordLabel = 'Secret Access Key';
                         scope.sourcePasswordConfirmLabel = 'Confirm Secret Access Key';
                      }
                      else {
                         scope.sourceUsernameLabel = 'Username';
                         scope.sourcePasswordLabel = 'Password'; 
                         scope.sourcePasswordConfirmLabel = 'Confirm Password';
                      }
                      InventoryUpdate({
                          scope: scope, 
                          group_id: id,
                          url: scope.groups[i].related.update,
                          group_name: scope.groups[i].summary_fields.group.name, 
                          group_source: scope.groups[i].source
                          });
                   }
                   break;
                }
            }
            }
    } 
    }])


    .factory('GroupsAdd', ['$rootScope', '$location', '$log', '$routeParams', 'Rest', 'Alert', 'GroupForm', 'GenerateForm', 
        'Prompt', 'ProcessErrors', 'GetBasePath', 'RefreshTree', 'ParseTypeChange', 'GroupsEdit',
    function($rootScope, $location, $log, $routeParams, Rest, Alert, GroupForm, GenerateForm, Prompt, ProcessErrors,
        GetBasePath, RefreshTree, ParseTypeChange, GroupsEdit) {
    return function(params) {

        var inventory_id = params.inventory_id;
        var group_id = (params.group_id !== undefined) ? params.group_id : null;

        // Inject dynamic view
        var defaultUrl = (group_id !== null) ? GetBasePath('groups') + group_id + '/children/' : 
            GetBasePath('inventory') + inventory_id + '/groups/';
        var form = GroupForm;
        var generator = GenerateForm;
        var scope = generator.inject(form, {mode: 'add', modal: true, related: false});
        
        scope.formModalActionLabel = 'Save';
        scope.formModalHeader = 'Create New Group';
        scope.formModalCancelShow = true;
        scope.parseType = 'yaml';
        scope.source = { label: 'Manual', value: null };
        ParseTypeChange(scope);

        $('#form-modal .btn-none').removeClass('btn-none').addClass('btn-success');
        $('#form-modal').off('hide.bs.modal').on('hide.bs.modal', function() {
            //GroupsEdit({ "inventory_id": scope['inventory_id'], group_id: scope['group_id'] });
            scope.$emit('NodeSelect', scope['nodeSelectValue']);
            });

        generator.reset();
        var master={};

        if (!scope.$$phase) {
           scope.$digest();
        }

        // Save
        scope.formModalAction  = function() {
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

               if (inventory_id) {
                  data['inventory'] = inventory_id;
               }

               Rest.setUrl(defaultUrl);
               Rest.post(data)
                   .success( function(data, status, headers, config) {
                       var id = data.id;
                       scope.showGroupHelp = false;  // get rid of the Hint
                       if (scope.variables) {
                          Rest.setUrl(data.related.variable_data);
                          Rest.put(json_data)
                              .success( function(data, status, headers, config) {
                                  $('#form-modal').modal('hide');
                                  RefreshTree({ scope: scope, group_id: id });
                              })
                              .error( function(data, status, headers, config) {
                                  ProcessErrors(scope, data, status, form,
                                     { hdr: 'Error!', msg: 'Failed to add group varaibles. PUT returned status: ' + status });
                              });
                       }
                       else {
                          $('#form-modal').modal('hide');
                          RefreshTree({ scope: scope, group_id: id });
                       }
                       })
                   .error( function(data, status, headers, config) {
                       scope.formModalActionDisabled = false;
                       ProcessErrors(scope, data, status, form,
                           { hdr: 'Error!', msg: 'Failed to add new group. POST returned status: ' + status });
                       });
           }
           catch(err) {
               scope.formModalActionDisabled = false;
               Alert("Error", "Error parsing group variables. Parser returned: " + err);     
           }
           }

        // Cancel
        scope.formReset = function() {
           // Defaults
           generator.reset();
           }; 

        }
        }])

    .factory('GroupsEdit', ['$rootScope', '$location', '$log', '$routeParams', 'Rest', 'Alert', 'GroupForm', 'GenerateForm', 
        'Prompt', 'ProcessErrors', 'GetBasePath', 'RefreshGroupName', 'ParseTypeChange', 'getSourceTypeOptions', 'InventoryUpdate',
    function($rootScope, $location, $log, $routeParams, Rest, Alert, GroupForm, GenerateForm, Prompt, ProcessErrors,
        GetBasePath, RefreshGroupName, ParseTypeChange, getSourceTypeOptions, InventoryUpdate) {
    return function(params) {
        
        var group_id = params.group_id;
        var inventory_id = params.inventory_id;
        var generator = GenerateForm;
        var form = GroupForm;
        var defaultUrl =  GetBasePath('groups') + group_id + '/';
        
        $('#tree-form').hide().empty();
        
        var scope = generator.inject(form, { mode: 'edit', modal: false, related: false, id: 'tree-form', breadCrumbs: false });
        generator.reset();
        var master = {};
        var relatedSets = {};

        scope.source_type_options = getSourceTypeOptions();
        scope.parseType = 'yaml';
        scope[form.fields['source_env'].parseTypeName] = 'yaml';
        scope.sourcePasswordRequired = false;
        scope.sourceUsernameRequired = false;
        scope.sourceUsernameLabel = 'Username';
        scope.sourcePasswordLabel = 'Password';
        scope.sourcePasswordConfirmLabel = 'Confirm Password';
        scope.sourcePathRequired = false;
        
        ParseTypeChange(scope);
        ParseTypeChange(scope, 'source_env', form.fields['source_env'].parseTypeName);

        //$('#form-modal .btn-none').removeClass('btn-none').addClass('btn-success');
        
        
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
                       })
                   .error( function(data, status, headers, config) {
                       scope.variables = null;
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
                              if (data['source'] == '') { 
                                 data['source'] = null; 
                              }
                              for (var i=0; i < scope.source_type_options.length; i++) {
                                  if (scope.source_type_options[i].value == data['source']) {
                                     scope['source'] = scope.source_type_options[i];
                                     found = true;
                                  }  
                              }
                              if (!found || scope['source'].value == null) {
                                 scope['groupUpdateHide'] = true;
                              }
                              else {
                                 scope['groupUpdateHide'] = false;
                              }
                              master['source'] = scope['source'];
                           }
                           else if (fld == 'source_env') {
                              // Parse source_env, converting to YAML.  
                              if ($.isEmptyObject(data.source_env) || data.source_env == "\{\}" || 
                                  data.source_env == "null" || data.source_env == "") {
                                 scope.source_env = "---";
                              }
                              else {
                                 var json_obj = JSON.parse(data.extra_vars);
                                 scope.source_env = jsyaml.safeDump(json_obj);
                              }
                              master.source_env = scope.variables;
                           }
                           else if (data[fld]) {
                              scope[fld] = data[fld];
                              master[fld] = scope[fld];
                           }
                       }
                       scope['group_update_url'] = data.related['update'];           
                       })
                   .error( function(data, status, headers, config) {
                       scope.source = null;
                       ProcessErrors(scope, data, status, form,
                           { hdr: 'Error!', msg: 'Failed to retrieve inventory source. GET status: ' + status });
                       });
            }
            });

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
                    { hdr: 'Error!', msg: 'Failed to retrieve group: ' + id + '. GET status: ' + status });
                });
       
        if (!scope.$$phase) {
           scope.$digest();
        }

        if (scope.removeFormSaveSuccess) {
           scope.removeFormSaveSuccess();
        }
        scope.removeFormSaveSuccess = scope.$on('formSaveSuccess', function(e, group_id) {
            
            var parseError = false;
            var saveError = false;

            if (scope.source.value !== null && scope.source.value !== '') {
               var data = { group: group_id, 
                   source: scope['source'].value,
                   source_path: scope['source_path'],
                   source_username: scope['source_username'],
                   source_password: scope['source_password'],
                   source_regions: scope['source_regions'],
                   source_tags: scope['source_tags'],
                   overwrite_hosts: scope['overwite_hosts'],
                   overwrite_vars: scope['overwite_vars'],
                   keep_vars: scope['keep_vars'],
                   update_on_launch: scope['update_on_launch']
                   };

               if (scope['source'].value == 'file') {
                  try {
                       // Make sure we have valid variable data
                       if (scope.envParseType == 'json') {
                          var json_data = JSON.parse(scope.source_env);  //make sure JSON parses
                       }
                       else {
                          var json_data = jsyaml.load(scope.source_env);  //parse yaml
                       }
                      
                       // Make sure our JSON is actually an object
                       if (typeof json_data !== 'object') {
                          throw "failed to return an object!";
                       }
                       data.source_env = JSON.stringify(json_data, undefined, '\t');
                  }
                  catch(err) {
                       parseError = true;
                       Alert("Error", "Error parsing extra variables. Parser returned: " + err);     
                  }
               }

               if (!parseError) {           
                  Rest.setUrl(scope.source_url)
                  Rest.put(data)
                      .error( function(data, status, headers, config) {
                          saveError = true;
                          ProcessErrors(scope, data, status, form,
                              { hdr: 'Error!', msg: 'Failed to update group inventory source. PUT status: ' + status });
                          });
               }
            }

            if (!saveError && !parseError) {
               // Reset the form, adjust buttons and let user know changese saved
               scope[form.name + '_form'].$setPristine();
               scope['groupUpdateHide'] = (scope['source'].value !== null && scope['source'].value !== '') ? false : true;
               Alert("Changes Saved", "Your changes to inventory group " + scope['name'] + " were successfully saved.", 'alert-info'); 
            }

            });

        // Save changes to the parent
        scope.formSave = function() {
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
                                       { hdr: 'Error!', msg: 'Failed to update group varaibles. PUT status: ' + status });
                                   });
                        }
                        RefreshGroupName(scope['selectedNode'], data.name, data.description);
                        scope.$emit('formSaveSuccess', data.id);
                        })
                    .error( function(data, status, headers, config) {
                        ProcessErrors(scope, data, status, form,
                            { hdr: 'Error!', msg: 'Failed to update group: ' + group_id + '. PUT status: ' + status });
                        });
            }
            catch(err) {
               Alert("Error", "Error parsing group variables. Parser returned: " + err);     
            }
            };

        scope.sourceChange = function() {
            if (scope['source'].value == 'ec2' || scope['source'].value == 'rackspace') {
               scope.sourcePasswordRequired = true;
               scope.sourceUsernameRequired = true;
               if (scope['source'].value == 'ec2') {
                  scope.sourceUsernameLabel = 'Access Key ID';
                  scope.sourcePasswordLabel = 'Secret Access Key';
                  scope.sourcePasswordConfirmLabel = 'Confirm Secret Access Key';
               }
               else {
                  scope.sourceUsernameLabel = 'Username';
                  scope.sourcePasswordLabel = 'Password'; 
                  scope.sourcePasswordConfirmLabel = 'Confirm Password';
               }
            }
            else {
               scope.sourcePasswordRequired = false;
               scope.sourceUsernameRequired = false;
               // reset fields
               scope.source_password = ''; 
               scope.source_password_confirm = '';
               scope.source_username = ''; 
               scope[form.name + '_form']['source_username'].$setValidity('required',true);
            }
            
            if (scope['source'].value == 'file') {
               scope.sourcePathRequired = true;
            }
            else {
               scope.sourcePathRequired = false;
               // reset fields
               scope.source_path = '';
               scope[form.name + '_form']['source_path'].$setValidity('required',true);
            }
            }

        // Password change
        scope.clearPWConfirm = function(fld) {
            // If password value changes, make sure password_confirm must be re-entered
            scope[fld] = '';
            scope[form.name + '_form'][fld].$setValidity('awpassmatch', false);
            }

        // Respond to 'Ask at runtime?' checkbox
        scope.ask = function(fld, associated) {
            if (scope[fld + '_ask']) {
               scope[fld] = 'ASK';
               scope[associated] = '';
               scope[form.name + '_form'][associated].$setValidity('awpassmatch', true);
            }
            else {
               scope[fld] = '';
               scope[associated] = '';
               scope[form.name + '_form'][associated].$setValidity('awpassmatch', true);
            }
            }

        // Click clear button
        scope.clear = function(fld, associated) {
            scope[fld] = '';
            scope[associated] = '';
            scope[form.name + '_form'][associated].$setValidity('awpassmatch', true);
            scope[form.name + '_form'].$setDirty();
            }
        
        // Start the update process
        scope.updateGroup = function() {
            if (scope['source'] == null || scope['source'] == '') {
               Alert('Missing Configuration', 'The selected group is not configured for updates. You must first edit the group, provide Source settings, ' + 
                  'and then run an update.', 'alert-info');
            }
            else {
               InventoryUpdate({
                   scope: scope, 
                   group_id: group_id,
                   url: scope['group_update_url']
                   });
            }
            }

        // Cancel
        scope.formReset = function() {
            generator.reset();
            for (var fld in master) {
                scope[fld] = master[fld];
            }
            scope.parseType = 'yaml';
            }
        }
        }])


    .factory('GroupsDelete', ['$rootScope', '$location', '$log', '$routeParams', 'Rest', 'Alert', 'GroupForm', 'GenerateForm', 
        'Prompt', 'ProcessErrors', 'GetBasePath', 'RefreshTree', 'Wait',
    function($rootScope, $location, $log, $routeParams, Rest, Alert, GroupForm, GenerateForm, Prompt, ProcessErrors,
        GetBasePath, RefreshTree, Wait) {
    return function(params) {
        // Delete the selected group node. Disassociates it from its parent.
        var scope = params.scope;
        var group_id = params.group_id; 
        var inventory_id = params.inventory_id;
        var obj = $('#tree-view li[group_id="' + group_id + '"]');
        var parent = (obj.parent().last().prop('tagName') == 'LI') ? obj.parent().last() : obj.parent().parent().last();
        var url; 
        
        if (parent.attr('type') == 'group') {
           url = GetBasePath('base') + 'groups/' + parent.attr('group_id') + '/children/';
        }
        else {
           url = GetBasePath('inventory') + inventory_id + '/groups/';
        }
        var action_to_take = function() {
            $('#prompt-modal').modal('hide');
            Wait('start');
            Rest.setUrl(url);
            Rest.post({ id: group_id, disassociate: 1 })
               .success( function(data, status, headers, config) {
                   scope.selectedNode = scope.selectedNode.parent().parent();
                   RefreshTree({ scope: scope });
                   })
               .error( function(data, status, headers, config) {
                   //$('#prompt-modal').modal('hide');
                   RefreshTree({ scope: scope });
                   ProcessErrors(scope, data, status, null,
                       { hdr: 'Error!', msg: 'Call to ' + url + ' failed. DELETE returned status: ' + status });
                   });      
            };
        //Force binds to work. Not working usual way.
        $('#prompt-header').text('Delete Group');
        $('#prompt-body').html('<p>Are you sure you want to permanently delete group <em>' + $(obj).attr('name') + '</em>?</p>');
        $('#prompt-action-btn').addClass('btn-danger');
        scope.promptAction = action_to_take;  // for some reason this binds?
        $('#prompt-modal').modal({
            backdrop: 'static',
            keyboard: true,
            show: true
            });
        }
        }]);



