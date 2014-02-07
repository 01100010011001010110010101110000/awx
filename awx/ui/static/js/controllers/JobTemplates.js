/************************************
 * Copyright (c) 2014 AnsibleWorks, Inc.
 *
 *
 *  JobTemplates.js
 *
 *  Controller functions for the Job Template model.
 *
 */
'use strict';

function JobTemplatesList($scope, $rootScope, $location, $log, $routeParams, Rest, Alert, JobTemplateList,
    GenerateList, LoadBreadCrumbs, Prompt, SearchInit, PaginateInit, ReturnToCaller,
    ClearScope, ProcessErrors, GetBasePath, PromptPasswords, JobTemplateForm, CredentialList,
    LookUpInit, SubmitJob, Wait, Stream) {
    ClearScope('htmlTemplate'); //Garbage collection. Don't leave behind any listeners/watchers from the prior
    //scope.
    var list = JobTemplateList,
        defaultUrl = GetBasePath('job_templates'),
        view = GenerateList,
        base = $location.path().replace(/^\//, '').split('/')[0],
        mode = (base === 'job_templates') ? 'edit' : 'select',
        scope = view.inject(list, { mode: mode });

    $rootScope.flashMessage = null;

    if (scope.removePostRefresh) {
        scope.removePostRefresh();
    }
    scope.removePostRefresh = scope.$on('PostRefresh', function () {
        // Cleanup after a delete
        Wait('stop');
        $('#prompt-modal').off();
    });

    SearchInit({
        scope: scope,
        set: 'job_templates',
        list: list,
        url: defaultUrl
    });
    PaginateInit({
        scope: scope,
        list: list,
        url: defaultUrl
    });

    // Called from Inventories tab, host failed events link:
    if ($routeParams.name) {
        scope[list.iterator + 'SearchField'] = 'name';
        scope[list.iterator + 'SearchValue'] = $routeParams.name;
        scope[list.iterator + 'SearchFieldLabel'] = list.fields.name.label;
    }

    scope.search(list.iterator);

    LoadBreadCrumbs();

    scope.showActivity = function () {
        Stream({
            scope: scope
        });
    };

    scope.addJobTemplate = function () {
        $location.path($location.path() + '/add');
    };

    scope.editJobTemplate = function (id) {
        $location.path($location.path() + '/' + id);
    };

    scope.deleteJobTemplate = function (id, name) {
        var action = function () {
            $('#prompt-modal').on('hidden.bs.modal', function () {
                Wait('start');
            });
            $('#prompt-modal').modal('hide');
            var url = defaultUrl + id + '/';
            Rest.setUrl(url);
            Rest.destroy()
                .success(function () {
                    scope.search(list.iterator);
                })
                .error(function (data) {
                    Wait('stop');
                    ProcessErrors(scope, data, status, null, {
                        hdr: 'Error!',
                        msg: 'Call to ' + url + ' failed. DELETE returned status: ' + status
                    });
                });
        };

        Prompt({
            hdr: 'Delete',
            body: 'Are you sure you want to delete ' + name + '?',
            action: action
        });
    };

    scope.submitJob = function (id) {
        SubmitJob({ scope: scope, id: id });
    };
}

JobTemplatesList.$inject = ['$scope', '$rootScope', '$location', '$log', '$routeParams', 'Rest', 'Alert', 'JobTemplateList',
    'GenerateList', 'LoadBreadCrumbs', 'Prompt', 'SearchInit', 'PaginateInit', 'ReturnToCaller', 'ClearScope',
    'ProcessErrors', 'GetBasePath', 'PromptPasswords', 'JobTemplateForm', 'CredentialList', 'LookUpInit',
    'SubmitJob', 'Wait', 'Stream'
];

function JobTemplatesAdd($scope, $rootScope, $compile, $location, $log, $routeParams, JobTemplateForm,
    GenerateForm, Rest, Alert, ProcessErrors, LoadBreadCrumbs, ReturnToCaller, ClearScope,
    GetBasePath, InventoryList, CredentialList, ProjectList, LookUpInit,
    md5Setup, ParseTypeChange, Wait, Empty) {
    ClearScope('htmlTemplate'); //Garbage collection. Don't leave behind any listeners/watchers from the prior
    //scope.

    // Inject dynamic view
    var defaultUrl = GetBasePath('job_templates'),
        form = JobTemplateForm,
        generator = GenerateForm,
        scope = generator.inject(form, { mode: 'add', related: false }),
        master = {},
        CloudCredentialList = {},
        selectPlaybook, checkSCMStatus;

    scope.parseType = 'yaml';
    ParseTypeChange(scope);

    scope.job_type_options = [
        { value: 'run', label: 'Run' },
        { value: 'check', label: 'Check' }
    ];

    scope.verbosity_options = [
        { value: '0', label: 'Default' },
        { value: '1', label: 'Verbose' },
        { value: '3', label: 'Debug' }
    ];

    scope.playbook_options = [];
    scope.allow_callbacks = 'false';

    generator.reset();
    LoadBreadCrumbs();

    md5Setup({
        scope: scope,
        master: master,
        check_field: 'allow_callbacks',
        default_val: false
    });

    LookUpInit({
        scope: scope,
        form: form,
        current_item: null,
        list: InventoryList,
        field: 'inventory'
    });

    // Clone the CredentialList object for use with cloud_credential. Cloning
    // and changing properties to avoid collision.
    jQuery.extend(true, CloudCredentialList, CredentialList);
    CloudCredentialList.name = 'cloudcredentials';
    CloudCredentialList.iterator = 'cloudcredential';

    LookUpInit({
        url: GetBasePath('credentials') + '?cloud=true',
        scope: scope,
        form: form,
        current_item: null,
        list: CloudCredentialList,
        field: 'cloud_credential',
        hdr: 'Select Cloud Credential'
    });

    LookUpInit({
        url: GetBasePath('credentials') + '?kind=ssh',
        scope: scope,
        form: form,
        current_item: null,
        list: CredentialList,
        field: 'credential',
        hdr: 'Select Machine Credential'
    });

    // Update playbook select whenever project value changes
    selectPlaybook = function (oldValue, newValue) {
        var url;
        if (oldValue !== newValue) {
            if (scope.project) {
                Wait('start');
                url = GetBasePath('projects') + scope.project + '/playbooks/';
                Rest.setUrl(url);
                Rest.get()
                    .success(function (data) {
                        var i, opts = [];
                        for (i = 0; i < data.length; i++) {
                            opts.push(data[i]);
                        }
                        scope.playbook_options = opts;
                        Wait('stop');
                    })
                    .error(function (data, status) {
                        ProcessErrors(scope, data, status, form, {
                            hdr: 'Error!',
                            msg: 'Failed to get playbook list for ' + url + '. GET returned status: ' + status
                        });
                    });
            }
        }
    };

    // Detect and alert user to potential SCM status issues
    checkSCMStatus = function (oldValue, newValue) {
        if (oldValue !== newValue && !Empty(scope.project)) {
            Rest.setUrl(GetBasePath('projects') + scope.project + '/');
            Rest.get()
                .success(function (data) {
                    var msg;
                    switch (data.status) {
                    case 'failed':
                        msg = "The selected project has a <em>failed</em> status. Review the project's SCM settings" +
                            " and run an update before adding it to a template.";
                        break;
                    case 'never updated':
                        msg = 'The selected project has a <em>never updated</em> status. You will need to run a successful' +
                            ' update in order to selected a playbook. Without a valid playbook you will not be able ' +
                            ' to save this template.';
                        break;
                    case 'missing':
                        msg = 'The selected project has a status of <em>missing</em>. Please check the server and make sure ' +
                            ' the directory exists and file permissions are set correctly.';
                        break;
                    }
                    if (msg) {
                        Alert('Waning', msg, 'alert-info');
                    }
                })
                .error(function (data, status) {
                    ProcessErrors(scope, data, status, form, {
                        hdr: 'Error!',
                        msg: 'Failed to get project ' + scope.project + '. GET returned status: ' + status
                    });
                });
        }
    };

    // Register a watcher on project_name
    if (scope.selectPlaybookUnregister) {
        scope.selectPlaybookUnregister();
    }
    scope.selectPlaybookUnregister = scope.$watch('project_name', function (oldval, newval) {
        selectPlaybook(oldval, newval);
        checkSCMStatus(oldval, newval);
    });

    LookUpInit({
        scope: scope,
        form: form,
        current_item: null,
        list: ProjectList,
        field: 'project'
    });

    // Save
    scope.formSave = function () {
        generator.clearApiErrors();
        Wait('start');
        var data = {}, json_data, fld;
        try {
            // Make sure we have valid variable data
            if (scope.parseType === 'json') {
                json_data = JSON.parse(scope.variables); //make sure JSON parses
            } else {
                json_data = jsyaml.load(scope.variables); //parse yaml
            }

            // Make sure our JSON is actually an object
            if (typeof json_data !== 'object') {
                throw "failed to return an object!";
            }

            for (fld in form.fields) {
                if (form.fields[fld].type === 'select' && fld !== 'playbook') {
                    data[fld] = scope[fld].value;
                } else {
                    if (fld !== 'variables') {
                        data[fld] = scope[fld];
                    }
                }
            }

            data.extra_vars = JSON.stringify(json_data, undefined, '\t');
            if (Empty(data.extra_vars)) {
                data.extra_vars = "";
            }

            Rest.setUrl(defaultUrl);
            Rest.post(data)
                .success(function () {
                    Wait('stop');
                    var base = $location.path().replace(/^\//, '').split('/')[0];
                    if (base === 'job_templates') {
                        ReturnToCaller();
                    }
                    ReturnToCaller(1);
                })
                .error(function (data, status) {
                    Wait('stop');
                    ProcessErrors(scope, data, status, form, {
                        hdr: 'Error!',
                        msg: 'Failed to add new job template. POST returned status: ' + status
                    });
                });

        } catch (err) {
            Wait('stop');
            Alert("Error", "Error parsing extra variables. Parser returned: " + err);
        }
    };

    // Reset
    scope.formReset = function () {
        // Defaults
        generator.reset();
        //$('#forks-slider').slider("option", "value", scope.forks);
        for (var fld in master) {
            scope[fld] = master[fld];
        }
    };
}

JobTemplatesAdd.$inject = ['$scope', '$rootScope', '$compile', '$location', '$log', '$routeParams', 'JobTemplateForm',
    'GenerateForm', 'Rest', 'Alert', 'ProcessErrors', 'LoadBreadCrumbs', 'ReturnToCaller', 'ClearScope',
    'GetBasePath', 'InventoryList', 'CredentialList', 'ProjectList', 'LookUpInit',
    'md5Setup', 'ParseTypeChange', 'Wait', 'Empty'
];


function JobTemplatesEdit($scope, $rootScope, $compile, $location, $log, $routeParams, JobTemplateForm, GenerateForm, Rest,
    Alert, ProcessErrors, LoadBreadCrumbs, RelatedSearchInit, RelatedPaginateInit, ReturnToCaller, ClearScope, InventoryList,
    CredentialList, ProjectList, LookUpInit, PromptPasswords, GetBasePath, md5Setup, ParseTypeChange, JobStatusToolTip, FormatDate,
    Wait, Stream, Empty, Prompt) {
    
    ClearScope('htmlTemplate');

    var defaultUrl = GetBasePath('job_templates'),
        generator = GenerateForm,
        form = JobTemplateForm,
        scope = generator.inject(form, { mode: 'edit', related: true }),
        loadingFinishedCount = 0,
        base = $location.path().replace(/^\//, '').split('/')[0],
        master = {},
        id = $routeParams.id,
        relatedSets = {},
        checkSCMStatus, getPlaybooks;

    scope.parseType = 'yaml';
    ParseTypeChange(scope);

    // Our job type options
    scope.job_type_options = [
        { value: 'run', label: 'Run' },
        { value: 'check', label: 'Check' }
    ];
    
    scope.verbosity_options = [
        { value: '0', label: 'Default' },
        { value: '1', label: 'Verbose' },
        { value: '3', label: 'Debug' }
    ];

    scope.playbook_options = null;
    scope.playbook = null;
    generator.reset();

    getPlaybooks = function (project) {
        var url;
        if (!Empty(project)) {
            url = GetBasePath('projects') + project + '/playbooks/';
            Wait('start');
            Rest.setUrl(url);
            Rest.get()
                .success(function (data) {
                    var i;
                    scope.playbook_options = [];
                    for (i = 0; i < data.length; i++) {
                        scope.playbook_options.push(data[i]);
                        if (data[i] === scope.playbook) {
                            scope.job_templates_form.playbook.$setValidity('required', true);
                        }
                    }
                    if (scope.playbook) {
                        scope.$emit('jobTemplateLoadFinished');
                    } else {
                        Wait('stop');
                    }
                })
                .error(function () {
                    Wait('stop');
                    Alert('Missing Playbooks', 'Unable to retrieve the list of playbooks for this project. Choose a different ' +
                        ' project or make the playbooks available on the file system.', 'alert-info');
                });
        }
    };

    // Detect and alert user to potential SCM status issues
    checkSCMStatus = function () {
        if (!Empty(scope.project)) {
            Wait('start');
            Rest.setUrl(GetBasePath('projects') + scope.project + '/');
            Rest.get()
                .success(function (data) {
                    var msg;
                    switch (data.status) {
                    case 'failed':
                        msg = "The selected project has a <em>failed</em> status. Review the project's SCM settings" +
                            " and run an update before adding it to a template.";
                        break;
                    case 'never updated':
                        msg = 'The selected project has a <em>never updated</em> status. You will need to run a successful' +
                            ' update in order to selected a playbook. Without a valid playbook you will not be able ' +
                            ' to save this template.';
                        break;
                    case 'missing':
                        msg = 'The selected project has a status of <em>missing</em>. Please check the server and make sure ' +
                            ' the directory exists and file permissions are set correctly.';
                        break;
                    }
                    Wait('stop');
                    if (msg) {
                        Alert('Waning', msg, 'alert-info');
                    }
                })
                .error(function (data, status) {
                    ProcessErrors(scope, data, status, form, { hdr: 'Error!', msg: 'Failed to get project ' + scope.project +
                        '. GET returned status: ' + status });
                });
        }
    };


    // Register a watcher on project_name. Refresh the playbook list on change.
    if (scope.watchProjectUnregister) {
        scope.watchProjectUnregister();
    }
    scope.watchProjectUnregister = scope.$watch('project_name', function (oldValue, newValue) {
        if (oldValue !== newValue && newValue !== '' && newValue !== null && newValue !== undefined) {
            scope.playbook = null;
            getPlaybooks(scope.project);
            checkSCMStatus();
        }
    });

    // Turn off 'Wait' after both cloud credential and playbook list come back
    if (scope.removeJobTemplateLoadFinished) {
        scope.removeJobTemplateLoadFinished();
    }
    scope.removeJobTemplateLoadFinished = scope.$on('jobTemplateLoadFinished', function () {
        loadingFinishedCount++;
        if (loadingFinishedCount >= 2) {
            // The initial template load finished. Now load related jobs, which 
            // will turn off the 'working' spinner.
            for (var set in relatedSets) {
                scope.search(relatedSets[set].iterator);
            }

        }
    });

    // Set the status/badge for each related job
    if (scope.removeRelatedJobs) {
        scope.removeRelatedJobs();
    }
    scope.removeRelatedJobs = scope.$on('relatedjobs', function () {
        var i, cDate;
        if (scope.jobs && scope.jobs.length) {
            for (i = 0; i < scope.jobs.length; i++) {
                // Convert created date to local time zone 
                cDate = new Date(scope.jobs[i].created);
                scope.jobs[i].created = FormatDate(cDate);
                // Set tooltip and link
                scope.jobs[i].statusBadgeToolTip = JobStatusToolTip(scope.jobs[i].status) +
                    " Click to view status details.";
                scope.jobs[i].statusLinkTo = '/#/jobs/' + scope.jobs[i].id;
            }
        }
    });

    if (scope.cloudCredentialReadyRemove) {
        scope.cloudCredentialReadyRemove();
    }
    scope.cloudCredentialReadyRemove = scope.$on('cloudCredentialReady', function (e, name) {
        var CloudCredentialList = {};
        scope.cloud_credential_name = name;
        master.cloud_credential_name = name;
        // Clone the CredentialList object for use with cloud_credential. Cloning
        // and changing properties to avoid collision.
        jQuery.extend(true, CloudCredentialList, CredentialList);
        CloudCredentialList.name = 'cloudcredentials';
        CloudCredentialList.iterator = 'cloudcredential';
        LookUpInit({
            url: GetBasePath('credentials') + '?cloud=true',
            scope: scope,
            form: form,
            current_item: scope.cloud_credential,
            list: CloudCredentialList,
            field: 'cloud_credential',
            hdr: 'Select Cloud Credential'
        });
        scope.$emit('jobTemplateLoadFinished');
    });


    // Retrieve each related set and populate the playbook list
    if (scope.jobTemplateLoadedRemove) {
        scope.jobTemplateLoadedRemove();
    }
    scope.jobTemplateLoadedRemove = scope.$on('jobTemplateLoaded', function (e, related_cloud_credential) {
        var dft;
        getPlaybooks(scope.project);

        dft = (scope.host_config_key === "" || scope.host_config_key === null) ? 'false' : 'true';
        md5Setup({
            scope: scope,
            master: master,
            check_field: 'allow_callbacks',
            default_val: dft
        });

        if (related_cloud_credential) {
            Rest.setUrl(related_cloud_credential);
            Rest.get()
                .success(function (data) {
                    scope.$emit('cloudCredentialReady', data.name);
                })
                .error(function (data, status) {
                    ProcessErrors(scope, data, status, null, {hdr: 'Error!',
                        msg: 'Failed to related cloud credential. GET returned status: ' + status });
                });
        } else {
            // No existing cloud credential
            scope.$emit('cloudCredentialReady', null);
        }
    });

    Wait('start');
    // Retrieve detail record and prepopulate the form
    Rest.setUrl(defaultUrl + ':id/');
    Rest.get({ params: { id: id } })
        .success(function (data) {
            var fld, i, json_obj, related, set;
            LoadBreadCrumbs({ path: '/job_templates/' + id, title: data.name });
            for (fld in form.fields) {
                if (fld !== 'variables' && data[fld] !== null && data[fld] !== undefined) {
                    if (form.fields[fld].type === 'select') {
                        if (scope[fld + '_options'] && scope[fld + '_options'].length > 0) {
                            for (i = 0; i < scope[fld + '_options'].length; i++) {
                                if (data[fld] === scope[fld + '_options'][i].value) {
                                    scope[fld] = scope[fld + '_options'][i];
                                }
                            }
                        } else {
                            scope[fld] = data[fld];
                        }
                    } else {
                        scope[fld] = data[fld];
                    }
                    master[fld] = scope[fld];
                }
                if (fld === 'variables') {
                    // Parse extra_vars, converting to YAML.  
                    if ($.isEmptyObject(data.extra_vars) || data.extra_vars === "{}" || data.extra_vars === "null" ||
                        data.extra_vars === "" || data.extra_vars === null) {
                        scope.variables = "---";
                    } else {
                        json_obj = JSON.parse(data.extra_vars);
                        scope.variables = jsyaml.safeDump(json_obj);
                    }
                    master.variables = scope.variables;
                }
                if (form.fields[fld].type === 'lookup' && data.summary_fields[form.fields[fld].sourceModel]) {
                    scope[form.fields[fld].sourceModel + '_' + form.fields[fld].sourceField] =
                        data.summary_fields[form.fields[fld].sourceModel][form.fields[fld].sourceField];
                    master[form.fields[fld].sourceModel + '_' + form.fields[fld].sourceField] =
                        scope[form.fields[fld].sourceModel + '_' + form.fields[fld].sourceField];
                }
            }

            scope.url = data.url;
            related = data.related;
            for (set in form.related) {
                if (related[set]) {
                    relatedSets[set] = {
                        url: related[set],
                        iterator: form.related[set].iterator
                    };
                }
            }

            scope.callback_url = data.related.callback;
            master.callback_url = scope.callback_url;

            LookUpInit({
                scope: scope,
                form: form,
                current_item: data.inventory,
                list: InventoryList,
                field: 'inventory'
            });

            LookUpInit({
                url: GetBasePath('credentials') + '?kind=ssh',
                scope: scope,
                form: form,
                current_item: data.credential,
                list: CredentialList,
                field: 'credential',
                hdr: 'Select Machine Credential'
            });

            LookUpInit({
                scope: scope,
                form: form,
                current_item: data.project,
                list: ProjectList,
                field: 'project'
            });

            // Initialize related search functions. Doing it here to make sure relatedSets object is populated.
            RelatedSearchInit({
                scope: scope,
                form: form,
                relatedSets: relatedSets
            });
            RelatedPaginateInit({
                scope: scope,
                relatedSets: relatedSets
            });
            scope.$emit('jobTemplateLoaded', data.related.cloud_credential);
        })
        .error(function (data, status) {
            ProcessErrors(scope, data, status, form, {
                hdr: 'Error!',
                msg: 'Failed to retrieve job template: ' + $routeParams.id + '. GET status: ' + status
            });
        });

    // Save changes to the parent
    scope.formSave = function () {
        generator.clearApiErrors();
        Wait('start');
        var data = {}, json_data, fld;
        try {
            // Make sure we have valid variable data
            if (scope.parseType === 'json') {
                json_data = JSON.parse(scope.variables); //make sure JSON parses
            } else {
                json_data = jsyaml.load(scope.variables); //parse yaml
            }

            // Make sure our JSON is actually an object
            if (typeof json_data !== 'object') {
                throw "failed to return an object!";
            }

            for (fld in form.fields) {
                if (form.fields[fld].type === 'select' && fld !== 'playbook') {
                    data[fld] = scope[fld].value;
                } else {
                    if (fld !== 'variables' && fld !== 'callback_url') {
                        data[fld] = scope[fld];
                    }
                }
            }

            data.extra_vars = JSON.stringify(json_data, undefined, '\t');
            if (data.extra_vars === "null" || data.extra_vars === null) {
                data.extra_vars = "";
            }

            Rest.setUrl(defaultUrl + id + '/');
            Rest.put(data)
                .success(function () {
                    Wait('stop');
                    var base = $location.path().replace(/^\//, '').split('/')[0];
                    if (base === 'job_templates') {
                        ReturnToCaller();
                    }
                    ReturnToCaller(1);
                })
                .error(function (data, status) {
                    ProcessErrors(scope, data, status, form, {
                        hdr: 'Error!',
                        msg: 'Failed to update job template. PUT returned status: ' + status
                    });
                });

        } catch (err) {
            Wait('stop');
            Alert("Error", "Error parsing extra variables. Parser returned: " + err);
        }
    };

    scope.showActivity = function () {
        Stream({
            scope: scope
        });
    };

    // Cancel
    scope.formReset = function () {
        generator.reset();
        for (var fld in master) {
            scope[fld] = master[fld];
        }
        scope.parseType = 'yaml';
        $('#forks-slider').slider("option", "value", scope.forks);
    };

    // Related set: Add button
    scope.add = function (set) {
        $rootScope.flashMessage = null;
        $location.path('/' + base + '/' + $routeParams.id + '/' + set);
    };

    // Related set: Edit button
    scope.edit = function (set, id) {
        $rootScope.flashMessage = null;
        $location.path('/' + set + '/' + id);
    };

    // Related set: Delete button
    scope['delete'] = function (set, itm_id, name, title) {
        $rootScope.flashMessage = null;

        var action = function () {
            var url = defaultUrl + id + '/' + set + '/';
            Rest.setUrl(url);
            Rest.post({
                id: itm_id,
                disassociate: 1
            })
                .success(function () {
                    $('#prompt-modal').modal('hide');
                    scope.search(form.related[set].iterator);
                })
                .error(function (data, status) {
                    $('#prompt-modal').modal('hide');
                    ProcessErrors(scope, data, status, null, {
                        hdr: 'Error!',
                        msg: 'Call to ' + url + ' failed. POST returned status: ' + status
                    });
                });
        };

        Prompt({
            hdr: 'Delete',
            body: 'Are you sure you want to remove ' + name + ' from ' + scope.name + ' ' + title + '?',
            action: action
        });

    };
}

JobTemplatesEdit.$inject = ['$scope', '$rootScope', '$compile', '$location', '$log', '$routeParams', 'JobTemplateForm',
    'GenerateForm', 'Rest', 'Alert', 'ProcessErrors', 'LoadBreadCrumbs', 'RelatedSearchInit', 'RelatedPaginateInit',
    'ReturnToCaller', 'ClearScope', 'InventoryList', 'CredentialList', 'ProjectList', 'LookUpInit', 'PromptPasswords',
    'GetBasePath', 'md5Setup', 'ParseTypeChange', 'JobStatusToolTip', 'FormatDate', 'Wait', 'Stream', 'Empty', 'Prompt'
];