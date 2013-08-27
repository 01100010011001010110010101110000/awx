/************************************
 * Copyright (c) 2013 AnsibleWorks, Inc.
 *
 *  Groups.js
 *  
 *  Controller functions for the Groups model.
 *
 */

function InventoryGroups ($scope, $rootScope, $compile, $location, $log, $routeParams, InventoryGroupsForm,
                          GenerateForm, Rest, Alert, ProcessErrors, LoadBreadCrumbs, RelatedSearchInit, 
                          RelatedPaginateInit, ReturnToCaller, ClearScope, LookUpInit, Prompt,
                          OrganizationList, TreeInit, GetBasePath, GroupsList, GroupsAdd, GroupsEdit, LoadInventory,
                          GroupsDelete, HostsList, HostsAdd, HostsEdit, HostsDelete, RefreshGroupName, ParseTypeChange,
                          HostsReload, EditInventory, RefreshTree, LoadSearchTree, EditHostGroups) 
{
   ClearScope('htmlTemplate');  //Garbage collection. Don't leave behind any listeners/watchers from the prior
                                //scope.

   var generator = GenerateForm;
   var form = InventoryGroupsForm;
   var defaultUrl=GetBasePath('inventory');
   var scope = generator.inject(form, { mode: 'edit', related: true, buildTree: true });
   var base = $location.path().replace(/^\//,'').split('/')[0];
   var id = $routeParams.inventory_id;
   
   scope['inventory_id'] = id;
   
   // Retrieve each related sets and any lookups
   if (scope.inventoryLoadedRemove) {
      scope.inventoryLoadedRemove();
   }
   scope.inventoryLoadedRemove = scope.$on('inventoryLoaded', function() {
       LoadBreadCrumbs({ path: '/inventories/' + id, title: scope.inventory_name });
       TreeInit(scope.TreeParams);
       if (!scope.$$phase) {
          scope.$digest();
       }
       });

   LoadInventory({ scope: scope, doPostSteps: true });

   scope.treeController = function($node) {

      var nodeType = $($node).attr('type');
      if (nodeType == 'inventory') {
          return {
              editInventory: {
                  label: 'Inventory Properties',
                  action: function(obj) {
                      scope.group_id = null;
                      if (!scope.$$phase) {
                         scope.$digest();
                      }
                      EditInventory({ scope: scope, "inventory_id": id });
                      },
                  separator_after: true
                  },
              addGroup: {
                  label: 'Create New Group',
                  action: function(obj) {
                      scope.group_id = null;
                      if (!scope.$$phase) {
                         scope.$digest();
                      }
                      GroupsAdd({ "inventory_id": id, group_id: null });
                      }
                  }
              }
      }
      else {
         return {
             edit: { 
                 label: 'Group Properties',
                 action: function(obj) {
                     scope.group_id = $(obj).attr('group_id');
                     if (!scope.$$phase) {
                        scope.$digest();
                     }
                     GroupsEdit({ "inventory_id": id, group_id: $(obj).attr('group_id') }); 
                     },
                 separator_after: true
                 },

             addGroup: { 
                 label: 'Add Existing Group',
                 action: function(obj) {
                     scope.group_id = $(obj).attr('group_id');
                     if (!scope.$$phase) {
                        scope.$digest();
                     }
                     GroupsList({ "inventory_id": id, group_id: $(obj).attr('group_id') });
                     }    
                 },

             createGroup: { 
                 label: 'Create New Group',
                 action: function(obj) {
                     scope.group_id = $(obj).attr('group_id');
                     if (!scope.$$phase) {
                        scope.$digest();
                     }
                     GroupsAdd({ "inventory_id": id, group_id: $(obj).attr('group_id') });
                     }    
                 },

             "delete": {
                 label: 'Delete Group',
                 action: function(obj) {
                     scope.group_id = $(obj).attr('group_id');
                     if (!scope.$$phase) {
                        scope.$digest();
                     }
                     GroupsDelete({ scope: scope, "inventory_id": id, group_id: $(obj).attr('group_id') });
                     }
                 }
             }
      }
      }
  
  scope.$on('NodeSelect', function(e, n) {
      
      // Respond to user clicking on a tree node

      var node = $('li[id="' + n.attr.id + '"]');
      var type = node.attr('type');
      var url;
      
      scope['selectedNode'] = node;
      scope['selectedNodeName'] = node.attr('name');
      
      $('#tree-view').jstree('open_node',node);
      
      if (type == 'group') {
         url = node.attr('all');
         scope.groupAddHide = false;
         scope.groupCreateHide = false;
         scope.groupEditHide = false;
         scope.inventoryEditHide = true;
         scope.groupDeleteHide = false;
         scope.createButtonShow = true;
         scope.group_id = node.attr('group_id');
         //scope.groupName = n.data;
         //scope.groupTitle = '<h4>' + n.data + '</h4>';
         //scope.groupTitle += (node.attr('description')) ? '<p>' + node.attr('description') + '</p>' : '';
      }
      else if (type == 'inventory') {
         url = node.attr('hosts');
         scope.groupAddHide = true;
         scope.groupCreateHide = false; 
         scope.groupEditHide =true;
         scope.inventoryEditHide=false;
         scope.groupDeleteHide = true;
         scope.createButtonShow = false;
         //scope.groupName = 'All Hosts';
         //scope.groupTitle = '<h4>All Hosts</h4>';
         scope.group_id = null;
      }

      if (!scope.$$phase) {
         scope.$digest();
      }
      });

  scope.addGroup = function() {
      GroupsList({ "inventory_id": id, group_id: scope.group_id });
      }

  scope.createGroup = function() {
      GroupsAdd({ "inventory_id": id, group_id: scope.group_id });
      }

  scope.editGroup = function() {
      GroupsEdit({ "inventory_id": id, group_id: scope.group_id });
      }

  scope.editInventory = function() {
      EditInventory({ scope: scope, inventory_id: id });
      }

  scope.deleteGroup = function() {
      GroupsDelete({ scope: scope, "inventory_id": id, group_id: scope.group_id });
      }

}

InventoryGroups.$inject = [ '$scope', '$rootScope', '$compile', '$location', '$log', '$routeParams', 'InventoryGroupsForm', 
                            'GenerateForm', 'Rest', 'Alert', 'ProcessErrors', 'LoadBreadCrumbs', 'RelatedSearchInit', 
                            'RelatedPaginateInit', 'ReturnToCaller', 'ClearScope', 'LookUpInit', 'Prompt',
                            'OrganizationList', 'TreeInit', 'GetBasePath', 'GroupsList', 'GroupsAdd', 'GroupsEdit', 'LoadInventory',
                            'GroupsDelete', 'HostsList', 'HostsAdd', 'HostsEdit', 'HostsDelete', 'RefreshGroupName',
                            'ParseTypeChange', 'HostsReload', 'EditInventory', 'RefreshTree', 'LoadSearchTree', 'EditHostGroups'
                            ]; 
  