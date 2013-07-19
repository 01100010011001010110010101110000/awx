/************************************
 * Copyright (c) 2013 AnsibleWorks, Inc.
 *
 *
 *  Organizations.js
 *  
 *  Controller functions for Organization model.
 *
 */

'use strict';

function OrganizationsList ($routeParams, $scope, $rootScope, $location, $log, Rest, Alert, LoadBreadCrumbs, Prompt,
                            GenerateList, OrganizationList, SearchInit, PaginateInit, ClearScope, ProcessErrors,
                            GetBasePath, SelectionInit)
{
    ClearScope('htmlTemplate');  //Garbage collection. Don't leave behind any listeners/watchers from the prior
                                 //scope.

    var list = OrganizationList;
    var generate = GenerateList;
    var paths = $location.path().replace(/^\//,'').split('/');
    var mode = (paths[0] == 'organizations') ? 'edit' : 'select';      // if base path 'users', we're here to add/edit users
    var scope = generate.inject(OrganizationList, { mode: mode });         // Inject our view
    var defaultUrl = GetBasePath('organizations');
    var iterator = list.iterator;
    $rootScope.flashMessage = null;

    LoadBreadCrumbs();
    
    SelectionInit({ scope: scope, list: list });

    // Initialize search and paginate pieces and load data
    SearchInit({ scope: scope, set: list.name, list: list, url: defaultUrl });
    PaginateInit({ scope: scope, list: list, url: defaultUrl });
    scope.search(list.iterator);

    //getData();

    scope.addOrganization = function() {
       $location.path($location.path() + '/add');
       }

    scope.editOrganization = function(id) {
       $location.path($location.path() + '/' + id);
       }
 
    scope.deleteOrganization = function(id, name) {
       
       var action = function() {
           var url = defaultUrl + id + '/';
           Rest.setUrl(url);
           Rest.destroy()
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


    scope.finishSelection = function() {
       var url;
       url = GetBasePath('projects') + $routeParams.project_id + '/organizations/';
       scope.queue = [];
       scope.$on('callFinished', function() {
          // We call the API for each selected row. We need to hang out until all the api
          // calls are finished.
          if (scope.queue.length == scope.selected.length) {
             // All the api calls finished
             scope.selected = [];
             var errors = 0;   
             for (var i=0; i < scope.queue.length; i++) {
                 if (scope.queue[i].result == 'error') {
                    errors++;
                 }
             }
             if (errors > 0) {
                Alert('Error', 'There was an error while adding one or more of the selected organizations.');  
             }
             else {
                ReturnToCaller(1);
             }
          }
          });

       if (scope.selected.length > 0 ) {
          var org;
          for (var i=0; i < scope.selected.length; i++) {
              org = null;
              for (var j=0; j < scope.organizations.length; j++) {
                  if (scope.organizations[j].id == scope.selected[i]) {
                     org = scope.organizations[j];
                  }
              }
              if (org !== null) {
                 Rest.setUrl(url);
                 Rest.post(org)
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
}

OrganizationsList.$inject=[ '$routeParams', '$scope', '$rootScope', '$location', '$log', 'Rest', 'Alert', 'LoadBreadCrumbs', 'Prompt',
                            'GenerateList', 'OrganizationList', 'SearchInit', 'PaginateInit', 'ClearScope', 'ProcessErrors',
                            'GetBasePath', 'SelectionInit' ];


function OrganizationsAdd ($scope, $rootScope, $compile, $location, $log, $routeParams, OrganizationForm, 
                           GenerateForm, Rest, Alert, ProcessErrors, LoadBreadCrumbs, ClearScope, GetBasePath,
                           ReturnToCaller) 
{
   ClearScope('htmlTemplate');  //Garbage collection. Don't leave behind any listeners/watchers from the prior
                                //scope.

   // Inject dynamic view
   var form = GenerateForm;
   var scope = form.inject(OrganizationForm, {mode: 'add', related: false});
   var base = $location.path().replace(/^\//,'').split('/')[0];
   var defaultUrl = GetBasePath('organizations');
   form.reset();

   LoadBreadCrumbs();

   // Save
   scope.formSave = function() {
      var url = GetBasePath(base);
      url += (base != 'organizations') ? $routeParams['project_id'] + '/organizations/' : '';
      Rest.setUrl(url);
      Rest.post({ name: $scope.name, 
                  description: $scope.description })
          .success( function(data, status, headers, config) {  
              if (base == 'organizations') {
                 $rootScope.flashMessage = "New organization successfully created!";
                 $location.path('/organizations/' + data.id);
              }
              else {
                 ReturnToCaller(1);
              }
              })
          .error( function(data, status, headers, config) {
              ProcessErrors(scope, data, status, OrganizationForm,
                            { hdr: 'Error!', msg: 'Failed to add new organization. Post returned status: ' + status });
              });
      };

   // Cancel
   scope.formReset = function() {
      $rootScope.flashMessage = null;
      form.reset();
      }; 
}

OrganizationsAdd.$inject = [ '$scope', '$rootScope', '$compile', '$location', '$log', '$routeParams', 'OrganizationForm', 
                             'GenerateForm', 'Rest', 'Alert', 'ProcessErrors', 'LoadBreadCrumbs', 'ClearScope', 'GetBasePath',
                             'ReturnToCaller' ];


function OrganizationsEdit ($scope, $rootScope, $compile, $location, $log, $routeParams, OrganizationForm, 
                            GenerateForm, Rest, Alert, ProcessErrors, LoadBreadCrumbs, RelatedSearchInit,
                            RelatedPaginateInit, Prompt, ClearScope, GetBasePath) 
{
   ClearScope('htmlTemplate');  //Garbage collection. Don't leave behind any listeners/watchers from the prior
                                //scope.

   // Inject dynamic view
   var form = OrganizationForm;
   var generator = GenerateForm;
   var scope = GenerateForm.inject(form, {mode: 'edit', related: true});
   generator.reset();
   
   var defaultUrl = GetBasePath('organizations');
   var base = $location.path().replace(/^\//,'').split('/')[0];
   var master = {};
   var id = $routeParams.organization_id;
   var relatedSets = {}; 

   // After the Organization is loaded, retrieve each related set
   if (scope.organizationLoadedRemove) {
      scope.organizationLoadedRemove();
   }
   scope.organizationLoadedRemove = scope.$on('organizationLoaded', function() {
       for (var set in relatedSets) {
           scope.search(relatedSets[set].iterator);
       }
       });

   // Retrieve detail record and prepopulate the form
   Rest.setUrl(defaultUrl + id + '/'); 
   Rest.get()
       .success( function(data, status, headers, config) {
           LoadBreadCrumbs({ path: '/organizations/' + id, title: data.name });
           for (var fld in form.fields) {
              if (data[fld]) {
                 scope[fld] = data[fld];
                 master[fld] = data[fld];
              }
           }
           var related = data.related;
           for (var set in form.related) {
               if (related[set]) {
                  relatedSets[set] = { url: related[set], iterator: form.related[set].iterator };
               }
           }
           // Initialize related search functions. Doing it here to make sure relatedSets object is populated.
           RelatedSearchInit({ scope: scope, form: form, relatedSets: relatedSets });
           RelatedPaginateInit({ scope: scope, relatedSets: relatedSets });
           scope.$emit('organizationLoaded');
           })
       .error( function(data, status, headers, config) {
           ProcessErrors(scope, data, status, form,
                         { hdr: 'Error!', msg: 'Failed to retrieve organization: ' + $routeParams.id + '. GET status: ' + status });
           });
   
   
   // Save changes to the parent
   scope.formSave = function() {
      var params = {};
      for (var fld in form.fields) {
          params[fld] = scope[fld];
      }
      Rest.setUrl(defaultUrl + id + '/');
      Rest.put(params)
          .success( function(data, status, headers, config) {
              master = params;
              $rootScope.flashMessage = "Your changes were successfully saved!";
              })
          .error( function(data, status, headers, config) {
              ProcessErrors(scope, data, status, OrganizationForm,
                            { hdr: 'Error!', msg: 'Failed to update organization: ' + id + '. PUT status: ' + status });
              });
      };

   // Reset the form
   scope.formReset = function() {
      $rootScope.flashMessage = null;
      form.reset();
      for (var fld in master) {
          scope[fld] = master[fld];
      }
      };

   // Related set: Add button
   scope.add = function(set) {
      $rootScope.flashMessage = null;
      $location.path('/' + base + '/' + $routeParams.organization_id + '/' + set);
      };

   // Related set: Edit button
   scope.edit = function(set, id, name) {
      $rootScope.flashMessage = null;
      $location.path('/' + set + '/' + id);
      };

   // Related set: Delete button
   scope['delete'] = function(set, itm_id, name, title) {
      $rootScope.flashMessage = null;
      
      var action = function() {
          var url = defaultUrl + $routeParams.organization_id + '/' + set + '/';
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
       
      }
}

OrganizationsEdit.$inject = [ '$scope', '$rootScope', '$compile', '$location', '$log', '$routeParams', 'OrganizationForm', 
                              'GenerateForm', 'Rest', 'Alert', 'ProcessErrors', 'LoadBreadCrumbs', 'RelatedSearchInit',
                              'RelatedPaginateInit', 'Prompt', 'ClearScope', 'GetBasePath'];
