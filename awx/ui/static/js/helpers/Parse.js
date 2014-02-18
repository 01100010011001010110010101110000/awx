/*********************************************
 *  Copyright (c) 2014 AnsibleWorks, Inc.
 *
 *  ParseHelper
 *
 *  Show the CodeMirror variable editor and allow
 *  toggle between JSON and YAML
 *
 */

'use strict';

angular.module('ParseHelper', ['Utilities', 'AngularCodeMirrorModule'])
    .factory('ParseTypeChange', ['Alert', 'AngularCodeMirror', function (Alert, AngularCodeMirror) {
        return function (params) {
        
            var scope = params.scope,
                field_id = params.field_id,
                fld = (params.variable) ? params.variable : 'variables',
                pfld = (params.parse_variable) ? params.parse_variable : 'parseType',
                onReady = params.onReady,
                onChange = params.onChange,
                codeMirror;
        
            function removeField() {
                //set our model to the last change in CodeMirror and then destroy CodeMirror
                scope[fld] = codeMirror.getValue();
                codeMirror.destroy();
            }

            function createField(onChange, onReady) {
                //hide the textarea and show a fresh CodeMirror with the current mode (json or yaml)
                codeMirror = AngularCodeMirror();
                codeMirror.addModes($AnsibleConfig.variable_edit_modes);
                codeMirror.showTextArea({ scope: scope, model: fld, element: field_id, mode: scope[pfld], onReady: onReady, onChange: onChange });
            }


            // Hide the textarea and show a CodeMirror editor
            createField(onChange, onReady);


            // Toggle displayed variable string between JSON and YAML
            scope.parseTypeChange = function() {
                var json_obj;
                if (scope[pfld] === 'json') {
                    // converting yaml to json
                    try {
                        removeField();
                        json_obj = jsyaml.load(scope[fld]);
                        if ($.isEmptyObject(json_obj)) {
                            scope[fld] = "{}";
                        }
                        else {
                            scope[fld] = JSON.stringify(json_obj, null, " ");
                        }
                        createField();
                    }
                    catch (e) {
                        Alert('Parse Error', 'Failed to parse valid YAML. ' + e.message);
                        setTimeout( function() { scope.$apply( function() { scope[pfld] = 'yaml'; createField(); }); }, 500);
                    }
                }
                else {
                    // convert json to yaml
                    try {
                        removeField();
                        json_obj = JSON.parse(scope[fld]);
                        if ($.isEmptyObject(json_obj)) {
                            scope[fld] = '---';
                        }
                        else {
                            scope[fld] = jsyaml.safeDump(json_obj);
                        }
                        createField();
                    }
                    catch (e) {
                        Alert('Parse Error', 'Failed to parse valid JSON. ' + e.message);
                        setTimeout( function() { scope.$apply( function() { scope[pfld] = 'json'; createField(); }); }, 500 );
                    }
                }
            };
        };
    }
]);