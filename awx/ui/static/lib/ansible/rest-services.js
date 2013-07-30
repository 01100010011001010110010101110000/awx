/*********************************************
 *  Copyright (c) 2013 AnsibleWorks, Inc.
 *
 * Generic accessor for Ansible Commander services
 *
 */
angular.module('RestServices',['ngCookies','AuthService'])
    .factory('Rest', ['$http','$rootScope','$cookieStore','Authorization', function($http, $rootScope, $cookieStore, Authorization) {
    return {

    setUrl: function (url) {
        this.url = url;
        },

    //auth: { 'Authorization': 'Token ' + Authorization.getToken() },
    auth: function() {
        var token = Authorization.getToken();
        return { 'Authorization': 'Token ' + token }
        },
    
    pReplace: function() {
        //in our url, replace :xx params with a value, assuming
        //we can find it in user supplied params.
        var key,rgx;
        for (key in this.params) {
          rgx = new RegExp("\\:" + key,'gm'); 
          if (rgx.test(this.url)) {
             this.url = this.url.replace(rgx,this.params[key]);
             delete this.params[key];
          }
        }
        },
    
    get: function(args) {
        args = (args) ? args : {};
        this.params = (args.params) ? args.params : null;
        this.pReplace();
        return $http({method: 'GET', 
                      url: this.url,
                      headers: this.auth(),
                      params: this.params
                      });
        },
    post: function(data) {
        return $http({method: 'POST', 
                      url: this.url,
                      headers: this.auth(), 
                      data: data });
        },
    put: function(data) {
        return $http({method: 'PUT', 
                      url: this.url,
                      headers: this.auth(), 
                      data: data });

        },
    destroy: function(data) {
        return $http({method: 'DELETE',
                      url: this.url,
                      headers: this.auth(),
                      data: data});
        }
    }
}]);

