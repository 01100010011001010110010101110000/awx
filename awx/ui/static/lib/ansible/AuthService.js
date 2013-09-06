/*********************************************
 *  Copyright (c) 2013 AnsibleWorks, Inc.
 *
 *  AuthService.js
 *
 *  User authentication functions
 */

angular.module('AuthService', ['ngCookies', 'Utilities'])
   .factory('Authorization', ['$http', '$rootScope', '$location', '$cookieStore', 'GetBasePath',
   function($http, $rootScope, $location, $cookieStore, GetBasePath) {
   return {
       setToken: function(token, expires) {
           // set the session cookie
           $cookieStore.remove('token');
           $cookieStore.remove('token_expires');
           $cookieStore.remove('userLoggedIn');
           $cookieStore.put('token', token);
           $cookieStore.put('token_expires', expires);
           $cookieStore.put('userLoggedIn', true);
           $cookieStore.put('sessionExpired', false);
           $rootScope.token = token;
           $rootScope.userLoggedIn = true;
           $rootScope.token_expires = expires;
           $rootScope.sessionExpired = false;
           },

       isUserLoggedIn: function() {
           if ($rootScope.userLoggedIn == undefined) {
              // Browser refresh may have occurred
              $rootScope.userLoggedIn = $cookieStore.get('userLoggedIn');
              $rootScope.sessionExpired = $cookieStore.get('sessionExpired');
           }
           return $rootScope.userLoggedIn;
           },

       getToken: function() {
           return ($rootScope.token) ? $rootScope.token : $cookieStore.get('token');
           },

       retrieveToken: function(username, password) {
           return $http({ method: 'POST', url: GetBasePath('authtoken'), 
                          data: {"username": username, "password": password} });
           },
       
       logout: function() {
           // the following puts our primary scope up for garbage collection, which
           // should prevent content flash from the prior user.
           var scope = angular.element(document.getElementById('main-view')).scope();
           scope.$destroy();
           $rootScope.$destroy();     
           $cookieStore.remove('accordions');
           $cookieStore.remove('token'); 
           $cookieStore.remove('token_expire');
           $cookieStore.remove('current_user');
           $cookieStore.put('userLoggedIn', false);
           $cookieStore.put('sessionExpired', false);
           $rootScope.current_user = {};
           $rootScope.license_tested = undefined;
           $rootScope.userLoggedIn = false;
           $rootScope.sessionExpired = false;
           $rootScope.token = null;
           $rootScope.token_expire = new Date(1970, 0, 1, 0, 0, 0, 0);
           },

       getLicense: function() {
           return $http({
               method: 'GET',
               url: GetBasePath('config'),
               headers: { 'Authorization': 'Token ' + this.getToken() }
               });
           },

       setLicense: function(license) {
           license['tested'] = false;
           $cookieStore.put('license', license);
           },

       licenseTested: function() {
           var result;
           if ($rootScope.license_tested !== undefined) {
              result = $rootScope.license_tested;
           }
           else {          
              var license = $cookieStore.get('license');
              if (license && license.tested !== undefined) {
                 result = license.tested;
              }
              else {
                 result = false;
              }
           }
           return result;
           },

       getUser:  function() {
           return $http({
               method: 'GET', 
               url: '/api/v1/me/',
               headers: { 'Authorization': 'Token ' + this.getToken() }
               });
           },

       setUserInfo: function(response) {
           // store the response values in $rootScope so we can get to them later
           $rootScope.current_user = response.results[0];
           $cookieStore.put('current_user', response.results[0]);    //keep in session cookie incase user hits refresh
           },

       restoreUserInfo: function() {
           $rootScope.current_user = $cookieStore.get('current_user');
           },

       getUserInfo: function(key) {
           // Access values returned from the Me API call
           return ($rootScope.current_user[key]) ? $rootScope.current_user[key] : null;
           }
    }
}]);

