/*********************************************
 *  Copyright (c) 2013 AnsibleWorks, Inc.
 *
 *  InventoryHelper
 *  Routines for building the tree. Everything related to the tree is here except
 *  for the menu piece. The routine for building the menu is in InventoriesEdit controller
 *  (controllers/Inventories.js)
 *  
 */
 
angular.module('GroupsHelper', [ 'RestServices', 'Utilities', 'ListGenerator', 'GroupListDefinition',
                                 'SearchHelper', 'PaginateHelper', 'ListGenerator', 'AuthService', 'GroupsHelper',
                                 'InventoryHelper'
                                 ]) 

    .factory('GroupsList', ['$rootScope', '$location', '$log', '$routeParams', 'Rest', 'Alert', 'GroupList', 'GenerateList', 
        'Prompt', 'SearchInit', 'PaginateInit', 'ProcessErrors', 'GetBasePath', 'GroupsAdd', 'RefreshTree',
    function($rootScope, $location, $log, $routeParams, Rest, Alert, GroupList, GenerateList, LoadBreadCrumbs, SearchInit,
             PaginateInit, ProcessErrors, GetBasePath, GroupsAdd, RefreshTree) {
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

        scope.formModalActionLabel = 'Finished'
        scope.formModalHeader = 'Add Group'
        
        $('#form-modal').modal();

        scope.selected = [];
        
        if (scope.PostRefreshRemove) {
           scope.PostRefreshRemove();
        }
        scope.PostRefreshRemove = scope.$on('PostRefresh', function() {
            $("tr.success").each(function(index) {
                var ngc = $(this).attr('ng-class'); 
                scope[ngc] = ""; 
                });
            if ($routeParams.group_id) {
               // Remove the current group from the list of available groups, thus
               // preventing a group from being added to itself
               for (var i=0; i < scope.groups.length; i++) {
                   if (scope.groups[i].id == $routeParams.group_id) {
                      scope.groups.splice(i,1);
                   }
               }
            }
            //scope.$digest();
            });

        SearchInit({ scope: scope, set: 'groups', list: list, url: defaultUrl });
        PaginateInit({ scope: scope, list: list, url: defaultUrl });
        scope.search(list.iterator);

        /*LoadBreadCrumbs();*/

        scope.editGroup = function(id) {
           $location.path($location.path() + '/' + id);
           }
     
        scope.deleteGroup = function(id, name) {
           
           var action = function() {
               var url = defaultUrl;
               Rest.setUrl(url);
               Rest.post({ id: id, disassociate: 1 })
                   .success( function(data, status, headers, config) {
                       $('#prompt-modal').modal('hide');
                       scope.search(list.iterator);
                       })
                   .error( function(data, status, headers, config) {
                       $('#prompt-modal').modal('hide');
                       ProcessErrors(scope, data, status, null,
                                { hdr: 'Error!', msg: 'Call to ' + url + ' failed. DELETE returned status: ' + status });
                       });      
               };

           Prompt({ hdr: 'Delete', 
                    body: 'Are you sure you want to remove group' + name + '?',
                    action: action
                    });
           }

        scope.formModalAction = function() {
           var url = (group_id) ? GetBasePath('groups') + group_id + '/children/' :
               GetBasePath('inventory') + inventory_id + '/groups/'; 
           Rest.setUrl(url);
           scope.queue = [];

           if (scope.callFinishedRemove) {
              scope.callFinishedRemove();
           }
           scope.callFinishedRemove = scope.$on('callFinished', function() {
              // We call the API for each selected item. We need to hang out until all the api
              // calls are finished.
              if (scope.queue.length == scope.selected.length) {
                 // All the api calls finished
                 $('input[type="checkbox"]').prop("checked",false);
                 scope.selected = [];
                 var errors = 0;   
                 for (var i=0; i < scope.queue.length; i++) {
                     if (scope.queue[i].result == 'error') {
                        errors++;
                     }
                 }
                 if (errors > 0) {
                    Alert('Error', 'There was an error while adding one or more of the selected groups.');  
                 }
                 else {
                    $('#form-modal').modal('hide');
                 }
              }
              });

           if (scope.selected.length > 0 ) {
              var group;
              for (var i=0; i < scope.selected.length; i++) {
                  group = null;
                  for (var j=0; j < scope.groups.length; j++) {
                      if (scope.groups[j].id == scope.selected[i]) {
                         group = scope.groups[j];
                      }
                  }
                  if (group !== null) {
                     Rest.post(group)
                         .success( function(data, status, headers, config) {
                             scope.queue.push({ result: 'success', data: data, status: status });
                             scope.$emit('callFinished');
                             })
                         .error( function(data, status, headers, config) {
                             scope.queue.push({ result: 'error', data: data, status: status, headers: headers });
                             scope.$emit('callFinished');
                             });
                  }
              }
           }
           else {
              $('#form-modal').modal('hide');
           }  
           }

        scope.toggle_group = function(id) {
           if (scope[list.iterator + "_" + id + "_class"] == "success") {
              scope[list.iterator + "_" + id + "_class"] = "";
              document.getElementById('check_' + id).checked = false;
              if (scope.selected.indexOf(id) > -1) {
                 scope.selected.splice(scope.selected.indexOf(id),1);
              }
           }
           else {
              scope[list.iterator + "_" + id + "_class"] = "success";
              document.getElementById('check_' + id).checked = true;
              if (scope.selected.indexOf(id) == -1) {
                 scope.selected.push(id);
              }
           }
           }

        scope.createGroup = function() {
            $('#form-modal').modal('hide');
            GroupsAdd({ inventory_id: inventory_id, group_id: group_id });
            }


        }
        }])



    .factory('GroupsAdd', ['$rootScope', '$location', '$log', '$routeParams', 'Rest', 'Alert', 'GroupForm', 'GenerateForm', 
        'Prompt', 'ProcessErrors', 'GetBasePath',
    function($rootScope, $location, $log, $routeParams, Rest, Alert, GroupForm, GenerateForm, Prompt, ProcessErrors,
        GetBasePath) {
    return function(params) {

        var inventory_id = params.inventory_id;
        var group_id = (params.group_id !== undefined) ? params.group_id : null;

        // Inject dynamic view
        var defaultUrl = (group_id !== null) ? GetBasePath('groups') + group_id + '/children/' : 
            GetBasePath('inventory') + inventory_id + '/groups/';
        var form = GroupForm;
        var generator = GenerateForm;
        var scope = generator.inject(form, {mode: 'add', modal: true, related: false});
        scope.formModalActionLabel = 'Save'
        scope.formModalHeader = 'Create Group'
        generator.reset();
        var master={}; 

        // Save
        scope.formModalAction  = function() {
           try { 
               // Make sure we have valid JSON
               var myjson = JSON.parse(scope.variables);
               
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
                       if (scope.variables) {
                          Rest.setUrl(data.related.variable_data);
                          Rest.put({data: scope.variables})
                              .success( function(data, status, headers, config) {
                                  $('#form-modal').modal('hide');
                              })
                              .error( function(data, status, headers, config) {
                                  ProcessErrors(scope, data, status, form,
                                     { hdr: 'Error!', msg: 'Failed to add group varaibles. PUT returned status: ' + status });
                              });
                       }
                       })
                   .error( function(data, status, headers, config) {
                       ProcessErrors(scope, data, status, form,
                           { hdr: 'Error!', msg: 'Failed to add new group. Post returned status: ' + status });
                       });
           }
           catch(err) {
               Alert("Error", "Error parsing group variables. Expecting valid JSON. Parser returned " + err);     
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
        'Prompt', 'ProcessErrors', 'GetBasePath',
    function($rootScope, $location, $log, $routeParams, Rest, Alert, GroupForm, GenerateForm, Prompt, ProcessErrors,
        GetBasePath) {
    return function(params) {
        
        var group_id = params.group_id;
        var inventory_id = $routeParams.id;
        var generator = GenerateForm;
        var form = GroupForm;
        var defaultUrl =  GetBasePath('groups') + group_id + '/';
        var scope = generator.inject(form, { mode: 'edit', modal: true, related: false});
        generator.reset();
        var master = {};
        var relatedSets = {};

        scope.formModalActionLabel = 'Save'
        scope.formModalHeader = 'Edit Group'

        // After the group record is loaded, retrieve any group variables
        if (scope.groupLoadedRemove) {
           scope.groupLoadedRemove();
        }
        scope.groupLoadedRemove = scope.$on('groupLoaded', function() {
            for (var set in relatedSets) {
                scope.search(relatedSets[set].iterator);
            }
            if (scope.variable_url) {
               Rest.setUrl(scope.variable_url);
               Rest.get()
                   .success( function(data, status, headers, config) {
                       if ($.isEmptyObject(data.data)) {
                          scope.variables = "\{\}";
                       }
                       else {
                          scope.variables = data.data;
                       }
                       })
                   .error( function(data, status, headers, config) {
                       scope.variables = null;
                       ProcessErrors(scope, data, status, form,
                           { hdr: 'Error!', msg: 'Failed to retrieve host variables. GET returned status: ' + status });
                       });
            }
            else {
               scope.variables = "\{\}";
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
                scope.$emit('groupLoaded');
                })
            .error( function(data, status, headers, config) {
                ProcessErrors(scope, data, status, form,
                    { hdr: 'Error!', msg: 'Failed to retrieve group: ' + id + '. GET status: ' + status });
                });
       
        // Save changes to the parent
        scope.formModalAction = function() {
            try { 
                // Make sure we have valid JSON
                var myjson = JSON.parse(scope.variables);

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
                           Rest.setUrl(GetBasePath('groups') + data.id + '/variable_data/');
                           Rest.put({data: scope.variables})
                               .success( function(data, status, headers, config) {
                                   $('#form-modal').modal('hide');
                                   })
                               .error( function(data, status, headers, config) {
                                   ProcessErrors(scope, data, status, form,
                                       { hdr: 'Error!', msg: 'Failed to update group varaibles. PUT returned status: ' + status });
                                   });
                        }
                        $('#form-modal').modal('hide');  
                        })
                    .error( function(data, status, headers, config) {
                        ProcessErrors(scope, data, status, form,
                            { hdr: 'Error!', msg: 'Failed to update group: ' + group_id + '. PUT status: ' + status });
                        });
            }
            catch(err) {
               Alert("Error", "Error parsing group variables. Expecting valid JSON. Parser returned " + err);     
            }
            };

        // Cancel
        scope.formReset = function() {
           generator.reset();
           for (var fld in master) {
               scope[fld] = master[fld];
           }
           }
        }
        }])


    .factory('GroupsDelete', ['$rootScope', '$location', '$log', '$routeParams', 'Rest', 'Alert', 'GroupForm', 'GenerateForm', 
        'Prompt', 'ProcessErrors', 'GetBasePath',
    function($rootScope, $location, $log, $routeParams, Rest, Alert, GroupForm, GenerateForm, Prompt, ProcessErrors,
        GetBasePath) {
    return function(params) {
        var scope = params.scope;
        var obj = $('#tree-view li[group_id="' + scope.group_id + '"]');
        var action_to_take = function() {
            var url = GetBasePath('inventory') + $routeParams.id + '/groups/';
            Rest.setUrl(url);
            Rest.post({ id: scope.group_id, disassociate: 1 })
               .success( function(data, status, headers, config) {
                   $('#prompt-modal').modal('hide');
                   $('#tree-view').jstree("delete_node",obj);
                   })
               .error( function(data, status, headers, config) {
                   $('#prompt-modal').modal('hide');
                   ProcessErrors(scope, data, status, null,
                       { hdr: 'Error!', msg: 'Call to ' + url + ' failed. DELETE returned status: ' + status });
                   });      
            };
        //Force binds to work. Not working usual way.
        var parent = $.jstree._reference('#tree-view')._get_parent(obj);
        $('#prompt-header').text('Delete Group');
        $('#prompt-body').text('Are you sure you want to remove group ' + $(obj).attr('name') + 
           ' from ' + $(parent).attr('name') + '?');
        $('#prompt-action-btn').addClass('btn-danger');
        scope.promptAction = action_to_take;  // for some reason this binds?
        $('#prompt-modal').modal({
            backdrop: 'static',
            keyboard: true,
            show: true
            });
        }
        }]);



