/*********************************************
 *  Copyright (c) 2014 AnsibleWorks, Inc.
 *
 *  JobSubmission.js
 *
 */

'use strict';

angular.module('JobSubmissionHelper', ['RestServices', 'Utilities', 'CredentialFormDefinition', 'CredentialsListDefinition',
    'LookUpHelper', 'ProjectFormDefinition', 'JobSubmissionHelper'
])

.factory('PromptPasswords', ['CredentialForm', 'JobTemplateForm', '$compile', 'Rest', '$location', 'ProcessErrors',
    'GetBasePath', 'Alert', 'Empty', 'Wait',
    function (CredentialForm, JobTemplateForm, $compile, Rest, $location, ProcessErrors, GetBasePath, Alert, Empty, Wait) {
        return function (params) {

            var scope = params.scope,
                passwords = params.passwords,
                start_url = params.start_url,
                form = params.form,
                html = '',
                field, element, fld, i, current_form,
                base = $location.path().replace(/^\//, '').split('/')[0],
                extra_html = params.extra_html;

            function navigate(canceled) {
                //Decide where to send the user once the modal dialog closes
                if (!canceled) {
                    if (base === 'jobs') {
                        scope.refreshJob();
                    } else {
                        $location.path('/jobs');
                    }
                } else {
                    $location.path('/' + base);
                }
            }

            function cancel() {
                // Delete a job
                var url = GetBasePath('jobs') + scope.job_id + '/';
                Rest.setUrl(url);
                Rest.destroy()
                    .success(function () {
                        if (form.name === 'credential') {
                            navigate(true);
                        }
                    })
                    .error(function (data, status) {
                        ProcessErrors(scope, data, status, null, { hdr: 'Error!',
                            msg: 'Call to ' + url + ' failed. DELETE returned status: ' + status });
                    });
            }

            scope.cancelJob = function () {
                // User clicked cancel button
                $('#password-modal').modal('hide');
                if (form.name === 'credential') {
                    cancel();
                } else {
                    scope.$emit('UpdateSubmitted', 'canceled');
                }
            };

            scope.startJob = function () {
                var pswd = {}, value_supplied = false;
                $('#password-modal').modal('hide');
                Wait('start');
                $('.password-field').each(function () {
                    pswd[$(this).attr('name')] = $(this).val();
                    if ($(this).val() !== '' && $(this).val() !== null) {
                        value_supplied = true;
                    }
                });
                if (Empty(passwords) || passwords.length === 0 || value_supplied) {
                    Rest.setUrl(start_url);
                    Rest.post(pswd)
                        .success(function () {
                            scope.$emit('UpdateSubmitted', 'started');
                            if (form.name === 'credential') {
                                navigate(false);
                            }
                        })
                        .error(function (data, status) {
                            Wait('stop');
                            ProcessErrors(scope, data, status, null, { hdr: 'Error!',
                                msg: 'POST to ' + start_url + ' failed with status: ' + status });
                        });
                } else {
                    Wait('stop');
                    Alert('No Passwords', 'Required password(s) not provided. The request was not submitted.', 'alert-info');
                    if (form.name === 'credential') {
                        // No passwords provided, so we can't start the job. Rather than leave the job in a 'new'
                        // state, let's delete it. 
                        scope.cancelJob();
                    }
                }
            };

            if (passwords && passwords.length > 0) {
                Wait('stop');
                // Prompt for passwords
                html += "<form class=\"form-horizontal\" name=\"password_form\" novalidate>\n";
                html += (extra_html) ? extra_html : "";
                for (i = 0; i < passwords.length; i++) {
                    // Add the password field
                    if (form.name === 'credential') {
                        // this is a job. we could be prompting for inventory and/or SCM passwords
                        if (form.fields[passwords[i]]) {
                            current_form = form;
                        }
                        else {
                            // No match found. Abandon ship!
                            Alert('Form Not Found', 'Could not locate form for: ' + passwords[i], 'alert-danger');
                            $location('/#/jobs');
                        }
                    } else {
                        current_form = form;
                    }
                    field = current_form.fields[passwords[i]];
                    fld = passwords[i];
                    scope[fld] = '';
                    html += "<div class=\"form-group\">\n";
                    html += "<label class=\"control-label col-lg-3 normal-weight\" for=\"" + fld + "\">* ";
                    html += (field.labelBind) ? scope[field.labelBind] : field.label;
                    html += "</label>\n";
                    html += "<div class=\"col-lg-9\">\n";
                    html += "<input type=\"password\" ";
                    html += "ng-model=\"" + fld + '" ';
                    html += 'name="' + fld + '" ';
                    html += "class=\"password-field form-control\" ";
                    html += "required ";
                    html += "/>";
                    html += "<br />\n";
                    // Add error messages
                    html += "<span class=\"error\" ng-show=\"password_form." + fld + ".$dirty && " +
                        "password_form." + fld + ".$error.required\">A value is required!</span>\n";
                    html += "<span class=\"error api-error\" ng-bind=\"" + fld + "_api_error\"></span>\n";
                    html += "</div>\n";
                    html += "</div>\n";

                    // Add the related confirm field
                    fld = field.associated;
                    field = current_form.fields[field.associated];
                    scope[fld] = '';
                    html += "<div class=\"form-group\">\n";
                    html += "<label class=\"control-label col-lg-3 normal-weight\" for=\"" + fld + "\">* ";
                    html += (field.labelBind) ? scope[field.labelBind] : field.label;
                    html += "</label>\n";
                    html += "<div class=\"col-lg-9\">\n";
                    html += "<input type=\"password\" ";
                    html += "ng-model=\"" + fld + '" ';
                    html += 'name="' + fld + '" ';
                    html += "class=\"form-control\" ";
                    html += "required ";
                    html += (field.awPassMatch) ? "awpassmatch=\"" + field.associated + "\" " : "";
                    html += "/>";
                    html += "<br />\n";
                    // Add error messages
                    html += "<span class=\"error\" ng-show=\"password_form." + fld + ".$dirty && " +
                        "password_form." + fld + ".$error.required\">A value is required!</span>\n";
                    if (field.awPassMatch) {
                        html += "<span class=\"error\" ng-show=\"password_form." + fld +
                            ".$error.awpassmatch\">Must match Password value</span>\n";
                    }
                    html += "<span class=\"error api-error\" ng-bind=\"" + fld + "_api_error\"></span>\n";
                    html += "</div>\n";
                    html += "</div>\n";
                }
                html += "</form>\n";
                element = angular.element(document.getElementById('password-body'));
                element.html(html);
                $compile(element.contents())(scope);
                $('#password-modal').modal();
                $('#password-modal').on('shown.bs.modal', function () {
                    $('#password-body').find('input[type="password"]:first').focus();
                });
            } else {
                scope.startJob();
            }
        };
    }
])

.factory('SubmitJob', ['PromptPasswords', '$compile', 'Rest', '$location', 'GetBasePath', 'CredentialList',
    'LookUpInit', 'CredentialForm', 'ProcessErrors', 'JobTemplateForm', 'Wait',
    function (PromptPasswords, $compile, Rest, $location, GetBasePath, CredentialList, LookUpInit, CredentialForm,
        ProcessErrors, JobTemplateForm, Wait) {
        return function (params) {
            var scope = params.scope,
                id = params.id,
                template_name = (params.template) ? params.template : null,
                base = $location.path().replace(/^\//, '').split('/')[0],
                url = GetBasePath(base) + id + '/';

            function postJob(data) {
                var dt, url, name;
                // Create the job record
                if (scope.credentialWatchRemove) {
                    scope.credentialWatchRemove();
                }
                dt = new Date().toISOString();
                url = (data.related.jobs) ? data.related.jobs : data.related.job_template + 'jobs/';
                name = (template_name) ? template_name : data.name;
                Wait('start');
                Rest.setUrl(url);
                Rest.post({
                    name: name + ' ' + dt, // job name required and unique
                    description: data.description,
                    job_template: data.id,
                    inventory: data.inventory,
                    project: data.project,
                    playbook: data.playbook,
                    credential: data.credential,
                    forks: data.forks,
                    limit: data.limit,
                    verbosity: data.verbosity,
                    extra_vars: data.extra_vars
                }).success(function (data) {
                    scope.job_id = data.id;
                    if (data.passwords_needed_to_start.length > 0) {
                        // Passwords needed. Prompt for passwords, then start job.
                        PromptPasswords({
                            scope: scope,
                            passwords: data.passwords_needed_to_start,
                            start_url: data.related.start,
                            form: CredentialForm
                        });
                    } else {
                        // No passwords needed, start the job!
                        Rest.setUrl(data.related.start);
                        Rest.post()
                            .success(function () {
                                Wait('stop');
                                var base = $location.path().replace(/^\//, '').split('/')[0];
                                if (base === 'jobs') {
                                    scope.refresh();
                                } else {
                                    $location.path('/jobs');
                                }
                            })
                            .error(function (data, status) {
                                ProcessErrors(scope, data, status, null, { hdr: 'Error!',
                                    msg: 'Failed to start job. POST returned status: ' + status });
                            });
                    }
                }).error(function (data, status) {
                    Wait('stop');
                    ProcessErrors(scope, data, status, null, { hdr: 'Error!',
                        msg: 'Failed to create job. POST returned status: ' + status });
                });
            }

            // Get the job or job_template record
            Wait('start');
            Rest.setUrl(url);
            Rest.get()
                .success(function (data) {
                    // Create a job record
                    scope.credential = '';
                    if (data.credential === '' || data.credential === null) {
                        // Template does not have credential, prompt for one
                        Wait('stop');
                        if (scope.credentialWatchRemove) {
                            scope.credentialWatchRemove();
                        }
                        scope.credentialWatchRemove = scope.$watch('credential', function (newVal, oldVal) {
                            if (newVal !== oldVal) {
                                // After user selects a credential from the modal,
                                // submit the job
                                if (scope.credential !== '' && scope.credential !== null && scope.credential !== undefined) {
                                    data.credential = scope.credential;
                                    postJob(data);
                                }
                            }
                        });
                        LookUpInit({
                            scope: scope,
                            form: JobTemplateForm,
                            current_item: null,
                            list: CredentialList,
                            field: 'credential',
                            hdr: 'Credential Required'
                        });
                        scope.lookUpCredential();
                    } else {
                        // We have what we need, submit the job
                        postJob(data);
                    }
                })
                .error(function (data, status) {
                    ProcessErrors(scope, data, status, null, { hdr: 'Error!',
                        msg: 'Failed to get job template details. GET returned status: ' + status });
                });
        };
    }
])

// Sumbit SCM Update request
.factory('ProjectUpdate', ['PromptPasswords', '$compile', 'Rest', '$location', 'GetBasePath', 'ProcessErrors', 'Alert',
    'ProjectsForm', 'Wait',
    function (PromptPasswords, $compile, Rest, $location, GetBasePath, ProcessErrors, Alert, ProjectsForm, Wait) {
        return function (params) {
            var scope = params.scope,
                project_id = params.project_id,
                url = GetBasePath('projects') + project_id + '/update/';

            if (scope.removeUpdateSubmitted) {
                scope.removeUpdateSubmitted();
            }
            scope.removeUpdateSubmitted = scope.$on('UpdateSubmitted', function () {
                // Refresh the project list after update request submitted
                Wait('stop');
                Alert('Update Started', 'The request to start the SCM update process was submitted. ' +
                    'To monitor the update status, refresh the page by clicking the <em>Refresh</em> button.', 'alert-info');
                scope.refresh();
            });

            if (scope.removeSCMSubmit) {
                scope.removeSCMSubmit();
            }
            scope.removeSCMSubmit = scope.$on('SCMSubmit', function (e, passwords_needed_to_update, extra_html) {
                // After the call to update, kick off the job.
                PromptPasswords({
                    scope: scope,
                    passwords: passwords_needed_to_update,
                    start_url: url,
                    form: ProjectsForm,
                    extra_html: extra_html
                });
            });

            // Check to see if we have permission to perform the update and if any passwords are needed
            Wait('start');
            Rest.setUrl(url);
            Rest.get()
                .success(function (data) {
                    var i, extra_html;
                    Wait('stop');
                    if (data.can_update) {
                        extra_html = '';
                        for (i = 0; i < scope.projects.length; i++) {
                            if (scope.projects[i].id === project_id) {
                                extra_html += "<div class=\"form-group\">\n";
                                extra_html += "<label class=\"control-label col-lg-3 normal-weight\" for=\"scm_url\">SCM URL</label>\n";
                                extra_html += "<div class=\"col-lg-9\">\n";
                                extra_html += "<input type=\"text\" readonly";
                                extra_html += ' name=\"scm_url\" ';
                                extra_html += "class=\"form-control\" ";
                                extra_html += "value=\"" + scope.projects[i].scm_url + "\" ";
                                extra_html += "/>";
                                extra_html += "</div>\n";
                                extra_html += "</div>\n";
                                if (scope.projects[i].scm_username) {
                                    extra_html += "<div class=\"form-group\">\n";
                                    extra_html += "<label class=\"control-label col-lg-3 normal-weight\" for=\"scm_username\">SCM Username</label>\n";
                                    extra_html += "<div class=\"col-lg-9\">\n";
                                    extra_html += "<input type=\"text\" readonly";
                                    extra_html += ' name=\"scm_username\" ';
                                    extra_html += "class=\"form-control\" ";
                                    extra_html += "value=\"" + scope.projects[i].scm_username + "\" ";
                                    extra_html += "/>";
                                    extra_html += "</div>\n";
                                    extra_html += "</div>\n";
                                }
                                break;
                            }
                        }
                        extra_html += "</p>";
                        scope.$emit('SCMSubmit', data.passwords_needed_to_update, extra_html);
                    } else {
                        Alert('Permission Denied', 'You do not have access to update this project. Please contact your system administrator.',
                            'alert-danger');
                    }
                })
                .error(function (data, status) {
                    ProcessErrors(scope, data, status, null, {
                        hdr: 'Error!',
                        msg: 'Failed to get project update details: ' + url + ' GET status: ' + status
                    });
                });
        };
    }
])


// Submit Inventory Update request
.factory('InventoryUpdate', ['PromptPasswords', '$compile', 'Rest', '$location', 'GetBasePath', 'ProcessErrors', 'Alert',
    'GroupForm', 'BuildTree', 'Wait',
    function (PromptPasswords, $compile, Rest, $location, GetBasePath, ProcessErrors, Alert, GroupForm, BuildTree, Wait) {
        return function (params) {

            var scope = params.scope,
                url = params.url,
                group_id = params.group_id,
                tree_id = params.tree_id;

            if (scope.removeHostReloadComplete) {
                scope.removeHostReloadComplete();
            }
            scope.removeHostReloadComplete = scope.$on('HostReloadComplete', function () {
                //Wait('stop');
                Alert('Update Started', 'Your request to start the inventory sync process was submitted. Monitor progress ' +
                    'by clicking the <i class="fa fa-refresh fa-lg"></i> button.', 'alert-info');
                if (scope.removeHostReloadComplete) {
                    scope.removeHostReloadComplete();
                }
            });

            if (scope.removeUpdateSubmitted) {
                scope.removeUpdateSubmitted();
            }
            scope.removeUpdateSubmitted = scope.$on('UpdateSubmitted', function (e, action) {
                setTimeout(function() {
                    if (action === 'started') {
                        if (scope.refreshGroups) {
                            scope.selected_tree_id = tree_id;
                            scope.selected_group_id = group_id;
                            scope.refreshGroups();
                        } else if (scope.refresh) {
                            scope.refresh();
                        }
                        scope.$emit('HostReloadComplete');
                    }
                }, 2000);
            });

            if (scope.removeInventorySubmit) {
                scope.removeInventorySubmit();
            }
            scope.removeInventorySubmit = scope.$on('InventorySubmit', function (e, passwords_needed_to_update, extra_html) {
                // After the call to update, kick off the job.
                PromptPasswords({
                    scope: scope,
                    passwords: passwords_needed_to_update,
                    start_url: url,
                    form: GroupForm,
                    extra_html: extra_html
                });
            });

            // Check to see if we have permission to perform the update and if any passwords are needed
            Wait('start');
            Rest.setUrl(url);
            Rest.get()
                .success(function (data) {
                    if (data.can_update) {
                        //var extra_html = "<div class=\"inventory-passwd-msg\">Starting inventory update for <em>" + group_name + 
                        //    "</em>. Please provide the " + group_source + " credentials:</div>\n";
                        scope.$emit('InventorySubmit', data.passwords_needed_to_update);
                    } else {
                        Wait('stop');
                        Alert('Permission Denied', 'You do not have access to run the update. Please contact your system administrator.',
                            'alert-danger');
                    }
                })
                .error(function (data, status) {
                    Wait('stop');
                    ProcessErrors(scope, data, status, null, { hdr: 'Error!',
                        msg: 'Failed to get inventory_source details. ' + url + 'GET status: ' + status });
                });
        };
    }
]);