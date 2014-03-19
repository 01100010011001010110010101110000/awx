/*********************************************
 *  Copyright (c) 2014 AnsibleWorks, Inc.
 *
 *  VariablesHelper
 *
 *  Show the CodeMirror variable editor and allow
 *  toggle between JSON and YAML
 *
 */

'use strict';

angular.module('VariablesHelper', ['Utilities'])
    
    /**
     variables: string containing YAML or JSON | a JSON object. 

     If JSON string, convert to JSON object and run through jsyaml.safeDump() to create a YAML document. If YAML,
     will attempt to load via jsyaml.safeLoad() and return a YAML document using jsyaml.safeDump(). In all cases
     a YAML document is returned.
    **/
    .factory('ParseVariableString', ['$log', 'ProcessErrors', function ($log, ProcessErrors) {
        return function (variables) {
            var result = "---", json_obj;
            if (typeof variables === 'string') {
                if (variables === "{}" || variables === "null" || variables === "") {
                    // String is empty, return ---
                } else {
                    try {
                        json_obj = JSON.parse(variables);
                        result = jsyaml.safeDump(json_obj);
                    }
                    catch (e) {
                        $log.info('Attempt to parse extra_vars as JSON faild. Attempting to parse as YAML');
                        try {
                            json_obj = jsyaml.safeLoad(variables);
                            result = jsyaml.safeDump(json_obj);
                        }
                        catch(e2) {
                            ProcessErrors(null, variables, e2.message, null, { hdr: 'Error!',
                                msg: 'Attempts to parse variables as JSON and YAML failed. Last attempt returned: ' + e2.message });
                        }
                    }
                }
            }
            else {
                if ($.isEmptyObject(variables) || variables === null) {
                    // Empty object, return ---
                }
                else {
                    // convert object to yaml
                    try {
                        result = jsyaml.safeDump(variables);
                    }
                    catch(e3) {
                        ProcessErrors(null, variables, e3.message, null, { hdr: 'Error!',
                            msg: 'Attempt to convert JSON object to YAML document failed: ' + e3.message });
                    }
                }
            }
            return result;
        };
    }])

    /**
     parseType: 'json' | 'yaml'
     variables: string containing JSON or YAML
     stringify: optional, boolean

     Parse the given string according to the parseType to a JSON object. If stringify true,
     stringify the object and return the string. Otherwise, return the JSON object.

     **/
    .factory('ToJSON', ['$log', 'ProcessErrors', function($log, ProcessErrors) {
        return function(parseType, variables, stringify) {
            var json_data, result;
            if (parseType === 'json') {
                try {
                    json_data = JSON.parse(variables); //make sure JSON parses
                }
                catch(e) {
                    json_data = {};
                    $log.error('Failed to parse JSON string. Parser returned: ' + e.message);
                    ProcessErrors(null, variables, e.message, null, { hdr: 'Error!',
                        msg: 'Failed to parse JSON string. Parser returned: ' + e.message });
                }
            } else {
                try {
                    json_data = jsyaml.load(variables);
                }
                catch(e) {
                    json_data = {};
                    $log.error('Failed to parse YAML string. Parser returned: ' + e.message);
                    ProcessErrors(null, variables, e.message, null, { hdr: 'Error!',
                        msg: 'Failed to parse YAML string. Parser returned: ' + e.message });
                }
            }
            // Make sure our JSON is actually an object
            if (typeof json_data !== 'object') {
                ProcessErrors(null, variables, null, null, { hdr: 'Error!',
                    msg: 'Failed to parse variables. Attempted to parse ' + parseType + ' Parser did not return an object.' });
                setTimeout( function() {
                    throw { name: 'Parse error', message: 'Failed to parse variables. Attempted to parse ' + parseType + ' Parser did not return an object.' };
                }, 1000);
            }
            result = json_data;
            if (stringify) {
                if ($.isEmptyObject(json_data)) {
                    result = "";
                } else {
                    result = JSON.stringify(json_data, undefined, '\t');
                }
            }
            return result;
        };
    }]);