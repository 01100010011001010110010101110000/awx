/*********************************************
 *  Copyright (c) 2013 AnsibleWorks, Inc.
 *
 * Custom directives for form validation 
 *
 */

var INTEGER_REGEXP = /^\-?\d*$/;


angular.module('AWDirectives', ['RestServices'])
    // awpassmatch:  Add to password_confirm field. Will test if value
    //               matches that of 'input[name="password"]'
    .directive('awpassmatch', function() {
        return {
        require: 'ngModel',
        link: function(scope, elm, attrs, ctrl) {
            ctrl.$parsers.unshift( function(viewValue) {
                var associated = attrs.awpassmatch;
                var password = $('input[name="' + associated + '"]').val(); 
                if (viewValue == password) {
                   // it is valid
                   ctrl.$setValidity('awpassmatch', true);
                   return viewValue;
                } else {
                   // it is invalid, return undefined (no model update)
                   ctrl.$setValidity('awpassmatch', false);
                   return undefined;
                }
                });
            }
        }
        })
    
    // caplitalize  Add to any input field where the first letter of each
    //              word should be capitalized. Use in place of css test-transform.
    //              For some reason "text-transform: capitalize" in breadcrumbs
    //              causes a break at each blank space. And of course, 
    //              "autocapitalize='word'" only works in iOS. Use this as a fix.
    .directive('capitalize', function() {
        return {
        require: 'ngModel',
        link: function(scope, elm, attrs, ctrl) {
            ctrl.$parsers.unshift( function(viewValue) {
                var values = viewValue.split(" ");
                var result = "";
                for (i = 0; i < values.length; i++){
                    result += values[i].charAt(0).toUpperCase() + values[i].substr(1) + ' ';
                }
                result = result.trim();
                if (result != viewValue) {
                   ctrl.$setViewValue(result);
                   ctrl.$render();
                }
                return result;
                });
            }
        }
        })

    // integer  Validate that input is of type integer. Taken from Angular developer
    //          guide, form examples. Add min and max directives, and this will check
    //          entered values is within the range.
    //
    //          Use input type of 'text'. Use of 'number' casuses browser validation to
    //          override/interfere with this directive.
    .directive('integer', function() {
        return {
        require: 'ngModel',
        link: function(scope, elm, attrs, ctrl) {
            ctrl.$parsers.unshift(function(viewValue) {
                ctrl.$setValidity('min', true);
                ctrl.$setValidity('max', true);
                if (INTEGER_REGEXP.test(viewValue)) {
                   // it is valid
                   ctrl.$setValidity('integer', true);
                   if ( elm.attr('min') &&
                        ( viewValue == '' || viewValue == null || parseInt(viewValue) < parseInt(elm.attr('min')) ) ) {
                      ctrl.$setValidity('min', false);
                      return undefined;  
                   }
                   if ( elm.attr('max') && ( parseInt(viewValue) > parseInt(elm.attr('max')) ) ) {
                      ctrl.$setValidity('max', false);
                      return undefined;  
                   }
                   return viewValue;
                } else {
                  // it is invalid, return undefined (no model update)
                  ctrl.$setValidity('integer', false);
                  return undefined;
                }
                });
            }
        }
        })

    // lookup   Validate lookup value against API
    //           
    .directive('awlookup', ['Rest', function(Rest) {
        return {
        require: 'ngModel',
        link: function(scope, elm, attrs, ctrl) {
            ctrl.$parsers.unshift( function(viewValue) {
                if (viewValue !== '') {
                   url = elm.attr('data-url');
                   url = url.replace(/\:value/,escape(viewValue));
                   scope[elm.attr('data-source')] = null;
                   Rest.setUrl(url);
                   Rest.get().then( function(data) {
                       var results = data.data.results;
                       if (results.length > 0) {
                          scope[elm.attr('data-source')] = results[0].id;
                          scope[elm.attr('name')] = results[0].name;
                          ctrl.$setValidity('required', true); 
                          ctrl.$setValidity('awlookup', true);
                          return viewValue;
                       }
                       else {
                          ctrl.$setValidity('required', true); 
                          ctrl.$setValidity('awlookup', false);
                          return undefined;
                       }
                       });
                
                }
                else {
                   ctrl.$setValidity('awlookup', true);
                   scope[elm.attr('data-source')] = null;
                }
                })
            }
        }
        }]);

