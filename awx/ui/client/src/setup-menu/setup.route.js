import {templateUrl} from '../shared/template-url/template-url.factory';
import { N_ } from '../i18n';

export default {
    name: 'setup',
    route: '/setup',
    ncyBreadcrumb: {
        label: N_("SETTINGS")
    },
    templateUrl: templateUrl('setup-menu/setup-menu'),
    controller: function(orgAdmin, $scope){
        $scope.orgAdmin = orgAdmin;
    },
    resolve: {
        orgAdmin:
            ['$rootScope', 'ProcessErrors', 'Rest', 'GetBasePath',
            function($rootScope, ProcessErrors, Rest, GetBasePath){

                return $rootScope.loginConfig.promise.then(function () {
                    if($rootScope.current_user.related.admin_of_organizations){
                    $rootScope.orgAdmin = false;
                    if ($rootScope.current_user.is_superuser) {
                        return true;
                    } else {
                        Rest.setUrl(GetBasePath('users') + `${$rootScope.current_user.id}/admin_of_organizations`);
                        return Rest.get().then(function(data){
                            if(data.data.count){
                                return true;
                            }
                            else{
                                return false;
                            }
                        })
                        .catch(function (data, status) {
                            ProcessErrors($rootScope, data, status, null, { hdr: 'Error!', msg: 'Failed to find if users is admin of org' + status });
                        });
                    }
                }
                else{
                    return false;
                }
            });
        }]
    }
};
