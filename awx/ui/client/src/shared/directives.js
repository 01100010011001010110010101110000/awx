/*************************************************
 * Copyright (c) 2015 Ansible, Inc.
 *
 * All Rights Reserved
 *************************************************/


/**
 *  @ngdoc function
 *  @name shared.function:directives
 *  @description
 * Custom directives for form validation
 *
 */

export default
angular.module('AWDirectives', ['RestServices', 'Utilities', 'JobsHelper'])

// awpassmatch:  Add to password_confirm field. Will test if value
//               matches that of 'input[name="password"]'
.directive('awpassmatch', function() {
    return {
        require: 'ngModel',
        link: function(scope, elm, attrs, ctrl) {
            ctrl.$parsers.unshift(function(viewValue) {
                var associated = attrs.awpassmatch,
                    password = $('input[name="' + associated + '"]').val();
                if (viewValue === password) {
                    // it is valid
                    ctrl.$setValidity('awpassmatch', true);
                    return viewValue;
                }
                // Invalid, return undefined (no model update)
                ctrl.$setValidity('awpassmatch', false);
                return viewValue;
            });
        }
    };
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
            ctrl.$parsers.unshift(function(viewValue) {
                var values = viewValue.split(" "),
                    result = "",
                    i;
                for (i = 0; i < values.length; i++) {
                    result += values[i].charAt(0).toUpperCase() + values[i].substr(1) + ' ';
                }
                result = result.trim();
                if (result !== viewValue) {
                    ctrl.$setViewValue(result);
                    ctrl.$render();
                }
                return result;
            });
        }
    };
})

// chkPass
//
// Enables use of js/shared/pwdmeter.js to check strengh of passwords.
// See controllers/Users.js for example.
//
.directive('chkPass', [function() {
    return {
        require: 'ngModel',
        link: function(scope, elm, attrs, ctrl) {
            $(elm).keyup(function() {
                var validity = true;
                if (elm.val()) {
                    if ($AnsibleConfig.password_length) {
                        validity = (ctrl.$modelValue.length >= $AnsibleConfig.password_length);
                        ctrl.$setValidity('password_length', validity);
                    }
                    if ($AnsibleConfig.password_hasLowercase) {
                        validity = (/[a-z]/.test(ctrl.$modelValue));
                        ctrl.$setValidity('hasLowercase', validity);
                    }
                    if ($AnsibleConfig.password_hasUppercase) {
                        validity = (/[A-Z]/.test(ctrl.$modelValue));
                        ctrl.$setValidity('hasUppercase', validity);
                    }
                    if ($AnsibleConfig.password_hasNumber) {
                        validity = (/[0-9]/.test(ctrl.$modelValue));
                        ctrl.$setValidity('hasNumber', validity);
                    }
                    if ($AnsibleConfig.password_hasSymbol) {
                        validity = (/[\\#@$-/:-?{-~!"^_`\[\]]/.test(ctrl.$modelValue));
                        ctrl.$setValidity('hasSymbol', validity);
                    }
                } else {
                    validity = true;
                    if ($AnsibleConfig.password_length) {
                        ctrl.$setValidity('password_length', validity);
                    }
                    if ($AnsibleConfig.password_hasLowercase) {
                        ctrl.$setValidity('hasLowercase', validity);
                    }
                    if ($AnsibleConfig.password_hasUppercase) {
                        ctrl.$setValidity('hasUppercase', validity);
                    }
                    if ($AnsibleConfig.password_hasNumber) {
                        ctrl.$setValidity('hasNumber', validity);
                    }
                    if ($AnsibleConfig.password_hasSymbol) {
                        ctrl.$setValidity('hasSymbol', validity);
                    }
                }
                if (!scope.$$phase) {
                    scope.$digest();
                }
            });
        }
    };
}])

// imageUpload
//
// Accepts image and returns base64 information with basic validation
// Can eventually expand to handle all uploads with different endpoints and handlers
//
.directive('imageUpload', ['ConfigurationUtils', function(ConfigurationUtils) {
    return {
        restrict: 'E',
        scope: {
            key: '@'
        },
        template: `
                <div class="input-group">
                      <label class="input-group-addon Form-filePicker--pickerButton" id="filePickerButton" for="filePicker" ng-click="update($event)">BROWSE</label>
                      <input type="text" class="form-control Form-filePicker--textBox" id="filePickerText" placeholder="Choose file" readonly>
                      <input type="file" name="file" class="Form-filePicker" id="filePicker"  onchange="angular.element(this).scope().fileChange(this.files)"/>
                    </div>
                <!-- Update when API supports file name saving
                <div ng-if="imagePresent" class="Form-filePicker--selectedFile">
                    Custom logo has been uploaded.
                </div>-->
                <!-- Thumbnail feature
                <div class="thumbnail">
                    <img src="{{image}}" alt="Current logo">
                </div> -->
                <div class="error" id="filePickerError"></div>`,

        link: function(scope) {
            var fieldKey = scope.key;
            var filePickerText = angular.element(document.getElementById('filePickerText'));
            var filePickerError = angular.element(document.getElementById('filePickerError'));
            var filePickerButton = angular.element(document.getElementById('filePickerButton'));

            scope.imagePresent = global.$AnsibleConfig.custom_logo;

            scope.$on('loginUpdated', function() {
                scope.imagePresent = global.$AnsibleConfig.custom_logo;
            });

            scope.update = function(e) {
                if(scope.$parent[fieldKey]) {
                    e.preventDefault();
                    scope.$parent[fieldKey] = '';
                    filePickerButton.html('BROWSE');
                    filePickerText.val('');
                }
                else {
                    // Nothing exists so open file picker
                }
            };

            scope.fileChange = function(file) {
                filePickerError.html('');

                ConfigurationUtils.imageProcess(file[0])
                    .then(function(result) {
                        scope.$parent[fieldKey] = result;
                        filePickerText.val(file[0].name);
                        filePickerButton.html('REMOVE');
                    }).catch(function(error) {
                        filePickerText.html(file[0].name);
                        filePickerError.text(error);
                    }).finally(function() {

                    });
            };

        }
    };
}])


.directive('surveyCheckboxes', function() {
    return {
        restrict: 'E',
        require: 'ngModel',
        scope: { ngModel: '=ngModel' },
        template: '<div class="survey_taker_input" ng-repeat="option in ngModel.options">' +
            '<label style="font-weight:normal"><input type="checkbox" ng-model="cbModel[option.value]" ' +
            'value="{{option.value}}" class="mc" ng-change="update(this.value)" />' +
            '<span>' +
            '{{option.value}}' +
            '</span></label>' +
            '</div>',
        link: function(scope, element, attrs, ctrl) {
            scope.cbModel = {};
            ctrl.$setValidity('reqCheck', true);
            angular.forEach(scope.ngModel.value, function(value) {
                scope.cbModel[value] = true;

            });

            if (scope.ngModel.required === true && scope.ngModel.value.length === 0) {
                ctrl.$setValidity('reqCheck', false);
            }

            ctrl.$parsers.unshift(function(viewValue) {
                for (var c in scope.cbModel) {
                    if (scope.cbModel[c]) {
                        ctrl.$setValidity('checkbox', true);
                    }
                }
                ctrl.$setValidity('checkbox', false);

                return viewValue;
            });

            scope.update = function() {
                var val = [];
                angular.forEach(scope.cbModel, function(v, k) {
                    if (v) {
                        val.push(k);
                    }
                });
                if (val.length > 0) {
                    scope.ngModel.value = val;
                    scope.$parent[scope.ngModel.name] = val;
                    ctrl.$setValidity('checkbox', true);
                    ctrl.$setValidity('reqCheck', true);
                } else if (scope.ngModel.required === true) {
                    ctrl.$setValidity('checkbox', false);
                }
            };
        }
    };
})


.directive('awSurveyQuestion', function() {
    return {
        require: 'ngModel',
        link: function(scope, elm, attrs, ctrl) {
            ctrl.$parsers.unshift(function(viewValue) {
                var values = viewValue.split(" "),
                    result = "",
                    i;
                result += values[0].charAt(0).toUpperCase() + values[0].substr(1) + ' ';
                for (i = 1; i < values.length; i++) {
                    result += values[i] + ' ';
                }
                result = result.trim();
                if (result !== viewValue) {
                    ctrl.$setViewValue(result);
                    ctrl.$render();
                }
                return result;
            });
        }
    };
})

.directive('awMin', ['Empty', function(Empty) {
    return {
        restrict: 'A',
        require: 'ngModel',
        link: function(scope, elem, attr, ctrl) {
            ctrl.$parsers.unshift(function(viewValue) {
                var min = (attr.awMin) ? scope.$eval(attr.awMin) : -Infinity;
                if (!Empty(min) && !Empty(viewValue) && Number(viewValue) < min) {
                    ctrl.$setValidity('awMin', false);
                    return viewValue;
                } else {
                    ctrl.$setValidity('awMin', true);
                    return viewValue;
                }
            });
        }
    };
}])

.directive('awMax', ['Empty', function(Empty) {
    return {
        restrict: 'A',
        require: 'ngModel',
        link: function(scope, elem, attr, ctrl) {
            ctrl.$parsers.unshift(function(viewValue) {
                var max = (attr.awMax) ? scope.$eval(attr.awMax) : Infinity;
                if (!Empty(max) && !Empty(viewValue) && Number(viewValue) > max) {
                    ctrl.$setValidity('awMax', false);
                    return viewValue;
                } else {
                    ctrl.$setValidity('awMax', true);
                    return viewValue;
                }
            });
        }
    };
}])

.directive('smartFloat', function() {
    var FLOAT_REGEXP = /^\-?\d+((\.|\,)\d+)?$/;
    return {
        require: 'ngModel',
        link: function(scope, elm, attrs, ctrl) {
            ctrl.$parsers.unshift(function(viewValue) {
                if (FLOAT_REGEXP.test(viewValue)) {
                    ctrl.$setValidity('float', true);
                    return parseFloat(viewValue.replace(',', '.'));
                } else {
                    ctrl.$setValidity('float', false);
                    return undefined;
                }
            });
        }
    };
})

// integer  Validate that input is of type integer. Taken from Angular developer
//          guide, form examples. Add min and max directives, and this will check
//          entered values is within the range.
//
//          Use input type of 'text'. Use of 'number' casuses browser validation to
//          override/interfere with this directive.
.directive('integer', function() {
    return {
        restrict: 'A',
        require: 'ngModel',
        link: function(scope, elm, attrs, ctrl) {
            ctrl.$parsers.unshift(function(viewValue) {
                ctrl.$setValidity('min', true);
                ctrl.$setValidity('max', true);
                if (/^\-?\d*$/.test(viewValue)) {
                    // it is valid
                    ctrl.$setValidity('integer', true);
                    if (viewValue === '-' || viewValue === '-0' || viewValue === null) {
                        ctrl.$setValidity('integer', false);
                        return viewValue;
                    }
                    if (elm.attr('min') &&
                        parseInt(viewValue, 10) < parseInt(elm.attr('min'), 10)) {
                        ctrl.$setValidity('min', false);
                        return viewValue;
                    }
                    if (elm.attr('max') && (parseInt(viewValue, 10) > parseInt(elm.attr('max'), 10))) {
                        ctrl.$setValidity('max', false);
                        return viewValue;
                    }
                    return viewValue;
                }
                // Invalid, return undefined (no model update)
                ctrl.$setValidity('integer', false);
                return viewValue;
            });
        }
    };
})

//the awSurveyVariableName directive checks if the field contains any spaces.
// this could be elaborated in the future for other things we want to check this field against
.directive('awSurveyVariableName', function() {
    var FLOAT_REGEXP = /^[a-zA-Z_$][0-9a-zA-Z_$]*$/;
    return {
        restrict: 'A',
        require: 'ngModel',
        link: function(scope, elm, attrs, ctrl) {
            ctrl.$setValidity('required', true); // we only want the error message for incorrect characters to be displayed
            ctrl.$parsers.unshift(function(viewValue) {
                if (viewValue.length !== 0) {
                    if (FLOAT_REGEXP.test(viewValue) && viewValue.indexOf(' ') === -1) { //check for a spaces
                        ctrl.$setValidity('variable', true);
                        return viewValue;
                    } else {
                        ctrl.$setValidity('variable', false); // spaces found, therefore throw error.
                        return viewValue;
                    }
                } else {
                    ctrl.$setValidity('variable', true); // spaces found, therefore throw error.
                    return viewValue;
                }
            });
        }
    };
})

//
// awRequiredWhen: { reqExpression: "<expression to watch for true|false>", init: "true|false" }
//
// Make a field required conditionally using an expression. If the expression evaluates to true, the
// field will be required. Otherwise, the required attribute will be removed.
//
.directive('awRequiredWhen', function() {
    return {
        require: 'ngModel',
        link: function(scope, elm, attrs, ctrl) {

            function updateRequired() {
                var isRequired = scope.$eval(attrs.awRequiredWhen);

                var viewValue = elm.val(),
                    label, validity = true;
                label = $(elm).closest('.form-group').find('label').first();

                if (isRequired && (elm.attr('required') === null || elm.attr('required') === undefined)) {
                    $(elm).attr('required', 'required');
                    $(label).removeClass('prepend-asterisk').addClass('prepend-asterisk');
                } else if (!isRequired) {
                    elm.removeAttr('required');
                    if (!attrs.awrequiredAlwaysShowAsterisk) {
                        $(label).removeClass('prepend-asterisk');
                    }
                }
                if (isRequired && (viewValue === undefined || viewValue === null || viewValue === '')) {
                    validity = false;
                }
                ctrl.$setValidity('required', validity);
            }

            scope.$watchGroup([attrs.awRequiredWhen, $(elm).attr('name')], function() {
                // watch for the aw-required-when expression to change value
                updateRequired();
            });

            if (attrs.awrequiredInit !== undefined && attrs.awrequiredInit !== null) {
                // We already set a watcher on the attribute above so no need to call updateRequired() in here
                scope[attrs.awRequiredWhen] = attrs.awrequiredInit;
            }

        }
    };
})

// awPlaceholder: Dynamic placeholder set to a scope variable you want watched.
//                Value will be place in field placeholder attribute.
.directive('awPlaceholder', [function() {
    return {
        require: 'ngModel',
        link: function(scope, elm, attrs) {
            $(elm).attr('placeholder', scope[attrs.awPlaceholder]);
            scope.$watch(attrs.awPlaceholder, function(newVal) {
                $(elm).attr('placeholder', newVal);
            });
        }
    };
}])

// lookup   Validate lookup value against API
.directive('awlookup', ['Rest', 'GetBasePath', '$q', function(Rest, GetBasePath, $q) {
    return {
        require: 'ngModel',
        link: function(scope, elm, attrs, fieldCtrl) {

            let query,
                basePath,
                defer = $q.defer();

            // query the API to see if field value corresponds to a valid resource
            // .ng-pending will be applied to the directive element while the request is outstanding
            // form.$pending will contain object reference to any ngModelControllers with outstanding requests
            fieldCtrl.$asyncValidators.validResource = function(modelValue, viewValue) {

                applyValidationStrategy(viewValue, fieldCtrl);

                return defer.promise;
            };

            function applyValidationStrategy(viewValue, ctrl) {

                // use supplied data attributes to build an endpoint, query, resolve outstanding promise
                function applyValidation(viewValue) {
                    basePath = GetBasePath(elm.attr('data-basePath')) || elm.attr('data-basePath');
                    query = elm.attr('data-query');
                    query = query.replace(/\:value/, encodeURI(viewValue));
                    Rest.setUrl(`${basePath}${query}`);
                    // https://github.com/ansible/ansible-tower/issues/3549
                    // capturing both success/failure conditions in .then() promise
                    // when #3549 is resolved, this will need to be partitioned into success/error or then/catch blocks
                    return Rest.get()
                        .then((res) => {
                            if (res.data.results.length > 0) {
                                scope[elm.attr('data-source')] = res.data.results[0].id;
                                return setValidity(ctrl, true);
                            } else {
                                scope[elm.attr('data-source')] = null;
                                return setValidity(ctrl, false);
                            }
                        });
                }

                function setValidity(ctrl, validity){
                    ctrl.$setValidity('awlookup', validity);
                    return defer.resolve(validity);
                }

                // Three common cases for clarity:

                // 1) Field is not required & pristine. Pass validation & skip async $pending state
                // 2) Field is required. Always validate & use async $pending state
                // 3) Field is not required, but is not $pristine. Always validate & use async $pending state

                // case 1
                if (!ctrl.$validators.required && ctrl.$pristine) {
                    return setValidity(ctrl, true);
                }
                // case 2 & 3
                else {
                    return applyValidation(viewValue);
                }
            }
        }
    };
}])

//
// awValidUrl
//
.directive('awValidUrl', [function() {
    return {
        require: 'ngModel',
        link: function(scope, elm, attrs, ctrl) {
            ctrl.$parsers.unshift(function(viewValue) {
                var validity = true,
                    rgx, rgx2;
                if (viewValue !== '') {
                    ctrl.$setValidity('required', true);
                    rgx = /^(https|http|ssh)\:\/\//;
                    rgx2 = /\@/g;
                    if (!rgx.test(viewValue) || rgx2.test(viewValue)) {
                        validity = false;
                    }
                }
                ctrl.$setValidity('awvalidurl', validity);

                return viewValue;
            });
        }
    };
}])

/*
 *  Enable TB tooltips. To add a tooltip to an element, include the following directive in
 *  the element's attributes:
 *
 *     aw-tool-tip="<< tooltip text here >>"
 *
 *  Include the standard TB data-XXX attributes to controll a tooltip's appearance.  We will
 *  default placement to the left and delay to the config setting.
 */
.directive('awToolTip', [function() {
    return {
        link: function(scope, element, attrs) {
            // if (attrs.class.indexOf("JobResultsStdOut") > -1) {
            //     debugger;
            // }
            var delay = { show: 200, hide: 0 },
                placement,
                stateChangeWatcher;
            if (attrs.awTipPlacement) {
                placement = attrs.awTipPlacement;
            } else {
                placement = (attrs.placement !== undefined && attrs.placement !== null) ? attrs.placement : 'left';
            }

            var template, custom_class;
            if (attrs.tooltipInnerClass || attrs.tooltipinnerclass) {
                custom_class = attrs.tooltipInnerClass || attrs.tooltipinnerclass;
                template = '<div class="tooltip Tooltip" role="tooltip"><div class="tooltip-arrow Tooltip-arrow"></div><div class="tooltip-inner Tooltip-inner ' + custom_class + '"></div></div>';
            } else {
                template = '<div class="tooltip Tooltip" role="tooltip"><div class="tooltip-arrow Tooltip-arrow"></div><div class="tooltip-inner Tooltip-inner"></div></div>';
            }

            // This block helps clean up tooltips that may get orphaned by a click event
            $(element).on('mouseenter', function() {
                if (stateChangeWatcher) {
                    // Un-bind - we don't want a bunch of listeners firing
                    stateChangeWatcher();
                }
                stateChangeWatcher = scope.$on('$stateChangeStart', function() {
                    // Go ahead and force the tooltip setTimeout to expire (if it hasn't already fired)
                    $(element).tooltip('hide');
                    // Clean up any existing tooltips including this one
                    $('.tooltip').each(function() {
                        $(this).remove();
                    });
                });
            });

            $(element).on('hidden.bs.tooltip', function() {
                // TB3RC1 is leaving behind tooltip <div> elements. This will remove them
                // after a tooltip fades away. If not, they lay overtop of other elements and
                // honk up the page.
                $('.tooltip').each(function() {
                    $(this).remove();
                });
            });

            $(element).tooltip({
                placement: placement,
                delay: delay,
                html: true,
                title: attrs.awToolTip,
                container: 'body',
                trigger: 'hover',
                template: template
            });

            if (attrs.tipWatch) {
                // Add dataTipWatch: 'variable_name'
                scope.$watch(attrs.tipWatch, function(newVal, oldVal) {
                    if (newVal !== oldVal) {
                        // Where did fixTitle come from?:
                        //   http://stackoverflow.com/questions/9501921/change-twitter-bootstrap-tooltip-content-on-click
                        $(element).tooltip('hide').attr('data-original-title', newVal).tooltip('fixTitle');
                    }
                });
            }
        }
    };
}])

/*
 *  Enable TB pop-overs. To add a pop-over to an element, include the following directive in
 *  the element's attributes:
 *
 *     aw-pop-over="<< pop-over html here >>"
 *
 *  Include the standard TB data-XXX attributes to controll the pop-over's appearance.  We will
 *  default placement to the left, delay to 0 seconds, content type to HTML, and title to 'Help'.
 */
.directive('awPopOver', ['$compile', function($compile) {
    return function(scope, element, attrs) {
        var placement = (attrs.placement !== undefined && attrs.placement !== null) ? attrs.placement : 'left',
            title = (attrs.overTitle) ? attrs.overTitle : (attrs.popoverTitle) ? attrs.popoverTitle : 'Help',
            container = (attrs.container !== undefined) ? attrs.container : false,
            trigger = (attrs.trigger !== undefined) ? attrs.trigger : 'manual',
            template = '<div class="popover" role="tooltip"><div class="arrow"></div><h3 class="popover-title"></h3><div class="popover-content"></div></div>',
            id_to_close = "";

        if (element[0].id) {
            template = '<div id="' + element[0].id + '_popover_container" class="popover" role="tooltip"><div class="arrow"></div><h3 id="' + element[0].id + '_popover_title" class="popover-title"></h3><div id="' + element[0].id + '_popover_content" class="popover-content"></div></div>';
        }

        scope.triggerPopover = function(e) {
            showPopover(e);
        };

        if (attrs.awPopOverWatch) {
            $(element).popover({
                placement: placement,
                delay: 0,
                title: title,
                content: function() {
                    return scope[attrs.awPopOverWatch];
                },
                trigger: trigger,
                html: true,
                container: container,
                template: template
            });
        } else {
            $(element).popover({
                placement: placement,
                delay: 0,
                title: title,
                content: attrs.awPopOver,
                trigger: trigger,
                html: true,
                container: container,
                template: template
            });
        }
        $(element).attr('tabindex', -1);

        $(element).one('click', showPopover);

        function bindPopoverDismiss() {
            $('body').one('click.popover' + id_to_close, function(e) {
                if ($(e.target).parents(id_to_close).length === 0) {
                    // case: you clicked to open the popover and then you
                    //  clicked outside of it...hide it.
                    $(element).popover('hide');
                } else {
                    // case: you clicked to open the popover and then you
                    // clicked inside the popover
                    bindPopoverDismiss();
                }
            });
        }

        $(element).on('shown.bs.popover', function() {
            bindPopoverDismiss();
            $(document).on('keydown.popover', dismissOnEsc);
        });

        $(element).on('hidden.bs.popover', function() {
            $(element).off('click', dismissPopover);
            $(element).off('click', showPopover);
            $('body').off('click.popover.' + id_to_close);
            $(element).one('click', showPopover);
            $(document).off('keydown.popover', dismissOnEsc);
        });

        function showPopover(e) {
            e.stopPropagation();

            var self = $(element);

            // remove tool-tip
            try {
                element.tooltip('hide');
            } catch (ex) {
                // ignore
            }

            // this is called on the help-link (over and over again)
            $('.help-link, .help-link-white').each(function() {
                if (self.attr('id') !== $(this).attr('id')) {
                    try {
                        // not sure what this does different than the method above
                        $(this).popover('hide');
                    } catch (e) {
                        // ignore
                    }
                }
            });

            $('.popover').each(function() {
                // remove lingering popover <div>. Seems to be a bug in TB3 RC1
                $(this).remove();
            });
            $('.tooltip').each(function() {
                // close any lingering tool tips
                $(this).hide();
            });

            // set id_to_close of the actual open element
            id_to_close = "#" + $(element).attr('id') + "_popover_container";

            // $(element).one('click', dismissPopover);

            $(element).popover('toggle');

            $('.popover').each(function() {
                $compile($(this))(scope); //make nested directives work!
            });
        }

        function dismissPopover(e) {
            e.stopPropagation();
            $(element).popover('hide');
        }

        function dismissOnEsc(e) {
            if (e.keyCode === 27) {
                $(element).popover('hide');
                $('.popover').each(function() {
                    // remove lingering popover <div>. Seems to be a bug in TB3 RC1
                    // $(this).remove();
                });
            }
        }

    };
}])

//
// Enable jqueryui slider widget on a numeric input field
//
// <input type="number" aw-slider name="myfield" min="0" max="100" />
//
.directive('awSlider', [function() {
    return {
        require: 'ngModel',
        link: function(scope, elm, attrs, ctrl) {
            var name = elm.attr('name');
            $('#' + name + '-slider').slider({
                value: 0,
                step: 1,
                min: elm.attr('min'),
                max: elm.attr('max'),
                disabled: (elm.attr('readonly')) ? true : false,
                slide: function(e, u) {
                    ctrl.$setViewValue(u.value);
                    ctrl.$setValidity('required', true);
                    ctrl.$setValidity('min', true);
                    ctrl.$setValidity('max', true);
                    ctrl.$dirty = true;
                    ctrl.$render();
                    if (!scope.$$phase) {
                        scope.$digest();
                    }
                }
            });

            $('#' + name + '-number').change(function() {
                $('#' + name + '-slider').slider('value', parseInt($(this).val(), 10));
            });

        }
    };
}])

//
// Enable jqueryui spinner widget on a numeric input field
//
// <input type="number" aw-spinner name="myfield" min="0" max="100" />
//
.directive('awSpinner', [function() {
    return {
        require: 'ngModel',
        link: function(scope, elm, attrs, ctrl) {
            var disabled, opts;
            disabled = elm.attr('data-disabled');
            opts = {
                value: 0,
                step: 1,
                min: elm.attr('min'),
                max: elm.attr('max'),
                numberFormat: "d",
                disabled: (elm.attr('readonly')) ? true : false,
                icons: {
                    down: "Form-numberInputButton fa fa-angle-down",
                    up: "Form-numberInputButton fa fa-angle-up"
                },
                spin: function(e, u) {
                    ctrl.$setViewValue(u.value);
                    ctrl.$setValidity('required', true);
                    ctrl.$setValidity('min', true);
                    ctrl.$setValidity('max', true);
                    ctrl.$dirty = true;
                    ctrl.$render();
                    if (scope.job_templates_form) {
                        // need a way to find the parent form and mark it dirty
                        scope.job_templates_form.$dirty = true;
                    }
                    if (!scope.$$phase) {
                        scope.$digest();
                    }
                }
            };
            if (disabled) {
                opts.disabled = true;
            }
            $(elm).spinner(opts);
            $('.ui-icon').text('');
            $(".ui-icon").removeClass('ui-icon ui-icon-triangle-1-n ui-icon-triangle-1-s');
            $(elm).on("click", function() {
                $(elm).select();
            });
        }
    };
}])

//
// awRefresh
//
// Creates a timer to call scope.refresh(iterator) ever N seconds, where
// N is a setting in config.js
//
.directive('awRefresh', ['$rootScope', function($rootScope) {
    return {
        link: function(scope) {
            function msg() {
                var num = '' + scope.refreshCnt;
                while (num.length < 2) {
                    num = '0' + num;
                }
                return 'Refresh in ' + num + ' sec.';
            }
            scope.refreshCnt = $AnsibleConfig.refresh_rate;
            scope.refreshMsg = msg();
            if ($rootScope.timer) {
                clearInterval($rootScope.timer);
            }
            $rootScope.timer = setInterval(function() {
                scope.refreshCnt--;
                if (scope.refreshCnt <= 0) {
                    scope.refresh();
                    scope.refreshCnt = $AnsibleConfig.refresh_rate;
                }
                scope.refreshMsg = msg();
                if (!scope.$$phase) {
                    scope.$digest();
                }
            }, 1000);
        }
    };
}])

/*
 *  Make an element draggable. Used on inventory groups tree.
 *
 *  awDraggable: boolean || {{ expression }}
 *
 */
.directive('awDraggable', [function() {
    return function(scope, element, attrs) {

        if (attrs.awDraggable === "true") {
            var containment = attrs.containment; //provide dataContainment:"#id"
            $(element).draggable({
                containment: containment,
                scroll: true,
                revert: "invalid",
                helper: "clone",
                start: function(e, ui) {
                    ui.helper.addClass('draggable-clone');
                },
                zIndex: 100,
                cursorAt: { left: -1 }
            });
        }
    };
}])

/*
 *  Make an element droppable- it can receive draggable elements
 *
 *  awDroppable: boolean || {{ expression }}
 *
 */
.directive('awDroppable', ['Find', function(Find) {
    return function(scope, element, attrs) {
        var node;
        if (attrs.awDroppable === "true") {
            $(element).droppable({
                // the following is inventory specific accept checking and
                // drop processing.
                accept: function(draggable) {
                    if (draggable.attr('data-type') === 'group') {
                        // Dropped a group
                        if ($(this).attr('data-group-id') === draggable.attr('data-group-id')) {
                            // No dropping a node onto itself (or a copy)
                            return false;
                        }
                        // No dropping a node into a group that already has the node
                        node = Find({ list: scope.groups, key: 'id', val: parseInt($(this).attr('data-tree-id'), 10) });
                        if (node) {
                            var group = parseInt(draggable.attr('data-group-id'), 10),
                                found = false,
                                i;
                            // For whatever reason indexOf() would not work...
                            for (i = 0; i < node.children.length; i++) {
                                if (node.children[i] === group) {
                                    found = true;
                                    break;
                                }
                            }
                            return (found) ? false : true;
                        }
                        return false;
                    }
                    if (draggable.attr('data-type') === 'host') {
                        // Dropped a host
                        node = Find({ list: scope.groups, key: 'id', val: parseInt($(this).attr('data-tree-id'), 10) });
                        return (node.id > 1) ? true : false;
                    }
                    return false;
                },
                over: function() {
                    $(this).addClass('droppable-hover');
                },
                out: function() {
                    $(this).removeClass('droppable-hover');
                },
                drop: function(e, ui) {
                    // Drag-n-drop succeeded. Trigger a response from the inventory.edit controller
                    $(this).removeClass('droppable-hover');
                    if (ui.draggable.attr('data-type') === 'group') {
                        scope.$emit('CopyMoveGroup', parseInt(ui.draggable.attr('data-tree-id'), 10),
                            parseInt($(this).attr('data-tree-id'), 10));
                    } else if (ui.draggable.attr('data-type') === 'host') {
                        scope.$emit('CopyMoveHost', parseInt($(this).attr('data-tree-id'), 10),
                            parseInt(ui.draggable.attr('data-host-id'), 10));
                    }
                },
                tolerance: 'pointer'
            });
        }
    };
}])


.directive('awAccordion', ['Empty', '$location', 'Store', function(Empty, $location, Store) {
    return function(scope, element, attrs) {
        var active,
            list = Store('accordions'),
            id, base;

        if (!Empty(attrs.openFirst)) {
            active = 0;
        } else {
            // Look in storage for last active panel
            if (list) {
                id = $(element).attr('id');
                base = ($location.path().replace(/^\//, '').split('/')[0]);
                list.every(function(elem) {
                    if (elem.base === base && elem.id === id) {
                        active = elem.active;
                        return false;
                    }
                    return true;
                });
            }
            active = (Empty(active)) ? 0 : active;
        }

        $(element).accordion({
            collapsible: true,
            heightStyle: "content",
            active: active,
            activate: function() {
                // When a panel is activated update storage
                var active = $(this).accordion('option', 'active'),
                    id = $(this).attr('id'),
                    base = ($location.path().replace(/^\//, '').split('/')[0]),
                    list = Store('accordions'),
                    found = false;
                if (!list) {
                    list = [];
                }
                list.every(function(elem) {
                    if (elem.base === base && elem.id === id) {
                        elem.active = active;
                        found = true;
                        return false;
                    }
                    return true;
                });
                if (found === false) {
                    list.push({
                        base: base,
                        id: id,
                        active: active
                    });
                }
                Store('accordions', list);
            }
        });
    };
}])

// Toggle switch inspired by http://www.bootply.com/92189
.directive('awToggleButton', [function() {
    return function(scope, element) {
        $(element).click(function() {
            var next, choice;
            $(this).find('.btn').toggleClass('active');
            if ($(this).find('.btn-primary').size() > 0) {
                $(this).find('.btn').toggleClass('btn-primary');
            }
            if ($(this).find('.btn-danger').size() > 0) {
                $(this).find('.btn').toggleClass('btn-danger');
            }
            if ($(this).find('.btn-success').size() > 0) {
                $(this).find('.btn').toggleClass('btn-success');
            }
            if ($(this).find('.btn-info').size() > 0) {
                $(this).find('.btn').toggleClass('btn-info');
            }
            $(this).find('.btn').toggleClass('btn-default');

            // Add data-after-toggle="functionName" to the btn-group, and we'll
            // execute here. The newly active choice is passed as a parameter.
            if ($(this).attr('data-after-toggle')) {
                next = $(this).attr('data-after-toggle');
                choice = $(this).find('.active').text();
                setTimeout(function() {
                    scope.$apply(function() {
                        scope[next](choice);
                    });
                });
            }

        });
    };
}])

//
// Support dropping files on an element. Used on credentials page for SSH/RSA private keys
// Inspired by https://developer.mozilla.org/en-US/docs/Using_files_from_web_applications
//
.directive('awDropFile', ['Alert', function(Alert) {
    return {
        require: 'ngModel',
        link: function(scope, element, attrs, ctrl) {
            $(element).on('dragenter', function(e) {
                e.stopPropagation();
                e.preventDefault();
            });
            $(element).on('dragover', function(e) {
                e.stopPropagation();
                e.preventDefault();
            });
            $(element).on('drop', function(e) {
                var dt, files, reader;
                e.stopPropagation();
                e.preventDefault();
                dt = e.originalEvent.dataTransfer;
                files = dt.files;
                reader = new FileReader();
                reader.onload = function() {
                    ctrl.$setViewValue(reader.result);
                    ctrl.$render();
                    ctrl.$setValidity('required', true);
                    ctrl.$dirty = true;
                    if (!scope.$$phase) {
                        scope.$digest();
                    }
                };
                reader.onerror = function() {
                    Alert('Error', 'There was an error reading the selected file.');
                };
                if (files[0].size < 10000) {
                    reader.readAsText(files[0]);
                } else {
                    Alert('Error', 'There was an error reading the selected file.');
                }
            });
        }
    };
}])

.directive('awPasswordToggle', [function() {
    return {
        restrict: 'A',
        link: function(scope, element) {
            $(element).click(function() {
                var buttonInnerHTML = $(element).html();
                if (buttonInnerHTML.indexOf("Show") > -1) {
                    $(element).html("Hide");
                    $(element).closest('.input-group').find('input').first().attr("type", "text");
                } else {
                    $(element).html("Show");
                    $(element).closest('.input-group').find('input').first().attr("type", "password");
                }
            });
        }
    };
}])

.directive('awEnterKey', [function() {
    return {
        restrict: 'A',
        link: function(scope, element, attrs) {
            element.bind("keydown keypress", function(event) {
                var keyCode = event.which || event.keyCode;
                if (keyCode === 13) {
                    scope.$apply(function() {
                        scope.$eval(attrs.awEnterKey);
                    });
                    event.preventDefault();
                }
            });
        }
    };
}])

.directive('awTruncateBreadcrumb', ['BreadCrumbService', function(BreadCrumbService) {
    return {
        restrict: 'A',
        scope: {
            breadcrumbStep: '='
        },
        link: function(scope) {
            scope.$watch('breadcrumbStep.ncyBreadcrumbLabel', function(){
                BreadCrumbService.truncateCrumbs();
            });
        }
    };
}]);
