/************************************
 * Copyright (c) 2013 AnsibleWorks, Inc.
 *
 * Our main application mdoule. Declare application routes and perform initialization chores.
 *
 */
 
var urlPrefix = '/static/';
 
angular.module('ansible', [
    'RestServices',
    'AuthService',
    'Utilities',
    'OrganizationFormDefinition', 
    'UserFormDefinition',
    'FormGenerator',
    'OrganizationListDefinition',
    'UserListDefinition', 
    'ListGenerator', 
    'AWToolTip', 
    'PromptDialog',
    'ApiLoader', 
    'RelatedSearchHelper', 
    'RelatedPaginateHelper',
    'SearchHelper',
    'PaginateHelper',
    'RefreshHelper',
    'AdminListDefinition',
    'AWDirectives',
    'InventoriesListDefinition',
    'InventoryFormDefinition',
    'InventoryHelper',
    'AWFilters',
    'HostFormDefinition',
    'HostListDefinition',
    'GroupFormDefinition',
    'GroupListDefinition',
    'TeamsListDefinition',
    'TeamFormDefinition',
    'TeamHelper',
    'CredentialsListDefinition',
    'CredentialFormDefinition',
    'LookUpHelper',
    'JobTemplatesListDefinition',
    'JobTemplateFormDefinition',
    'JobTemplateHelper',
    'ProjectsListDefinition',
    'JobsListDefinition',
    'JobFormDefinition',
    'JobEventFormDefinition'
     ])
    .config(['$routeProvider', function($routeProvider) {
        $routeProvider.
            when('/jobs',
                { templateUrl: urlPrefix + 'partials/jobs.html', controller: JobsListCtrl }).

            when('/jobs/:id',
                { templateUrl: urlPrefix + 'partials/jobs.html', controller: JobsEdit }).

            when('/jobs/:id/job_events',
                { templateUrl: urlPrefix + 'partials/jobs.html', controller: JobEvents }).
            
            when('/job_templates',
                { templateUrl: urlPrefix + 'partials/job_templates.html', controller: JobTemplatesList }).
            
            when('/job_templates/add',
                { templateUrl: urlPrefix + 'partials/job_templates.html', controller: JobTemplatesAdd }).

            when('/job_templates/:id', 
                { templateUrl: urlPrefix + 'partials/job_templates.html', controller: JobTemplatesEdit }).

            when('/projects', 
                { templateUrl: urlPrefix + 'partials/projects.html', controller: ProjectsList }).

            when('/inventories', 
                { templateUrl: urlPrefix + 'partials/inventories.html', controller: InventoriesList }).

            when('/inventories/add', 
                { templateUrl: urlPrefix + 'partials/inventories.html', controller: InventoriesAdd }).

            when('/inventories/:id', 
                { templateUrl: urlPrefix + 'partials/inventories.html', controller: InventoriesEdit }).

            when('/inventories/:inventory_id/hosts',
                { templateUrl: urlPrefix + 'partials/inventories.html', controller: HostsList }).

            when('/inventories/:inventory_id/hosts/add', 
                { templateUrl: urlPrefix + 'partials/inventories.html', controller: HostsAdd }).

            when('/inventories/:inventory_id/hosts/:host_id', 
                { templateUrl: urlPrefix + 'partials/inventories.html', controller: HostsEdit }).

            when('/inventories/:inventory_id/groups',
                { templateUrl: urlPrefix + 'partials/inventories.html', controller: GroupsList }).

            when('/inventories/:inventory_id/groups/add',
                { templateUrl: urlPrefix + 'partials/inventories.html', controller: GroupsAdd }).

            when('/inventories/:inventory_id/groups/:group_id',
                { templateUrl: urlPrefix + 'partials/inventories.html', controller: GroupsEdit }).

            when('/inventories/:inventory_id/groups/:group_id/children',
                { templateUrl: urlPrefix + 'partials/inventories.html', controller: GroupsList }).

            when('/inventories/:inventory_id/groups/:group_id/children/add',
                { templateUrl: urlPrefix + 'partials/inventories.html', controller: GroupsAdd }).

            when('/inventories/:inventory_id/groups/:group_id/children/:child_id', 
                { templateUrl: urlPrefix + 'partials/inventories.html', controller: GroupsEdit }).

            when('/inventories/:inventory_id/groups/:group_id/hosts',
                { templateUrl: urlPrefix + 'partials/inventories.html', controller: HostsList }).

            when('/inventories/:inventory_id/groups/:group_id/hosts/add',
                { templateUrl: urlPrefix + 'partials/inventories.html', controller: HostsAdd }).

            when('/inventories/:inventory_id/groups/:group_id/hosts/:host_id',
                { templateUrl: urlPrefix + 'partials/inventories.html', controller: HostsEdit }).

            when('/organizations', { templateUrl: urlPrefix + 'partials/organizations.html',
                                     controller: OrganizationsList }).

            when('/organizations/add', { templateUrl: urlPrefix + 'partials/organizations.html',
                                         controller: OrganizationsAdd }).

            when('/organizations/:id', { templateUrl: urlPrefix + 'partials/organizations.html',
                                         controller: OrganizationsEdit }).

            when('/organizations/:id/admins', { templateUrl: urlPrefix + 'partials/organizations.html',
                                                controller: AdminsList }).

            when('/organizations/:id/users', { templateUrl: urlPrefix + 'partials/users.html',
                                               controller: UsersList }).

            when('/organizations/:id/users/add', { templateUrl: urlPrefix + 'partials/users.html',
                                                   controller: UsersAdd }).

            when('/organizations/:organization_id/users/:id', { templateUrl: urlPrefix + 'partials/users.html',
                                                                controller: UsersEdit }).

            when('/teams', { templateUrl: urlPrefix + 'partials/teams.html',
                             controller: TeamsList }).

            when('/teams/add', { templateUrl: urlPrefix + 'partials/teams.html',
                                 controller: TeamsAdd }).

            when('/teams/:id', { templateUrl: urlPrefix + 'partials/teams.html',
                                 controller: TeamsEdit }).

            when('/teams/:id/users', { templateUrl: urlPrefix + 'partials/teams.html',
                                       controller: UsersList }).

            when('/teams/:organization_id/users/:id', { templateUrl: urlPrefix + 'partials/teams.html',
                                                        controller: UsersEdit }).

            when('/credentials', { templateUrl: urlPrefix + 'partials/credentials.html',
                                   controller: CredentialsList }).

            when('/credentials/add', { templateUrl: urlPrefix + 'partials/credentials.html',
                                       controller: CredentialsAdd }).

            when('/credentials/:id', { templateUrl: urlPrefix + 'partials/credentials.html',
                                       controller: CredentialsEdit }).
            
            when('/users', { templateUrl: urlPrefix + 'partials/users.html',
                             controller: UsersList }).

            when('/users/add', { templateUrl: urlPrefix + 'partials/users.html',
                                 controller: UsersAdd }).

            when('/users/:id', { templateUrl: urlPrefix + 'partials/users.html',
                                 controller: UsersEdit }).

            when('/login', { templateUrl: urlPrefix + 'partials/login-dialog.html', controller: Authenticate }). 

            when('/logout', { templateUrl: urlPrefix + 'partials/login-dialog.html', controller: Authenticate }).
            
            otherwise({redirectTo: '/'});
    }])
    .run(['$rootScope', '$location', 'Authorization','LoadBasePaths', 
         function($rootScope, $location, Authorization, LoadBasePaths) {
        
        LoadBasePaths(); 

        $rootScope.breadcrumbs = new Array(); 
        $rootScope.crumbCache = new Array();

        $rootScope.$on("$routeChangeStart", function(event, next, current) {
            // Evaluate the token on each navigation request. Redirect to login page when not valid
            if (Authorization.isTokenValid() == false) {
               if ( next.templateUrl != (urlPrefix + 'partials/login.html') ) {
                  $location.path('/login');
               }
            }
            else {
               if ($rootScope.current_user == undefined || $rootScope.current_user == null) {
                  Authorization.restoreUserInfo();   //user must have hit browser refresh 
               }
            }
        });

        if (! Authorization.isTokenValid() ) {
           // When the app first loads, redirect to login page
           $location.path('/login');
        }

        // If browser refresh, activate the correct tab
        var base = ($location.path().replace(/^\//,'').split('/')[0]);
        if  (base == '') {
            base = 'organizations';
            $location.path('/organizations');
            $('.nav-tabs a[href="#' + base + '"]').tab('show');
        }
        else {
            base.replace(/\_/g,' ');
            $('.nav-tabs a[href="#' + base + '"]').tab('show');
        }     
    }]);
