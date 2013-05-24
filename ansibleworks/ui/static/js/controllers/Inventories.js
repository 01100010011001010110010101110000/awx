/************************************
 * Copyright (c) 2013 AnsibleWorks, Inc.
 *
 *
 *  Inventories.js
 *  
 *  Controller functions for the Inventory model.
 *
 */

'use strict';

function InventoriesList ($scope, $rootScope, $location, $log, $routeParams, Rest, Alert, InventoryList,
                          GenerateList, LoadBreadCrumbs, Prompt, SearchInit, PaginateInit, ReturnToCaller,
                          ClearScope, ProcessErrors, GetBasePath)
{
    ClearScope('htmlTemplate');  //Garbage collection. Don't leave behind any listeners/watchers from the prior
                                 //scope.
    var list = InventoryList;
    var defaultUrl = GetBasePath('inventory');
    var view = GenerateList;
    var paths = $location.path().replace(/^\//,'').split('/');
    var mode = (paths[0] == 'inventories') ? 'edit' : 'select';      // if base path 'users', we're here to add/edit users
    var scope = view.inject(InventoryList, { mode: mode });          // Inject our view
    scope.selected = [];
  
    SearchInit({ scope: scope, set: 'inventories', list: list, url: defaultUrl });
    PaginateInit({ scope: scope, list: list, url: defaultUrl });
    scope.search(list.iterator);

    LoadBreadCrumbs();
    
    scope.addInventory = function() {
       $location.path($location.path() + '/add');
       }

    scope.editInventory = function(id) {
       $location.path($location.path() + '/' + id);
       }
 
    scope.deleteInventory = function(id, name) {
       
       var action = function() {
           var url = defaultUrl + id + '/';
           Rest.setUrl(url);
           Rest.delete()
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
                body: 'Are you sure you want to delete ' + name + '?',
                action: action
                });
       }
    
    scope.lookupOrganization = function(organization_id) {
       Rest.setUrl('/api/v1/organization/' + organization_id + '/');
       Rest.get()
           .success( function(data, status, headers, config) {
               return data.name;
               });
       }

    scope.finishSelection = function() {
       Rest.setUrl('/api/v1' + $location.path() + '/');  // We're assuming the path matches the api path. 
                                                         // Will this always be true??
       scope.queue = [];

       scope.$on('callFinished', function() {
          // We call the API for each selected user. We need to hang out until all the api
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
                Alert('Error', 'There was an error while adding one or more of the selected inventories.');  
             }
             else {
                ReturnToCaller(1);
             }
          }
          });

       if (scope.selected.length > 0 ) {
          var inventory = null;
          for (var i=0; i < scope.selected.length; i++) {
              for (var j=0; j < scope.inventories.length; j++) {
                  if (scope.inventories[j].id == scope.selected[i]) {
                     inventory = scope.inventories[j];
                  }
              }
              if (inventory !== null) {
                 Rest.post(inventory)
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
          ReturnToCaller();
       }  
       }

    scope.toggle_inventory = function(id) {
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
}

InventoriesList.$inject = [ '$scope', '$rootScope', '$location', '$log', '$routeParams', 'Rest', 'Alert', 'InventoryList', 'GenerateList', 
                            'LoadBreadCrumbs', 'Prompt', 'SearchInit', 'PaginateInit', 'ReturnToCaller', 'ClearScope', 'ProcessErrors',
                            'GetBasePath' ];


function InventoriesAdd ($scope, $rootScope, $compile, $location, $log, $routeParams, InventoryForm, 
                         GenerateForm, Rest, Alert, ProcessErrors, LoadBreadCrumbs, ReturnToCaller, ClearScope,
                         GenerateList, OrganizationList, SearchInit, PaginateInit, LookUpInit) 
{
   ClearScope('htmlTemplate');  //Garbage collection. Don't leave behind any listeners/watchers from the prior
                                //scope.

   // Inject dynamic view
   var defaultUrl = '/api/v1/inventories/';
   var form = InventoryForm;
   var generator = GenerateForm;
   var scope = generator.inject(form, {mode: 'add', related: false});
   generator.reset();
   LoadBreadCrumbs();
   
   LookUpInit({
       scope: scope,
       form: form,
       current_item: ($routeParams.organization_id) ? $routeParams.organization_id : null,
       list: OrganizationList, 
       field: 'organization' 
       });
   
   // Save
   scope.formSave = function() {
      Rest.setUrl(defaultUrl);
      var data = {}
      for (var fld in form.fields) {
          data[fld] = scope[fld];
      } 
      if ($routeParams.inventory_id) {
         data.inventory = $routeParams.inventory_id;
      }
      Rest.post(data)
          .success( function(data, status, headers, config) {
              $location.path('/inventories/' + data.id);
              })
          .error( function(data, status, headers, config) {
              ProcessErrors(scope, data, status, form,
                            { hdr: 'Error!', msg: 'Failed to add new inventory. Post returned status: ' + status });
              });
      };

   // Reset
   scope.formReset = function() {
      // Defaults
      generator.reset();
      }; 
}

InventoriesAdd.$inject = [ '$scope', '$rootScope', '$compile', '$location', '$log', '$routeParams', 'InventoryForm', 'GenerateForm', 
                           'Rest', 'Alert', 'ProcessErrors', 'LoadBreadCrumbs', 'ReturnToCaller', 'ClearScope', 'GenerateList',
                           'OrganizationList', 'SearchInit', 'PaginateInit', 'LookUpInit' ]; 


function InventoriesEdit ($scope, $rootScope, $compile, $location, $log, $routeParams, InventoryForm, 
                          GenerateForm, Rest, Alert, ProcessErrors, LoadBreadCrumbs, RelatedSearchInit, 
                          RelatedPaginateInit, ReturnToCaller, ClearScope, LookUpInit, Prompt,
                          OrganizationList, TreeInit, GetBasePath) 
{
   ClearScope('htmlTemplate');  //Garbage collection. Don't leave behind any listeners/watchers from the prior
                                //scope.

   var generator = GenerateForm;
   var form = InventoryForm;
   var defaultUrl=GetBasePath('inventory');
   var scope = generator.inject(form, {mode: 'edit', related: true});
   generator.reset();
   var base = $location.path().replace(/^\//,'').split('/')[0];
   var master = {};
   var id = $routeParams.id;
   var relatedSets = {}; 
  
   // After inventory is loaded, retrieve each related set and any lookups
   scope.$on('inventoryLoaded', function() {
       for (var set in relatedSets) {
           scope.search(relatedSets[set].iterator);
       }     
       });

   // Retrieve detail record and prepopulate the form
   Rest.setUrl(defaultUrl + ':id/'); 
   Rest.get({ params: {id: id} })
       .success( function(data, status, headers, config) {
           LoadBreadCrumbs({ path: '/inventories/' + id, title: data.name });
           for (var fld in form.fields) {
              if (data[fld]) {
                 scope[fld] = data[fld];
                 master[fld] = scope[fld];
              }
              if (form.fields[fld].type == 'lookup' && data.summary_fields[form.fields[fld].sourceModel]) {
                  scope[form.fields[fld].sourceModel + '_' + form.fields[fld].sourceField] = 
                      data.summary_fields[form.fields[fld].sourceModel][form.fields[fld].sourceField];
                  master[form.fields[fld].sourceModel + '_' + form.fields[fld].sourceField] =
                      scope[form.fields[fld].sourceModel + '_' + form.fields[fld].sourceField];
              }
           }

           LookUpInit({
               scope: scope,
               form: form,
               current_item: data.organization,
               list: OrganizationList, 
               field: 'organization' 
               });

           var related = data.related;
           for (var set in form.related) {
               if (related[set]) {
                  relatedSets[set] = { url: related[set], iterator: form.related[set].iterator };
               }
           }
           
           // Load the tree view
           TreeInit({ scope: scope, inventory: data });

           // Initialize related search functions. Doing it here to make sure relatedSets object is populated.
           //RelatedSearchInit({ scope: scope, form: form, relatedSets: relatedSets });
           //RelatedPaginateInit({ scope: scope, relatedSets: relatedSets });
           scope.$emit('inventoryLoaded');
           })
       .error( function(data, status, headers, config) {
           ProcessErrors(scope, data, status, form,
                         { hdr: 'Error!', msg: 'Failed to retrieve inventory: ' + $routeParams.id + '. GET status: ' + status });
           });

   // Save changes to the parent
   scope.formSave = function() {
      Rest.setUrl(defaultUrl + $routeParams.id + '/');
      var data = {}
      for (var fld in form.fields) {
          data[fld] = scope[fld];   
      } 
      Rest.put(data)
          .success( function(data, status, headers, config) {
              var base = $location.path().replace(/^\//,'').split('/')[0];
              (base == 'inventories') ? ReturnToCaller() : ReturnToCaller(1);
              })
          .error( function(data, status, headers, config) {
              ProcessErrors(scope, data, status, form,
                            { hdr: 'Error!', msg: 'Failed to update inventory: ' + $routeParams.id + '. PUT status: ' + status });
              });
      };

   // Cancel
   scope.formReset = function() {
      generator.reset();
      for (var fld in master) {
          scope[fld] = master[fld];
      }
      };

   // Related set: Add button
   scope.add = function(set) {
      $rootScope.flashMessage = null;
      $location.path('/' + base + '/' + $routeParams.id + '/' + set + '/add');
      };

   // Related set: Edit button
   scope.edit = function(set, id, name) {
      $rootScope.flashMessage = null;
      $location.path('/' + base + '/' + $routeParams.id + '/' + set + '/' + id);
      };

   // Related set: Delete button
   scope.delete = function(set, itm_id, name, title) {
      $rootScope.flashMessage = null;
      
      var action = function() {
          var url = defaultUrl + id + '/' + set + '/';
          Rest.setUrl(url);
          Rest.post({ id: itm_id, disassociate: 1 })
              .success( function(data, status, headers, config) {
                  $('#prompt-modal').modal('hide');
                  scope.search(form.related[set].iterator);
                  })
              .error( function(data, status, headers, config) {
                  $('#prompt-modal').modal('hide');
                  ProcessErrors(scope, data, status, null,
                            { hdr: 'Error!', msg: 'Call to ' + url + ' failed. POST returned status: ' + status });
                  });      
          };

       Prompt({ hdr: 'Delete', 
                body: 'Are you sure you want to remove ' + name + ' from ' + scope.name + ' ' + title + '?',
                action: action
                });
       
      };

   function changePath(path) {
      // For reasons unknown, calling $location.path(<new path>) from inside 
      // treeController fails to work. This is the work-around.
      window.location = '/#' + path;
      };

   scope.treeController = function($node) {
      var nodeType = $($node).attr('type');
      if (nodeType == 'host') {
         return {
             edit: { 
                 label: 'Edit Host',
                 action: function(obj) { changePath($location.path() + '/hosts/' + $(obj).attr('id')); }
                 },
             delete: {
                 label: 'Delete Host', 
                 action: function(obj) { 
                     var action_to_take = function() {
                         var url = defaultUrl + $routeParams.id + '/hosts/';
                         Rest.setUrl(url);
                         Rest.post({ id: $(obj).attr('id'), disassociate: 1 })
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
                     $('#prompt-header').text('Delete');
                     $('#prompt-body').text('Are you sure you want to delete host ' + $(obj).attr('name') + '?');
                     $('#prompt-action-btn').addClass('btn-danger');
                     scope.promptAction = action_to_take;  // for some reason this binds?
                     $('#prompt-modal').modal({
                         backdrop: 'static',
                         keyboard: true,
                         show: true
                         });
                     }
                 }
             }
      }
      else if (nodeType == 'inventory') {
          return {
              addGroup: {
                  label: 'Add Group',
                  action: function() { changePath($location.path() + '/groups'); }
                  }
              }
      }
      else {
         return {
             addGroup: { 
                label: 'Add Subgroup',
                action: function(obj) { 
                    LoadBreadCrumbs({ path: '/groups/' + $(obj).attr('id'), title: $(obj).attr('name') });
                    changePath($location.path() + '/groups/' + $(obj).attr('id') + '/children');    
                    },
                "_disabled": (nodeType == 'all-hosts-group') ? true : false
                },
             addHost: { 
                 label: 'Add Host',
                 action: function(obj) {
                     LoadBreadCrumbs({ path: '/groups/' + $(obj).attr('id'), title: $(obj).attr('name') });
                     changePath($location.path() + '/groups/' + $(obj).attr('id') + '/hosts'); 
                     },
                 "_disabled": (nodeType == 'all-hosts-group') ? true : false
                 },
             edit: { 
                 label: 'Edit Group',
                 action: function(obj) { changePath($location.path() + '/groups/' + $(obj).attr('id')); },
                 separator_before: true,
                 "_disabled": (nodeType == 'all-hosts-group') ? true : false
                 },
             delete: {
                 label: 'Delete Group',
                 action: function(obj) { 
                     var action_to_take = function() {
                         var url = defaultUrl + $routeParams.id + '/groups/';
                         Rest.setUrl(url);
                         Rest.post({ id: $(obj).attr('id'), disassociate: 1 })
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
                     },
                 "_disabled": (nodeType == 'all-hosts-group') ? true : false
                 }
             }
      }
      }

}

InventoriesEdit.$inject = [ '$scope', '$rootScope', '$compile', '$location', '$log', '$routeParams', 'InventoryForm', 
                            'GenerateForm', 'Rest', 'Alert', 'ProcessErrors', 'LoadBreadCrumbs', 'RelatedSearchInit', 
                            'RelatedPaginateInit', 'ReturnToCaller', 'ClearScope', 'LookUpInit', 'Prompt',
                            'OrganizationList', 'TreeInit', 'GetBasePath']; 
  