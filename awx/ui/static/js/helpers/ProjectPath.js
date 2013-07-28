/*********************************************
 *  Copyright (c) 2013 AnsibleWorks, Inc.
 *
 *  ProjectPathHelper
 *
 *  Use GetProjectPath({ scope: <scope>, master: <master obj> }) to 
 *  load scope.project_local_paths (array of options for drop-down) and
 *  scope.base_dir (readonly field). 
 *
 */

angular.module('ProjectPathHelper', ['RestServices', 'Utilities'])  
    .factory('GetProjectPath', ['Alert', 'Rest', 'GetBasePath','ProcessErrors',
    function(Alert, Rest, GetBasePath, ProcessErrors) {
    return function(params) {
        
        var scope = params.scope;
        var master = params.master; 

        Rest.setUrl( GetBasePath('config') );
        Rest.get()
            .success( function(data, status, headers, config) {
                var opts = [];
                for (var i=0; i < data.project_local_paths.length; i++) {
                   opts.push(data.project_local_paths[i]);
                } 
                if (scope.local_path) {
                   opts.push(scope.local_path);
                }
                scope.project_local_paths = opts;
                scope.base_dir = data.project_base_dir;
                master.base_dir = scope.base_dir;  // Keep in master object so that it doesn't get
                                                   // wiped out on form reset.
                if (opts.length == 0) {
                   Alert('Missing Playbooks',
                       '<p>There are no unassigned playbook directories in the base project path (' + scope.base_dir + '). ' + 
                       'Either the project directory is empty, or all of the contents are already assigned to other AWX projects.</p>' +
                       '<p>To fix this, log into the AWX server and check out another playbook project from your SCM repository into ' + 
                       scope.base_dir + '. After checking out the project, run &quot;chown -R awx&quot; on the content directory to ' +
                       'ensure awx can read the playbooks.</p>', 'alert-info');
                }
                })
            .error( function(data, status, headers, config) {
                ProcessErrors(scope, data, status, null,
                   { hdr: 'Error!', msg: 'Failed to access API config. GET status: ' + status });
                });
        }
        }]);