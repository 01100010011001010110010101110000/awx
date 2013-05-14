/************************************
 * Copyright (c) 2013 AnsibleWorks, Inc.
 *
 *
 *  Users.js
 *  
 *  Controller functions for User model.
 *
 */

'use strict';

function UsersList ($scope, $rootScope, $location, $log, $routeParams, Rest, 
                    Alert, UserList, GenerateList, LoadBreadCrumbs, Prompt, SearchInit, PaginateInit,
                    ReturnToCaller, ClearScope, ProcessErrors)
{
    ClearScope('htmlTemplate');  //Garbage collection. Don't leave behind any listeners/watchers from the prior
                              //scope.

    var list = UserList;
    var defaultUrl = '/api/v1/users/';
    var view = GenerateList;
    var paths = $location.path().replace(/^\//,'').split('/');
    var mode = (paths[0] == 'users') ? 'edit' : 'select';      // if base path 'users', we're here to add/edit users
    var scope = view.inject(UserList, { mode: mode });         // Inject our view
    scope.selected = [];
  
    SearchInit({ scope: scope, set: 'users', list: list, url: defaultUrl });
    PaginateInit({ scope: scope, list: list, url: defaultUrl });
    scope.search(list.iterator);


    LoadBreadCrumbs();
    
    scope.addUser = function() {
       $location.path($location.path() + '/add');
       }

    scope.editUser = function(id) {
       $location.path($location.path() + '/' + id);
       }
 
    scope.deleteUser = function(id, name) {
       
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
                Alert('Error', 'There was an error while adding one or more of the selected users.');  
             }
             else {
                ReturnToCaller(1);
             }
          }
          });

       if (scope.selected.length > 0 ) {
          var user;
          for (var i=0; i < scope.selected.length; i++) {
              user = null;
              for (var j=0; j < scope.users.length; j++) {
                  if (scope.users[j].id == scope.selected[i]) {
                     user = scope.users[j];
                  }
              }
              if (user !== null) {
                 Rest.post(user)
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

    scope.toggle_user = function(idx) {
       if (scope.selected.indexOf(idx) > -1) {
          scope.selected.splice(scope.selected.indexOf(idx),1);
       }
       else {
          scope.selected.push(idx);
       }
    }
}

UsersList.$inject = [ '$scope', '$rootScope', '$location', '$log', '$routeParams', 'Rest', 'Alert', 'UserList', 'GenerateList', 
                      'LoadBreadCrumbs', 'Prompt', 'SearchInit', 'PaginateInit', 'ReturnToCaller', 'ClearScope', 'ProcessErrors' ];


function UsersAdd ($scope, $rootScope, $compile, $location, $log, $routeParams, UserForm, 
                   GenerateForm, Rest, Alert, ProcessErrors, LoadBreadCrumbs, ReturnToCaller, ClearScope) 
{
   ClearScope('htmlTemplate');  //Garbage collection. Don't leave behind any listeners/watchers from the prior
                             //scope.

   // Inject dynamic view
   var defaultUrl = '/api/v1/organizations/';
   var form = UserForm;
   var generator = GenerateForm;
   var scope = generator.inject(form, {mode: 'add', related: false});
   generator.reset();

   LoadBreadCrumbs();

   // Save
   scope.formSave = function() {
      Rest.setUrl(defaultUrl + $routeParams.id + '/users/');
      var data = {}
      for (var fld in form.fields) {
          data[fld] = scope[fld];   
      } 
      Rest.post(data)
          .success( function(data, status, headers, config) {
              ReturnToCaller(1);
              })
          .error( function(data, status, headers, config) {
              ProcessErrors(scope, data, status, form,
                            { hdr: 'Error!', msg: 'Failed to add new user. Post returned status: ' + status });
              });
      };

   // Cancel
   scope.formReset = function() {
      // Defaults
      generator.reset();
      }; 

   // Password change
   scope.clearPWConfirm = function(fld) {
      // If password value changes, make sure password_confirm must be re-entered
      scope[fld] = '';
      scope[form.name][fld].$setValidity('awpassmatch', false);
      }
}

UsersAdd.$inject = [ '$scope', '$rootScope', '$compile', '$location', '$log', '$routeParams', 'UserForm', 'GenerateForm', 
                     'Rest', 'Alert', 'ProcessErrors', 'LoadBreadCrumbs', 'ReturnToCaller', 'ClearScope']; 


function UsersEdit ($scope, $rootScope, $compile, $location, $log, $routeParams, UserForm, 
                    GenerateForm, Rest, Alert, ProcessErrors, LoadBreadCrumbs, RelatedSearchInit, 
                    RelatedPaginateInit, ReturnToCaller, ClearScope) 
{
   ClearScope('htmlTemplate');  //Garbage collection. Don't leave behind any listeners/watchers from the prior
                             //scope.

   var defaultUrl='/api/v1/users/';
   var generator = GenerateForm;
   var form = UserForm;
   var scope = generator.inject(form, {mode: 'edit', related: true});
   generator.reset();
   var master = {};
   var id = $routeParams.id;
   var relatedSets = {}; 

   // After the Organization is loaded, retrieve each related set
   scope.$on('userLoaded', function() {
       for (var set in relatedSets) {
           scope.search(relatedSets[set].iterator);
       }
       });

   // Retrieve detail record and prepopulate the form
   Rest.setUrl(defaultUrl + ':id/'); 
   Rest.get({ params: {id: id} })
       .success( function(data, status, headers, config) {
           LoadBreadCrumbs({ path: '/users/' + id, title: data.username });
           for (var fld in form.fields) {
              if (data[fld]) {
                if (fld == 'is_superuser') {
                   scope[fld] = (data[fld] == 'true' || data[fld] == true) ? 'true' : 'false';
                }
                else {
                   scope[fld] = data[fld];
                }
                master[fld] = scope[fld];
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
           scope.$emit('userLoaded');
           })
       .error( function(data, status, headers, config) {
           ProcessErrors(scope, data, status, form,
                         { hdr: 'Error!', msg: 'Failed to retrieve user: ' + $routeParams.id + '. GET status: ' + status });
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
              (base == 'users') ? ReturnToCaller() : ReturnToCaller(1);
              })
          .error( function(data, status, headers, config) {
              ProcessErrors(scope, data, status, form,
                            { hdr: 'Error!', msg: 'Failed to update users: ' + $routeParams.id + '. PUT status: ' + status });
              });
      };

   // Cancel
   scope.formReset = function() {
      generator.reset();
      for (var fld in master) {
          scope[fld] = master[fld];
      }
      };

   // Password change
   scope.clearPWConfirm = function(fld) {
      // If password value changes, make sure password_confirm must be re-entered
      scope[fld] = '';
      scope[form.name + '_form'][fld].$setValidity('awpassmatch', false);
      }

}

UsersEdit.$inject = [ '$scope', '$rootScope', '$compile', '$location', '$log', '$routeParams', 'UserForm', 
                      'GenerateForm', 'Rest', 'Alert', 'ProcessErrors', 'LoadBreadCrumbs', 'RelatedSearchInit', 
                      'RelatedPaginateInit', 'ReturnToCaller', 'ClearScope']; 
  