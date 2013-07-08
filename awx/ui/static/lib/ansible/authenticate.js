/*********************************************
 *  Copyright (c) 2013 AnsibleWorks, Inc.
 *
 * User authentication functions
 *
 */

angular.module('AuthService', ['ngCookies'])
   .factory('Authorization', ['$http', '$rootScope', '$location', '$cookieStore', function($http, $rootScope, $location, $cookieStore) {
   return {
       setToken: function(token) {
           // set the session cookie
           var today = new Date();
           today.setTime(today.getTime() + ($AnsibleConfig.session_timeout * 1000));
           $cookieStore.remove('token');
           $cookieStore.remove('token_expire');
           $cookieStore.put('token', token);
           $cookieStore.put('token_expire', today.getTime());
           $rootScope.userLoggedIn = true;
           },

       isTokenValid: function() {
           // check if token exists and is not expired
           var response = false;
           if ( $cookieStore.get('token') && $cookieStore.get('token_expire') ) {
              var token = $cookieStore.get('token');
              var exp = new Date($cookieStore.get('token_expire'));
              var today = new Date();
              if (today < exp) {
                 this.setToken(token);  //push expiration into the future while user is active
                 response = true;
              }
           }
           return response;
           },

       didSessionExpire: function() {
           // use only to test why user was sent to login page. 
           var response = false;
           if ($cookieStore.get('token_expire')) {
              var exp = new Date($cookieStore.get('token_expire'));
              var today = new Date();
              if (exp < today) {
                 response = true;
              }
           }
           return response;
       },
       
       getToken: function() {
           if ( this.isTokenValid() ) {
              return $cookieStore.get('token');
           }
           else {
              return null;
           }
       },

       retrieveToken: function(username, password) {
           return $http({ method: 'POST', url: '/api/v1/authtoken/', 
                          data: {"username": username, "password": password} });
           },
       
       logout: function() {
           $rootScope.current_user = {};
           $rootScope.license_tested = undefined;
           $cookieStore.remove('token'); 
           $cookieStore.remove('token_expire');
           $cookieStore.remove('current_user');
           $rootScope.userLoggedIn = false;
           },
  
       getLicense: function() {
           return $http({
               method: 'GET',
               url: '/api/v1/config/',
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

