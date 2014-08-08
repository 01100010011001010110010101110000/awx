/*********************************************
 *  Copyright (c) 2014 AnsibleWorks, Inc.
 *
 * Dashboard.js
 *
 * The new dashboard
 *
 */

'use strict';

angular.module('AboutAnsibleHelpModal', ['RestServices', 'Utilities','ModalDialog'])
    .factory('AboutAnsibleHelp', ['$rootScope', '$compile', '$location' , 'Rest', 'GetBasePath', 'ProcessErrors', 'Wait', 'CreateDialog',
        function ($rootScope, $compile , $location, Rest, GetBasePath, ProcessErrors, Wait, CreateDialog) {
            return function () {

                var scope= $rootScope.$new(),
                url;

                url = GetBasePath('config');
                Rest.setUrl(url);
                Rest.get()
                    .success(function (data){
                        scope.$emit('BuildAboutDialog', data);
                    })
                    .error(function (data, status) {
                        ProcessErrors(scope, data, status, null, { hdr: 'Error!',
                            msg: 'Failed to get: ' + url + ' GET returned: ' + status });
                    });


                if (scope.removeDialogReady) {
                    scope.removeDialogReady();
                }
                scope.removeDialogReady = scope.$on('DialogReady', function() {
                   // element = angular.element(document.getElementById('about-modal-dialog'));
                   // $compile(element)(scope);
                    $('#about-modal-dialog').dialog('open');
                });

                if (scope.removeBuildAboutDialog) {
                    scope.removeBuildAboutDialog();
                }
                scope.removeBuildAboutDialog = scope.$on('BuildAboutDialog', function(e, data) {
                    var spaces, i, j,
                    paddedStr  = "",
                    str = data.version;

                    if(str.search('-')){
                        str = str.substr(0,str.search('-'));
                    }
                    spaces = Math.floor((16-str.length)/2);
                    for( i=0; i<=spaces; i++){
                        paddedStr = paddedStr +" ";
                    }
                    paddedStr = paddedStr+str;
                    for( j = paddedStr.length; j<16; j++){
                        paddedStr = paddedStr + " ";
                    }
                    $('#about-modal-version').html(paddedStr);
                    CreateDialog({
                        id: 'about-modal-dialog',
                        scope: scope,
                        buttons: [],
                        width: 730,
                        height: 320,
                        minWidth: 300,
                        // title:  , //'<img src="static/img/tower_login_logo.png">' ,//'About Ansible',
                        callback: 'DialogReady'
                    });
                });

            };
        }
]);