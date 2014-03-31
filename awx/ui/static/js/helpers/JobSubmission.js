/*********************************************
 *  Copyright (c) 2014 AnsibleWorks, Inc.
 *
 *  JobSubmission.js
 *
 */

'use strict';

angular.module('JobSubmissionHelper', [ 'RestServices', 'Utilities', 'CredentialFormDefinition', 'CredentialsListDefinition',
    'LookUpHelper', 'JobSubmissionHelper', 'JobTemplateFormDefinition' ])

.factory('LaunchJob', ['Rest', 'Wait', 'ProcessErrors', function(Rest, Wait, ProcessErrors) {
    return function(params) {
        var scope = params.scope,
            passwords = params.passwords || {},
            callback = params.callback || 'JobLaunched',
            url = params.url;
        
        Wait('start');
        Rest.setUrl(url);
        Rest.post(passwords)
            .success(function () {
                scope.$emit(callback);
            })
            .error(function (data, status) {
                ProcessErrors(scope, data, status, null, { hdr: 'Error!',
                    msg: 'Attempt to start job at ' + url + ' failed. POST returned: ' + status });
            });
    };
}])

.factory('PromptForCredential', ['Wait', 'GetBasePath', 'LookUpInit', 'JobTemplateForm', 'CredentialList',
function(Wait, GetBasePath, LookUpInit, JobTemplateForm, CredentialList) {
    return function(params) {
        
        var scope = params.scope,
            callback = params.callback || 'CredentialReady',
            selectionMade;
        
        Wait('stop');
        scope.credential = '';

        selectionMade = function () {
            scope.$emit(callback, scope.credential);
        };
        
        LookUpInit({
            url: GetBasePath('credentials') + '?kind=ssh',
            scope: scope,
            form: JobTemplateForm(),
            current_item: null,
            list: CredentialList,
            field: 'credential',
            hdr: 'Credential Required',
            instructions: "Launching this job requires a machine credential. Please select your machine credential now or Cancel to quit.",
            postAction: selectionMade
        });
        scope.lookUpCredential();
    };
}])

.factory('PromptForPasswords', ['$compile', 'Wait', 'Alert', 'CredentialForm',
    function($compile, Wait, Alert, CredentialForm) {
        return function(params) {
            var parent_scope = params.scope,
                passwords = params.passwords,
                callback = params.callback || 'PasswordsAccepted',
                password,
                form = CredentialForm,
                html = "",
                acceptedPasswords = {},
                scope = parent_scope.$new();

            Wait('stop');
            
            function promptPassword() {
                var e, fld, field;

                password = passwords.pop();
                
                // Prompt for password
                html += "<form name=\"password_form\" novalidate>\n";
                field = form.fields[password];
                fld = password;
                scope[fld] = '';
                html += "<div class=\"form-group\">\n";
                html += "<label for=\"" + fld + "\">* " + field.label + "</label>\n";
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

                // Add the related confirm field
                if (field.associated) {
                    fld = field.associated;
                    field = form.fields[field.associated];
                    scope[fld] = '';
                    html += "<div class=\"form-group\">\n";
                    html += "<label for=\"" + fld + "\">* " + field.label + "</label>\n";
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
                    html += (field.awPassMatch) ? "<span class=\"error\" ng-show=\"password_form." + fld +
                        ".$error.awpassmatch\">Must match Password value</span>\n" : "";
                    html += "<span class=\"error api-error\" ng-bind=\"" + fld + "_api_error\"></span>\n";
                    html += "</div>\n";
                }
                html += "</form>\n";
                $('#password-body').empty().html(html);
                e = angular.element(document.getElementById('password-modal'));
                $compile(e)(scope);
                $('#password-modal').modal();
                $('#password-modal').on('shown.bs.modal', function () {
                    $('#password-body').find('input[type="password"]:first').focus();
                });
            }

            scope.passwordAccept = function() {
                $('#password-modal').modal('hide');
                acceptedPasswords[password] = scope[password];
                if (passwords.length > 0) {
                    promptPassword();
                }
                else {
                    parent_scope.$emit(callback, acceptedPasswords);
                }
            };

            scope.passwordCancel = function() {
                $('#password-modal').modal('hide');
                Alert('Missing Password', 'Required password(s) not provided. Your request will not be submitted.', 'alert-info');
                parent_scope.$emit('PasswordsCanceled');
            };

            promptPassword();
        };
    }])

// Submit request to run a playbook
.factory('PlaybookRun', ['LaunchJob', 'PromptForPasswords', 'Rest', '$location', 'GetBasePath', 'ProcessErrors', 'Wait', 'Empty', 'PromptForCredential',
    function (LaunchJob, PromptForPasswords, Rest, $location, GetBasePath, ProcessErrors, Wait, Empty, PromptForCredential) {
        return function (params) {
            var scope = params.scope,
                id = params.id,
                base = $location.path().replace(/^\//, '').split('/')[0],
                url = GetBasePath(base) + id + '/',
                job_template,
                new_job_id,
                launch_url;

            if (scope.removePostTheJob) {
                scope.removePostTheJob();
            }
            scope.removePostTheJob = scope.$on('PostTheJob', function() {
                var url = (job_template.related.jobs) ? job_template.related.jobs : job_template.related.job_template + 'jobs/';
                Wait('start');
                Rest.setUrl(url);
                Rest.post(job_template).success(function (data) {
                    new_job_id = data.id;
                    launch_url = data.related.start;
                    if (data.passwords_needed_to_start.length > 0) {
                        scope.$emit('PromptForPasswords', data.passwords_needed_to_start);
                    } else {
                        scope.$emit('StartPlaybookRun', {});
                    }
                }).error(function (data, status) {
                    ProcessErrors(scope, data, status, null, { hdr: 'Error!',
                        msg: 'Failed to create job. POST returned status: ' + status });
                });
            });

            if (scope.removePasswordsCanceled) {
                scope.removePasswordsCanceled();
            }
            scope.removePasswordCanceled = scope.$on('PasswordCanceled', function() {
                // Delete the job
                Wait('start');
                Rest.setUrl(GetBasePath('jobs') + new_job_id + '/');
                Rest.destroy()
                    .success(function() {
                        Wait('stop');
                    })
                    .error(function (data, status) {
                        ProcessErrors(scope, data, status, null, { hdr: 'Error!',
                            msg: 'Call to ' + url + ' failed. DELETE returned status: ' + status });
                    });
            });

            if (scope.removePlaybookLaunchFinished) {
                scope.removePlaybookLaunchFinished();
            }
            scope.removePlaybookLaunchFinished = scope.$on('PlaybookLaunchFinished', function() {
                var base = $location.path().replace(/^\//, '').split('/')[0];
                if (base === 'jobs') {
                    scope.refresh();
                } else {
                    $location.path('/jobs');
                }
            });

            if (scope.removeStartPlaybookRun) {
                scope.removeStartPlaybookRun();
            }
            scope.removeStartJob = scope.$on('StartPlaybookRun', function(e, passwords) {
                LaunchJob({
                    scope: scope,
                    url: launch_url,
                    callback: 'PlaybookLaunchFinished',
                    passwords: passwords
                });
            });

            if (scope.removePromptForPasswords) {
                scope.removePromptForPasswords();
            }
            scope.removePromptForPasswords = scope.$on('PromptForPasswords', function(e, passwords) {
                PromptForPasswords({ scope: scope, passwords: passwords, callback: 'StartPlaybookRun' });
            });

            if (scope.removePromptForCredential) {
                scope.removePromptForCredential();
            }
            scope.removePromptForCredential = scope.$on('PromptForCredential', function(e, data) {
                PromptForCredential({ scope: scope, template: data });
            });

            if (scope.removeCredentialReady) {
                scope.removeCredentialReady();
            }
            scope.removeCredentialReady = scope.$on('CredentialReady', function(e, credential) {
                if (!Empty(credential)) {
                    job_template.credential = credential;
                    scope.$emit('PostTheJob');
                }
            });

            // Get the job or job_template record
            Wait('start');
            Rest.setUrl(url);
            Rest.get()
                .success(function (data) {
                    delete data.id;
                    job_template = data;
                    if (Empty(data.credential)) {
                        scope.$emit('PromptForCredential');
                    } else {
                        // We have what we need, submit the job
                        scope.$emit('PostTheJob');
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
.factory('ProjectUpdate', ['PromptForPasswords', 'LaunchJob', 'Rest', '$location', 'GetBasePath', 'ProcessErrors', 'Alert',
    'ProjectsForm', 'Wait',
    function (PromptForPasswords, LaunchJob, Rest, $location, GetBasePath, ProcessErrors, Alert, ProjectsForm, Wait) {
        return function (params) {
            var scope = params.scope,
                project_id = params.project_id,
                url = GetBasePath('projects') + project_id + '/update/',
                project;

            if (scope.removeUpdateSubmitted) {
                scope.removeUpdateSubmitted();
            }
            scope.removeUpdateSubmitted = scope.$on('UpdateSubmitted', function() {
                // Refresh the project list after update request submitted
                Wait('stop');
                Alert('Update Started', 'The request to start the SCM update process was submitted. ' +
                    'To monitor the update status, refresh the page by clicking the <i class="fa fa-refresh"></i> button.', 'alert-info');
                if (scope.refreshJobs) {
                    scope.refreshJobs();
                }
                else if (scope.refresh) {
                    scope.refresh();
                }
            });

            if (scope.removePromptForPasswords) {
                scope.removePromptForPasswords();
            }
            scope.removePromptForPasswords = scope.$on('PromptForPasswords', function() {
                PromptForPasswords({ scope: scope, passwords: project.passwords_needed_to_update, callback: 'StartTheUpdate' });
            });

            if (scope.removeStartTheUpdate) {
                scope.removeStartTheUpdate();
            }
            scope.removeStartTheUpdate = scope.$on('StartTheUpdate', function(e, passwords) {
                LaunchJob({ scope: scope, url: url, passwords: passwords, callback: 'UpdateSubmitted' });
            });

            // Check to see if we have permission to perform the update and if any passwords are needed
            Wait('start');
            Rest.setUrl(url);
            Rest.get()
                .success(function (data) {
                    project = data;
                    Wait('stop');
                    if (project.can_update) {
                        if (project.passwords_needed_to_updated) {
                            scope.$emit('PromptForPasswords');
                        }
                        else {
                            scope.$emit('StartTheUpdate', {});
                        }
                    }
                    else {
                        Alert('Permission Denied', 'You do not have access to update this project. Please contact your system administrator.',
                            'alert-danger');
                    }
                })
                .error(function (data, status) {
                    ProcessErrors(scope, data, status, null, { hdr: 'Error!',
                        msg: 'Failed to lookup project ' + url + ' GET returned: ' + status });
                });
        };
    }
])


// Submit Inventory Update request
.factory('InventoryUpdate', ['PromptForPasswords', 'LaunchJob', 'Rest', '$location', 'GetBasePath', 'ProcessErrors', 'Alert', 'Wait',
    function (PromptForPasswords, LaunchJob, Rest, $location, GetBasePath, ProcessErrors, Alert, Wait) {
        return function (params) {

            var scope = params.scope,
                url = params.url,
                group_id = params.group_id,
                tree_id = params.tree_id,
                inventory_source;

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
            scope.removeUpdateSubmitted = scope.$on('UpdateSubmitted', function () {
                setTimeout(function() {
                    if (scope.refreshGroups) {
                        scope.selected_tree_id = tree_id;
                        scope.selected_group_id = group_id;
                        scope.refreshGroups();
                    } else if (scope.refresh) {
                        scope.refresh();
                    }
                    scope.$emit('HostReloadComplete');
                }, 2000);
            });

            if (scope.removePromptForPasswords) {
                scope.removePromptForPasswords();
            }
            scope.removePromptForPasswords = scope.$on('PromptForPasswords', function() {
                PromptForPasswords({ scope: scope, passwords: inventory_source.passwords_needed_to_update, callback: 'StartTheUpdate' });
            });

            if (scope.removeStartTheUpdate) {
                scope.removeStartTheUpdate();
            }
            scope.removeStartTheUpdate = scope.$on('StartTheUpdate', function(e, passwords) {
                LaunchJob({ scope: scope, url: url, passwords: passwords, callback: 'UpdateSubmitted' });
            });

            // Check to see if we have permission to perform the update and if any passwords are needed
            Wait('start');
            Rest.setUrl(url);
            Rest.get()
                .success(function (data) {
                    inventory_source = data;
                    if (data.can_update) {
                        if (data.passwords_needed_to_update) {
                            scope.$emit('PromptForPasswords');
                        }
                        else {
                            scope.$emit('StartTheUpdate', {});
                        }
                    } else {
                        Wait('stop');
                        Alert('Permission Denied', 'You do not have access to run the inventory sync. Please contact your system administrator.',
                            'alert-danger');
                    }
                })
                .error(function (data, status) {
                    ProcessErrors(scope, data, status, null, { hdr: 'Error!',
                        msg: 'Failed to get inventory source ' + url + ' GET returned: ' + status });
                });
        };
    }
]);