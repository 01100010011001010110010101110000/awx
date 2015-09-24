/*************************************************
 * Copyright (c) 2015 Ansible, Inc.
 *
 * All Rights Reserved
 *************************************************/

  /**
 * @ngdoc function
 * @name helpers.function:Access
 * @description  routines checking user access
*/


export default
    ['$rootScope', 'Alert', 'Rest', 'GetBasePath', 'ProcessErrors', '$cookieStore',
    function ($rootScope, Alert, Rest, GetBasePath, ProcessErrors, $cookieStore) {
        return function (params) {
            // set PermissionAddAllowed to true or false based on user access. admins and org admins are granted
            // accesss.
            var scope = params.scope,
                callback = params.callback || undefined,
                me;

            // uer may have refreshed the browser, in which case retrieve current user info from session cookie
            me = ($rootScope.current_user) ? $rootScope.current_user : $cookieStore.get('current_user');

            if (me.is_superuser) {
                scope.PermissionAddAllowed = true;
                if(callback){
                    scope.$emit(callback);
                }
            } else {
                if (me.related.admin_of_organizations) {
                    Rest.setUrl(me.related.admin_of_organizations);
                    Rest.get()
                        .success(function (data) {
                            if (data.results.length > 0) {
                                scope.PermissionAddAllowed = true;
                            } else {
                                scope.PermissionAddAllowed = false;
                            }
                            if(callback){
                                scope.$emit(callback);
                            }
                        })
                        .error(function (data, status) {
                            ProcessErrors(scope, data, status, null, {
                                hdr: 'Error!',
                                msg: 'Call to ' + me.related.admin_of_organizations +
                                    ' failed. DELETE returned status: ' + status
                            });
                        });
                }
            }

            //if (!access) {
            //   Alert('Access Denied', 'You do not have access to this function. Please contact your system administrator.');
            //}
            //return access;
        };
    }];
