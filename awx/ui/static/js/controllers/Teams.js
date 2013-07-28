/************************************
 * Copyright (c) 2013 AnsibleWorks, Inc.
 *
 *
 *  Teams.js
 *  
 *  Controller functions for the Team model.
 *
 */

'use strict';

function TeamsList ($scope, $rootScope, $location, $log, $routeParams, Rest, Alert, TeamList,
                    GenerateList, LoadBreadCrumbs, Prompt, SearchInit, PaginateInit, ReturnToCaller,
                    ClearScope, ProcessErrors, SetTeamListeners, GetBasePath, SelectionInit)
{
    ClearScope('htmlTemplate');  //Garbage collection. Don't leave behind any listeners/watchers from the prior
                                 //scope.
    var list = TeamList;
    var defaultUrl = GetBasePath('teams');
    var view = GenerateList;
    var paths = $location.path().replace(/^\//,'').split('/');
    var mode = (paths[0] == 'teams') ? 'edit' : 'select';      // if base path 'teams', we're here to add/edit teams
    var scope = view.inject(list, { mode: mode });    // Inject our view
    scope.selected = [];
    
    var url = GetBasePath('base') + $location.path() + '/';
    SelectionInit({ scope: scope, list: list, url: url, returnToCaller: 1 });
    
    if (scope.PostRefreshRemove) {
       scope.PostRefreshRemove();
    }
    scope.PostRefershRemove = scope.$on('PostRefresh', function() {
         // After a refresh, populate the organization name on each row
        for( var i=0; i < scope.teams.length; i++) {
           scope.teams[i].organization_name = scope.teams[i].summary_fields.organization.name;  
        }
        });

    SearchInit({ scope: scope, set: 'teams', list: list, url: defaultUrl });
    PaginateInit({ scope: scope, list: list, url: defaultUrl });
    scope.search(list.iterator);

    LoadBreadCrumbs();
    
    scope.addTeam = function() {
       $location.path($location.path() + '/add');
       }

    scope.editTeam = function(id) {
       $location.path($location.path() + '/' + id);
       }
 
    scope.deleteTeam = function(id, name) {
       
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
    
    /*
    scope.lookupOrganization = function(organization_id) {
       Rest.setUrl(GetBasePath('organizations') + organization_id + '/');
       Rest.get()
           .success( function(data, status, headers, config) {
               return data.name;
               });
       }
    */
    
}

TeamsList.$inject = [ '$scope', '$rootScope', '$location', '$log', '$routeParams', 'Rest', 'Alert', 'TeamList', 'GenerateList', 
                      'LoadBreadCrumbs', 'Prompt', 'SearchInit', 'PaginateInit', 'ReturnToCaller', 'ClearScope', 'ProcessErrors',
                       'SetTeamListeners', 'GetBasePath', 'SelectionInit'];


function TeamsAdd ($scope, $rootScope, $compile, $location, $log, $routeParams, TeamForm, 
                   GenerateForm, Rest, Alert, ProcessErrors, LoadBreadCrumbs, ReturnToCaller, ClearScope,
                   GenerateList, OrganizationList, SearchInit, PaginateInit, GetBasePath, LookUpInit) 
{
   ClearScope('htmlTemplate');  //Garbage collection. Don't leave behind any listeners/watchers from the prior
                                //scope.

   // Inject dynamic view
   var defaultUrl = GetBasePath('teams');
   var form = TeamForm;
   var generator = GenerateForm;
   var scope = generator.inject(form, {mode: 'add', related: false});
   $rootScope.flashMessage = null;
   generator.reset();
   LoadBreadCrumbs();
   
   LookUpInit({
       scope: scope,
       form: form,
       current_item: null,
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
      Rest.post(data)
          .success( function(data, status, headers, config) {
              $rootScope.flashMessage = "New team successfully created!";
              $location.path('/teams/' + data.id);
              })
          .error( function(data, status, headers, config) {
              ProcessErrors(scope, data, status, form,
                            { hdr: 'Error!', msg: 'Failed to add new team. Post returned status: ' + status });
              });
      };

   // Reset
   scope.formReset = function() {
      // Defaults
      generator.reset();
      }; 
}

TeamsAdd.$inject = [ '$scope', '$rootScope', '$compile', '$location', '$log', '$routeParams', 'TeamForm', 'GenerateForm', 
                     'Rest', 'Alert', 'ProcessErrors', 'LoadBreadCrumbs', 'ReturnToCaller', 'ClearScope', 'GenerateList',
                     'OrganizationList', 'SearchInit', 'PaginateInit', 'GetBasePath', 'LookUpInit' ]; 


function TeamsEdit ($scope, $rootScope, $compile, $location, $log, $routeParams, TeamForm, 
                    GenerateForm, Rest, Alert, ProcessErrors, LoadBreadCrumbs, RelatedSearchInit, 
                    RelatedPaginateInit, ReturnToCaller, ClearScope, LookUpInit, Prompt, 
                    GetBasePath, CheckAccess, OrganizationList) 
{
   ClearScope('htmlTemplate');  //Garbage collection. Don't leave behind any listeners/watchers from the prior
                                //scope.

   var defaultUrl=GetBasePath('teams');
   var generator = GenerateForm;
   var form = TeamForm;
   var scope = generator.inject(form, {mode: 'edit', related: true});
   generator.reset();
   
   var base = $location.path().replace(/^\//,'').split('/')[0];
   var master = {};
   var id = $routeParams.team_id;
   var relatedSets = {}; 
   
   // Retrieve each related set and any lookups
   if (scope.teamLoadedRemove) {
      scope.teamLoadedRemove();
   }
   scope.teamLoadedRemove = scope.$on('teamLoaded', function() {
       Rest.setUrl(scope['organization_url']);
       Rest.get()
           .success( function(data, status, headers, config) {
               scope['organization_name'] = data.name;
               master['organization_name'] = data.name;
               })
           .error( function(data, status, headers, config) {
               ProcessErrors(scope, data, status, null,
                             { hdr: 'Error!', msg: 'Failed to retrieve: ' + scope.orgnization_url + '. GET status: ' + status });
               });
       for (var set in relatedSets) {
           scope.search(relatedSets[set].iterator);
       }       
       });

   // Retrieve detail record and prepopulate the form
   Rest.setUrl(defaultUrl + ':id/'); 
   Rest.get({ params: {id: id} })
       .success( function(data, status, headers, config) {
           LoadBreadCrumbs({ path: '/teams/' + id, title: data.name });
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
           // Initialize related search functions. Doing it here to make sure relatedSets object is populated.
           RelatedSearchInit({ scope: scope, form: form, relatedSets: relatedSets });
           RelatedPaginateInit({ scope: scope, relatedSets: relatedSets });

           LookUpInit({
             scope: scope,
             form: form,
             current_item: data['organization'],
             list: OrganizationList, 
             field: 'organization' 
             });

           scope['organization_url'] = data.related.organization;
           scope.$emit('teamLoaded');
           })
       .error( function(data, status, headers, config) {
           ProcessErrors(scope, data, status, form,
               { hdr: 'Error!', msg: 'Failed to retrieve team: ' + $routeParams.team_id + '. GET status: ' + status });
           });

   // Save changes to the parent
   scope.formSave = function() {
      $rootScope.flashMessage = null;
      Rest.setUrl(defaultUrl + $routeParams.team_id +'/');
      var data = {}
      for (var fld in form.fields) {
          data[fld] = scope[fld];   
      } 
      Rest.put(data)
          .success( function(data, status, headers, config) {
              var base = $location.path().replace(/^\//,'').split('/')[0];
              (base == 'teams') ? ReturnToCaller() : ReturnToCaller(1);
              })
          .error( function(data, status, headers, config) {
              ProcessErrors(scope, data, status, form,
                  { hdr: 'Error!', msg: 'Failed to update team: ' + $routeParams.team_id + '. PUT status: ' + status });
              });
      };

   // Cancel
   scope.formReset = function() {
      $rootScope.flashMessage = null;
      generator.reset();
      for (var fld in master) {
          scope[fld] = master[fld];
      }
      };

   // Related set: Add button
   scope.add = function(set) {
      $rootScope.flashMessage = null;
      if (set == 'permissions') {
         if (CheckAccess()) {
            $location.path('/' + base + '/' + $routeParams.team_id + '/' + set + '/add');
         }
      }
      else {
         $location.path('/' + base + '/' + $routeParams.team_id + '/' + set);  
      }
      };

   // Related set: Edit button
   scope.edit = function(set, id, name) {
      $rootScope.flashMessage = null;
      if (set == 'permissions') {
         if (CheckAccess()) {  
            $location.path('/' + base + '/' + $routeParams.team_id + '/' + set + '/' + id);   
          }
      }
      else {
         $location.path('/' + set + '/' + id);
      }
      };

   // Related set: Delete button
   scope['delete'] = function(set, itm_id, name, title) {
      $rootScope.flashMessage = null;
      
      var action = function() {
          var url;
          if (set == 'permissions') {
              if (CheckAccess()) {
                 url = GetBasePath('base') + 'permissions/' + itm_id + '/';
                 Rest.setUrl(url);
                 Rest.destroy()
                     .success( function(data, status, headers, config) {
                         $('#prompt-modal').modal('hide');
                             scope.search(form.related[set].iterator);
                             })
                       .error( function(data, status, headers, config) {
                        $('#prompt-modal').modal('hide');
                        ProcessErrors(scope, data, status, null,
                            { hdr: 'Error!', msg: 'Call to ' + url + ' failed. DELETE returned status: ' + status });
                        });
              }    
          }
          else {
              var url = defaultUrl + $routeParams.team_id + '/' + set + '/';
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
          }
          };

      Prompt({ hdr: 'Delete', 
               body: 'Are you sure you want to remove ' + name + ' from ' + scope.name + ' ' + title + '?',
               action: action
               });
      }

}

TeamsEdit.$inject = [ '$scope', '$rootScope', '$compile', '$location', '$log', '$routeParams', 'TeamForm', 
                      'GenerateForm', 'Rest', 'Alert', 'ProcessErrors', 'LoadBreadCrumbs', 'RelatedSearchInit', 
                      'RelatedPaginateInit', 'ReturnToCaller', 'ClearScope', 'LookUpInit', 'Prompt',
                      'GetBasePath', 'CheckAccess', 'OrganizationList'
                      ]; 
  
