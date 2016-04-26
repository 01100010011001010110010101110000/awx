/*************************************************
 * Copyright (c) 2015 Ansible, Inc.
 *
 * All Rights Reserved
 *************************************************/

/**
 * @ngdoc function
 * @name forms.function:JobTemplate
 * @description This form is for adding/editing a Job Template
*/

export default
    angular.module('JobTemplateFormDefinition', [ 'CompletedJobsDefinition'])

        .value ('JobTemplateFormObject', {

            addTitle: 'New Job Template',
            editTitle: '{{ name }}',
            name: 'job_templates',
            base: 'job_templates',
            tabs: true,

            fields: {
                name: {
                    label: 'Name',
                    type: 'text',
                    addRequired: true,
                    editRequired: true,
                    column: 1
                },
                description: {
                    label: 'Description',
                    type: 'text',
                    addRequired: false,
                    editRequired: false,
                    column: 1
                },
                job_type: {
                    label: 'Job Type',
                    type: 'select',
                    ngOptions: 'type.label for type in job_type_options track by type.value',
                    ngChange: 'jobTypeChange()',
                    "default": 0,
                    addRequired: true,
                    editRequired: true,
                    column: 1,
                    awPopOver: "<p>When this template is submitted as a job, setting the type to <em>run</em> will execute the playbook, running tasks " +
                        " on the selected hosts.</p> <p>Setting the type to <em>check</em> will not execute the playbook. Instead, ansible will check playbook " +
                        " syntax, test environment setup and report problems.</p>",
                    dataTitle: 'Job Type',
                    dataPlacement: 'right',
                    dataContainer: "body",
                    subCheckbox: {
                        variable: 'ask_job_type_on_launch',
                        ngShow: "!job_type.value || job_type.value !== 'scan'",
                        text: 'Prompt on launch'
                    }
                },
                inventory: {
                    label: 'Inventory',
                    type: 'lookup',
                    sourceModel: 'inventory',
                    sourceField: 'name',
                    ngClick: 'lookUpInventory()',
                    awRequiredWhen: {
                        reqExpression: '!ask_inventory_on_launch',
                        alwaysShowAsterisk: true
                    },
                    requiredErrorMsg: "Please select an Inventory or check the Prompt on launch option.",
                    column: 1,
                    awPopOver: "<p>Select the inventory containing the hosts you want this job to manage.</p>",
                    dataTitle: 'Inventory',
                    dataPlacement: 'right',
                    dataContainer: "body",
                    subCheckbox: {
                        variable: 'ask_inventory_on_launch',
                        ngShow: "!job_type.value || job_type.value !== 'scan'",
                        text: 'Prompt on launch'
                    }
                },
                project: {
                    label: 'Project',
                    type: 'lookup',
                    sourceModel: 'project',
                    sourceField: 'name',
                    ngClick: 'lookUpProject()',
                    awRequiredWhen: {
                        reqExpression: "projectrequired",
                        init: "true"
                    },
                    column: 1,
                    awPopOver: "<p>Select the project containing the playbook you want this job to execute.</p>",
                    dataTitle: 'Project',
                    dataPlacement: 'right',
                    dataContainer: "body",
                },
                playbook: {
                    label: 'Playbook',
                    type:'select',
                    ngOptions: 'book for book in playbook_options track by book',
                    id: 'playbook-select',
                    awRequiredWhen: {
                        reqExpression: "playbookrequired",
                        init: "true"
                    },
                    column: 1,
                    awPopOver: "<p>Select the playbook to be executed by this job.</p>",
                    dataTitle: 'Playbook',
                    dataPlacement: 'right',
                    dataContainer: "body",
                },
                default_scan: {
                  type: 'custom',
                  column: 1,
                  ngShow: 'job_type.value === "scan" && project_name !== "Default"',
                  control: '<a href="" ng-click="toggleScanInfo()">Reset to default project and playbook</a>'
                },
                credential: {
                    label: 'Machine Credential',
                    type: 'lookup',
                    sourceModel: 'credential',
                    sourceField: 'name',
                    ngClick: 'lookUpCredential()',
                    awRequiredWhen: {
                        reqExpression: '!ask_credential_on_launch',
                        alwaysShowAsterisk: true
                    },
                    requiredErrorMsg: "Please select a Machine Credential or check the Prompt on launch option.",
                    column: 1,
                    awPopOver: "<p>Select the credential you want the job to use when accessing the remote hosts. Choose the credential containing " +
                     " the username and SSH key or password that Ansible will need to log into the remote hosts.</p>",
                    dataTitle: 'Credential',
                    dataPlacement: 'right',
                    dataContainer: "body",
                    subCheckbox: {
                        variable: 'ask_credential_on_launch',
                        text: 'Prompt on launch'
                    }
                },
                cloud_credential: {
                    label: 'Cloud Credential',
                    type: 'lookup',
                    sourceModel: 'cloud_credential',
                    sourceField: 'name',
                    ngClick: 'lookUpCloudcredential()',
                    addRequired: false,
                    editRequired: false,
                    column: 1,
                    awPopOver: "<p>Selecting an optional cloud credential in the job template will pass along the access credentials to the " +
                        "running playbook, allowing provisioning into the cloud without manually passing parameters to the included modules.</p>",
                    dataTitle: 'Cloud Credential',
                    dataPlacement: 'right',
                    dataContainer: "body"
                },
                forks: {
                    label: 'Forks',
                    id: 'forks-number',
                    type: 'number',
                    integer: true,
                    min: 0,
                    spinner: true,
                    "default": '0',
                    addRequired: false,
                    editRequired: false,
                    'class': "input-small",
                    column: 1,
                    awPopOver: '<p>The number of parallel or simultaneous processes to use while executing the playbook. 0 signifies ' +
                        'the default value from the <a id="ansible_forks_docs" href=\"http://docs.ansible.com/intro_configuration.html#the-ansible-configuration-file\" ' +
                        ' target=\"_blank\">ansible configuration file</a>.</p>',
                    dataTitle: 'Forks',
                    dataPlacement: 'right',
                    dataContainer: "body"
                },
                limit: {
                    label: 'Limit',
                    type: 'text',
                    addRequired: false,
                    editRequired: false,
                    column: 1,
                    awPopOver: "<p>Provide a host pattern to further constrain the list of hosts that will be managed or affected by the playbook. " +
                        "Multiple patterns can be separated by &#59; &#58; or &#44;</p><p>For more information and examples see " +
                        "<a href=\"http://docs.ansible.com/intro_patterns.html\" target=\"_blank\">the Patterns topic at docs.ansible.com</a>.</p>",
                    dataTitle: 'Limit',
                    dataPlacement: 'right',
                    dataContainer: "body",
                    subCheckbox: {
                        variable: 'ask_limit_on_launch',
                        text: 'Prompt on launch'
                    }
                },
                verbosity: {
                    label: 'Verbosity',
                    type: 'select',
                    ngOptions: 'v.label for v in verbosity_options track by v.value',
                    "default": 1,
                    addRequired: true,
                    editRequired: true,
                    column: 1,
                    awPopOver: "<p>Control the level of output ansible will produce as the playbook executes.</p>",
                    dataTitle: 'Verbosity',
                    dataPlacement: 'right',
                    dataContainer: "body"
                },
                job_tags: {
                    label: 'Job Tags',
                    type: 'textarea',
                    rows: 1,
                    addRequired: false,
                    editRequired: false,
                    'elementClass': 'Form-textInput',
                    column: 2,
                    awPopOver: "<p>Provide a comma separated list of tags.</p>\n" +
                        "<p>Tags are useful when you have a large playbook, and you want to run a specific part of a play or task.</p>" +
                        "<p>For example, you might have a task consisting of a long list of actions. Tag values can be assigned to each action. " +
                        "Suppose the actions have been assigned tag values of &quot;configuration&quot;, &quot;packages&quot; and &quot;install&quot;.</p>" +
                        "<p>If you just want to run the &quot;configuration&quot; and &quot;packages&quot; actions, you would enter the following here " +
                        "in the Job Tags field:</p>\n<blockquote>configuration,packages</blockquote>\n",
                    dataTitle: "Job Tags",
                    dataPlacement: "right",
                    dataContainer: "body",
                    subCheckbox: {
                        variable: 'ask_tags_on_launch',
                        text: 'Prompt on launch'
                    }
                },
                labels: {
                    label: 'Labels',
                    type: 'select',
                    ngOptions: 'label.label for label in labelOptions track by label.value',
                    multiSelect: true,
                    addRequired: false,
                    editRequired: false,
                    dataTitle: 'Labels',
                    dataPlacement: 'right',
                    awPopOver: 'You can add labels to a job template to aid in filtering',
                    dataContainer: 'body'
                },
                variables: {
                    label: 'Extra Variables',
                    type: 'textarea',
                    class: 'Form-textAreaLabel',
                    rows: 6,
                    addRequired: false,
                    editRequired: false,
                    "default": "---",
                    column: 2,
                    awPopOver: "<p>Pass extra command line variables to the playbook. This is the -e or --extra-vars command line parameter " +
                        "for ansible-playbook. Provide key/value pairs using either YAML or JSON.</p>" +
                        "JSON:<br />\n" +
                        "<blockquote>{<br />\"somevar\": \"somevalue\",<br />\"password\": \"magic\"<br /> }</blockquote>\n" +
                        "YAML:<br />\n" +
                        "<blockquote>---<br />somevar: somevalue<br />password: magic<br /></blockquote>\n",
                    dataTitle: 'Extra Variables',
                    dataPlacement: 'right',
                    dataContainer: "body",
                    subCheckbox: {
                        variable: 'ask_variables_on_launch',
                        text: 'Prompt on launch'
                    }
                },
                become_enabled: {
                  label: 'Enable Privilege Escalation',
                  type: 'checkbox',
                  addRequired: false,
                  editRequird: false,
                  column: 2,
                  awPopOver: "<p>If enabled,  run this playbook as an administrator. This is the equivalent of passing the<code> --become</code> option to the <code> ansible-playbook</code> command. </p>",
                  dataPlacement: 'right',
                  dataTitle: 'Become Privilege Escalation',
                  dataContainer: "body"
                },
                allow_callbacks: {
                    label: 'Allow Provisioning Callbacks',
                    type: 'checkbox',
                    addRequired: false,
                    editRequird: false,
                    ngChange: "toggleCallback('host_config_key')",
                    column: 2,
                    awPopOver: "<p>Enables creation of a provisioning callback URL. Using the URL a host can contact Tower and request a configuration update " +
                        "using this job template.</p>",
                    dataPlacement: 'right',
                    dataTitle: 'Allow Provisioning Callbacks',
                    dataContainer: "body"
                },
                callback_url: {
                    label: 'Provisioning Callback URL',
                    type: 'text',
                    addRequired: false,
                    editRequired: false,
                    readonly: true,
                    ngShow: "allow_callbacks && allow_callbacks !== 'false'",
                    column: 2,
                    awPopOver: "callback_help",
                    awPopOverWatch: "callback_help",
                    dataPlacement: 'right',
                    dataTitle: 'Provisioning Callback URL',
                    dataContainer: "body"
                },
                host_config_key: {
                    label: 'Host Config Key',
                    type: 'text',
                    ngShow: "allow_callbacks  && allow_callbacks !== 'false'",
                    ngChange: "configKeyChange()",
                    genMD5: true,
                    column: 2,
                    awPopOver: "callback_help",
                    awPopOverWatch: "callback_help",
                    dataPlacement: 'right',
                    dataTitle: "Host Config Key",
                    dataContainer: "body"
                },
                survey: {
                    type: 'custom',
                    column: 2,
                    ngHide: "job_type.value === 'scan'" ,
                    control: '<button type="button" class="btn btn-sm Form-surveyButton" id="job_templates_create_survey_btn" ng-show="!survey_exists" ng-click="addSurvey()">ADD SURVEY</button>'+
                            '<button type="button" class="btn btn-sm Form-surveyButton" id="job_templates_edit_survey_btn" ng-show="survey_exists" ng-click="editSurvey()">EDIT SURVEY</button>'
                }
            },

            buttons: { //for now always generates <button> tags
                save: {
                    ngClick: 'formSave()',    //$scope.function to call on click, optional
                    ngDisabled: "job_templates_form.$invalid || can_edit!==true"//true          //Disable when $pristine or $invalid, optional and when can_edit = false, for permission reasons
                },
                cancel: {
                    ngClick: 'formCancel()'
                }
            },

            related: {
                "completed_jobs": {
                    include: "CompletedJobsList"
                },
                permissions: {
                    basePath: 'job_templates/:id/access_list/',
                    type: 'collection',
                    title: 'Permissions',
                    iterator: 'permission',
                    index: false,
                    open: false,
                    searchType: 'select',
                    actions: {
                        add: {
                            ngClick: "addPermission",
                            label: 'Add',
                            awToolTip: 'Add a permission',
                            actionClass: 'btn List-buttonSubmit',
                            buttonContent: '&#43; ADD'
                        }
                    },

                    fields: {
                        username: {
                            key: true,
                            label: 'User',
                            linkBase: 'users',
                            class: 'col-lg-3 col-md-3 col-sm-3 col-xs-4'
                        },
                        role: {
                            label: 'Role',
                            type: 'role',
                            noSort: true,
                            class: 'col-lg-9 col-md-9 col-sm-9 col-xs-8'
                        }
                    }
                },
                "notifications": {
                    include: "NotificationsList"
                }
            },

            relatedSets: function(urls) {
                return {
                    completed_jobs: {
                        iterator: 'completed_job',
                        url: urls.jobs + '?or__status=successful&or__status=failed&or__status=error&or__status=canceled'
                    },
                    permissions: {
                        iterator: 'permission',
                        url: urls.access_list
                    },
                    notifications: {
                        iterator: 'notification',
                        url: '/api/v1/notifiers/'
                    }
                };
            }
        })

        .factory('JobTemplateForm', ['JobTemplateFormObject', 'NotificationsList', 'CompletedJobsList',
        function(JobTemplateFormObject, NotificationsList, CompletedJobsList) {
            return function() {
                var itm;

                for (itm in JobTemplateFormObject.related) {
                    if (JobTemplateFormObject.related[itm].include === "NotificationsList") {
                        JobTemplateFormObject.related[itm] = NotificationsList;
                        JobTemplateFormObject.related[itm].generateList = true;   // tell form generator to call list generator and inject a list
                    }
                    if (JobTemplateFormObject.related[itm].include === "CompletedJobsList") {
                        JobTemplateFormObject.related[itm] = CompletedJobsList;
                        JobTemplateFormObject.related[itm].generateList = true;
                    }
                }

                return JobTemplateFormObject;
            };
        }]);
