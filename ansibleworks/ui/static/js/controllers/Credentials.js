/************************************
 * Copyright (c) 2013 AnsibleWorks, Inc.
 *
 *
 *  Credentials.js
 *  
 *  Controller functions for the Credential model.
 *
 */

'use strict';

function CredentialsList ($scope, $rootScope, $location, $log, $routeParams, Rest, Alert, CredentialList,
                          GenerateList, LoadBreadCrumbs, Prompt, SearchInit, PaginateInit, ReturnToCaller,
                          ClearScope, ProcessErrors, GetBasePath)
{
    ClearScope('htmlTemplate');  //Garbage collection. Don't leave behind any listeners/watchers from the prior
                                 //scope.
    var list = CredentialList;
    var defaultUrl = GetBasePath('credentials');
    var view = GenerateList;
    var base = $location.path().replace(/^\//,'').split('/')[0];
    var mode = (base == 'credentials') ? 'edit' : 'select';      // if base path 'credentials', we're here to add/edit
    var scope = view.inject(CredentialList, { mode: mode });         // Inject our view
    scope.selected = [];
  
    SearchInit({ scope: scope, set: 'credentials', list: list, url: defaultUrl });
    PaginateInit({ scope: scope, list: list, url: defaultUrl });
    scope.search(list.iterator);

    LoadBreadCrumbs();
    
    scope.addCredential = function() {
       $location.path($location.path() + '/add');
       }

    scope.editCredential = function(id) {
       $location.path($location.path() + '/' + id);
       }
 
    scope.deleteCredential = function(id, name) {
       
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
       var url = GetBasePath(base);
       url += (base == 'users') ? $routeParams.user_id + '/credentials/' : $routeParams.team_id + '/credentials/';
       Rest.setUrl(url);
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
                Alert('Error', 'There was an error while adding one or more of the selected Credentials.');  
             }
             else {
                ReturnToCaller(1);
             }
          }
          });

       if (scope.selected.length > 0 ) {
          var credential = null;
          for (var i=0; i < scope.selected.length; i++) {
              for (var j=0; j < scope.credentials.length; j++) {
                  if (scope.credentials[j].id == scope.selected[i]) {
                     credential = scope.credentials[j];
                  }
              }
              if (credential !== null) {
                 Rest.post(credential)
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

    scope.toggle_credential = function(id) {
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

CredentialsList.$inject = [ '$scope', '$rootScope', '$location', '$log', '$routeParams', 'Rest', 'Alert', 'CredentialList', 'GenerateList', 
                            'LoadBreadCrumbs', 'Prompt', 'SearchInit', 'PaginateInit', 'ReturnToCaller', 'ClearScope', 'ProcessErrors',
                            'GetBasePath'];


function CredentialsAdd ($scope, $rootScope, $compile, $location, $log, $routeParams, CredentialForm, 
                         GenerateForm, Rest, Alert, ProcessErrors, LoadBreadCrumbs, ReturnToCaller, ClearScope,
                         GenerateList, SearchInit, PaginateInit, LookUpInit, UserList, TeamList, GetBasePath) 
{
   ClearScope('htmlTemplate');  //Garbage collection. Don't leave behind any listeners/watchers from the prior
                                //scope.

   // Inject dynamic view
   var defaultUrl = GetBasePath('credentials');
   var form = CredentialForm;
   var generator = GenerateForm;
   var scope = generator.inject(form, {mode: 'add', related: false});
   var base = $location.path().replace(/^\//,'').split('/')[0];
   var defaultUrl = GetBasePath(base); 
   defaultUrl += (base == 'teams') ? $routeParams.team_id + '/credentials/' :  $routeParams.user_id + '/credentials/';
   generator.reset();
   LoadBreadCrumbs();
   
   // Save
   scope.formSave = function() {
      Rest.setUrl(defaultUrl);
      var data = {}
      for (var fld in form.fields) {
          data[fld] = scope[fld];
      }
      
      if (base == 'teams') {
         data['team'] = $routeParams.team_id; 
      }
      else {
         data['user'] = $routeParams.user_id;
      }

      Rest.post(data)
          .success( function(data, status, headers, config) {
              ReturnToCaller(1);
              })
          .error( function(data, status, headers, config) {
              ProcessErrors(scope, data, status, form,
                            { hdr: 'Error!', msg: 'Failed to add new Credential. Post returned status: ' + status });
              });
      };

   // Reset
   scope.formReset = function() {
      // Defaults
      generator.reset();
      };

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
}

CredentialsAdd.$inject = [ '$scope', '$rootScope', '$compile', '$location', '$log', '$routeParams', 'CredentialForm', 'GenerateForm', 
                           'Rest', 'Alert', 'ProcessErrors', 'LoadBreadCrumbs', 'ReturnToCaller', 'ClearScope', 'GenerateList',
                           'SearchInit', 'PaginateInit', 'LookUpInit', 'UserList', 'TeamList', 'GetBasePath' ]; 


function CredentialsEdit ($scope, $rootScope, $compile, $location, $log, $routeParams, CredentialForm, 
                          GenerateForm, Rest, Alert, ProcessErrors, LoadBreadCrumbs, RelatedSearchInit, 
                          RelatedPaginateInit, ReturnToCaller, ClearScope, Prompt, GetBasePath) 
{
   ClearScope('htmlTemplate');  //Garbage collection. Don't leave behind any listeners/watchers from the prior
                                //scope.

   var defaultUrl=GetBasePath('credentials');
   var generator = GenerateForm;
   var form = CredentialForm;
   var scope = generator.inject(form, {mode: 'edit', related: true});
   generator.reset();
   var base = $location.path().replace(/^\//,'').split('/')[0];
   var defaultUrl = GetBasePath('credentials'); 
   
   var master = {};
   var id = $routeParams.credential_id;
   var relatedSets = {}; 
   

   function setAskCheckboxes() {
       for (var fld in form.fields) {
           if (form.fields[fld].type == 'password' && form.fields[fld].ask && scope[fld] == 'ASK') {
              // turn on 'ask' checkbox for password fields with value of 'ASK'
              $("#" + fld + "-clear-btn").attr("disabled","disabled");
              scope[fld + '_ask'] = true;
           }
           else {
              scope[fld + '_ask'] = false;
              $("#" + fld + "-clear-btn").removeAttr("disabled");
           }

       }
       } 

   // After Credential is loaded, retrieve each related set and any lookups
   if (scope.credentialLoadedRemove) {
      scope.credentialLoadedRemove();
   }
   scope.credentialLoadedRemove = scope.$on('credentialLoaded', function() {
       for (var set in relatedSets) {
           scope.search(relatedSets[set].iterator);
       }     
       });

   // Retrieve detail record and prepopulate the form
   Rest.setUrl(defaultUrl + ':id/'); 
   Rest.get({ params: {id: id} })
       .success( function(data, status, headers, config) {
           LoadBreadCrumbs({ path: '/credentials/' + id, title: data.name });
           for (var fld in form.fields) {
              if (data[fld]) {
                 scope[fld] = data[fld];
                 master[fld] = scope[fld];
              }
           }
           scope.team = data.team; 
           scope.user = data.user; 
           setAskCheckboxes();

           var related = data.related;
           for (var set in form.related) {
               if (related[set]) {
                  relatedSets[set] = { url: related[set], iterator: form.related[set].iterator };
               }
           }
           
           // Initialize related search functions. Doing it here to make sure relatedSets object is populated.
           RelatedSearchInit({ scope: scope, form: form, relatedSets: relatedSets });
           RelatedPaginateInit({ scope: scope, relatedSets: relatedSets });
           scope.$emit('credentialLoaded');
           })
       .error( function(data, status, headers, config) {
           ProcessErrors(scope, data, status, form,
                         { hdr: 'Error!', msg: 'Failed to retrieve Credential: ' + $routeParams.id + '. GET status: ' + status });
           });


   // Save changes to the parent
   scope.formSave = function() {
      Rest.setUrl(defaultUrl + id + '/');
      var data = {}
      for (var fld in form.fields) {
          data[fld] = scope[fld];   
      } 
      
      data.team = scope.team; 
      data.user = scope.user; 

      Rest.put(data)
          .success( function(data, status, headers, config) {
              var base = $location.path().replace(/^\//,'').split('/')[0];
              (base == 'credentials') ? ReturnToCaller() : ReturnToCaller(1);
              })
          .error( function(data, status, headers, config) {
              ProcessErrors(scope, data, status, form,
                            { hdr: 'Error!', msg: 'Failed to update Credential: ' + $routeParams.id + '. PUT status: ' + status });
              });
      };

   // Cancel
   scope.formReset = function() {
      generator.reset();
      for (var fld in master) {
          scope[fld] = master[fld];
      }
      setAskCheckboxes();
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
         $("#" + fld + "-clear-btn").attr("disabled","disabled");
         scope[fld] = 'ASK';
         scope[associated] = '';
         scope[form.name + '_form'][associated].$setValidity('awpassmatch', true);
      }
      else {
         $("#" + fld + "-clear-btn").removeAttr("disabled");
         scope[fld] = '';
         scope[associated] = '';
         scope[form.name + '_form'][associated].$setValidity('awpassmatch', true);
      }
      }

   scope.clear = function(fld, associated) {
      scope[fld] = '';
      scope[associated] = '';
      scope[form.name + '_form'][associated].$setValidity('awpassmatch', true);
      }

}

CredentialsEdit.$inject = [ '$scope', '$rootScope', '$compile', '$location', '$log', '$routeParams', 'CredentialForm', 
                            'GenerateForm', 'Rest', 'Alert', 'ProcessErrors', 'LoadBreadCrumbs', 'RelatedSearchInit', 
                            'RelatedPaginateInit', 'ReturnToCaller', 'ClearScope', 'Prompt', 'GetBasePath' ]; 
  