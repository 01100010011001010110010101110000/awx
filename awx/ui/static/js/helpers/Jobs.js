/*********************************************
 *  Copyright (c) 2014 AnsibleWorks, Inc.
 *
 *  JobsHelper
 *
 *  Routines shared by job related controllers
 *
 */

'use strict';

angular.module('JobsHelper', ['Utilities', 'RestServices', 'FormGenerator', 'JobSummaryDefinition', 'InventoryHelper', 'GeneratorHelpers',
    'JobSubmissionHelper', 'LogViewerHelper', 'SearchHelper', 'PaginationHelpers', 'ListGenerator'])

/**
 *  JobsControllerInit({ scope: $scope });
 *  
 *  Initialize calling scope with all the bits required to support a jobs list
 *
 */
.factory('JobsControllerInit', ['$location', 'Find', 'DeleteJob', 'RelaunchJob', 'LogViewer',
    function($location, Find, DeleteJob, RelaunchJob, LogViewer) {
        return function(params) {
            var scope = params.scope,
                parent_scope = params.parent_scope;
        
            scope.deleteJob = function(id) {
                DeleteJob({ scope: scope, id: id });
            };

            scope.relaunchJob = function(event, id) {
                var list, job, typeId;
                try {
                    $(event.target).tooltip('hide');
                }
                catch(e) {
                    //ignore
                }
                if (scope.completed_jobs) {
                    list = scope.completed_jobs;
                }
                else if (scope.running_jobs) {
                    list = scope.running_jobs;
                }
                else if (scope.queued_jobs) {
                    list = scope.queued_jobs;
                }
                job = Find({ list: list, key: 'id', val: id });
                if (job.type === 'inventory_update') {
                    typeId = job.inventory_source;
                }
                else if (job.type === 'project_update') {
                    typeId = job.project;
                }
                else if (job.type === 'job') {
                    typeId = job.id;
                }
                RelaunchJob({ scope: scope, id: typeId, type: job.type, name: job.name });
            };

            scope.refreshJobs = function() {
                parent_scope.refreshJobs();
            };

            scope.viewJobLog = function(id, url) {
                var list, job;
                if (url) {
                    $location.path(url);
                }
                else {
                    if (scope.completed_jobs) {
                        list = scope.completed_jobs;
                    }
                    else if (scope.running_jobs) {
                        list = scope.running_jobs;
                    }
                    else if (scope.queued_jobs) {
                        list = scope.queued_jobs;
                    }
                    job = Find({ list: list, key: 'id', val: id });
                    LogViewer({
                        scope: scope,
                        url: job.url,
                        status_icon: 'icon-job-' + job.status
                    });
                }
            };
        };
    }
])

.factory('RelaunchJob', ['RelaunchInventory', 'RelaunchPlaybook', 'RelaunchSCM',
    function(RelaunchInventory, RelaunchPlaybook, RelaunchSCM) {
        return function(params) {
            var scope = params.scope,
                id = params.id,
                type = params.type,
                name = params.name;
            if (type === 'inventory_update') {
                RelaunchInventory({ scope: scope, id: id});
            }
            else if (type === 'job') {
                RelaunchPlaybook({ scope: scope, id: id, name: name });
            }
            else if (type === 'project_update') {
                RelaunchSCM({ scope: scope, id: id });
            }
        };
    }
])

.factory('JobStatusToolTip', [
    function () {
        return function (status) {
            var toolTip;
            switch (status) {
            case 'successful':
            case 'success':
                toolTip = 'There were no failed tasks.';
                break;
            case 'failed':
                toolTip = 'Some tasks encountered errors.';
                break;
            case 'canceled':
                toolTip = 'Stopped by user request.';
                break;
            case 'new':
                toolTip = 'In queue, waiting on task manager.';
                break;
            case 'waiting':
                toolTip = 'SCM Update or Inventory Update is executing.';
                break;
            case 'pending':
                toolTip = 'Not in queue, waiting on task manager.';
                break;
            case 'running':
                toolTip = 'Playbook tasks executing.';
                break;
            }
            return toolTip;
        };
    }
])

.factory('ShowJobSummary', ['Rest', 'Wait', 'GetBasePath', 'FormatDate', 'ProcessErrors', 'GenerateForm', 'JobSummary',
    'WatchInventoryWindowResize',
    function (Rest, Wait, GetBasePath, FormatDate, ProcessErrors, GenerateForm, JobSummary, WatchInventoryWindowResize) {
        return function (params) {
            // Display status info in a modal dialog- called from inventory edit page

            var job_id = params.job_id,
                generator = GenerateForm,
                form = JobSummary,
                scope, ww, wh, x, y, maxrows, url, html;

            html = '<div id=\"status-modal-dialog\" title=\"Job ' + job_id + '\">' +
                '<div id=\"form-container\" style=\"width: 100%;\"></div></div>\n';

            $('#inventory-modal-container').empty().append(html);
            
            scope = generator.inject(form, { mode: 'edit', id: 'form-container', breadCrumbs: false, related: false });

            // Set modal dimensions based on viewport width
            ww = $(document).width();
            wh = $('body').height();
            if (ww > 1199) {
                // desktop
                x = 675;
                y = (750 > wh) ? wh - 20 : 750;
                maxrows = 20;
            } else if (ww <= 1199 && ww >= 768) {
                x = 550;
                y = (620 > wh) ? wh - 15 : 620;
                maxrows = 15;
            } else {
                x = (ww - 20);
                y = (500 > wh) ? wh : 500;
                maxrows = 10;
            }

            // Create the modal
            $('#status-modal-dialog').dialog({
                buttons: {
                    'OK': function () {
                        $(this).dialog('close');
                    }
                },
                modal: true,
                width: x,
                height: y,
                autoOpen: false,
                closeOnEscape: false,
                create: function () {
                    // fix the close button
                    $('.ui-dialog[aria-describedby="status-modal-dialog"]').find('.ui-dialog-titlebar button')
                        .empty().attr({
                            'class': 'close'
                        }).text('x');
                    // fix the OK button
                    $('.ui-dialog[aria-describedby="status-modal-dialog"]').find('.ui-dialog-buttonset button:first')
                        .attr({
                            'class': 'btn btn-primary'
                        });
                },
                resizeStop: function () {
                    // for some reason, after resizing dialog the form and fields (the content) doesn't expand to 100%
                    var dialog = $('.ui-dialog[aria-describedby="status-modal-dialog"]'),
                        titleHeight = dialog.find('.ui-dialog-titlebar').outerHeight(),
                        buttonHeight = dialog.find('.ui-dialog-buttonpane').outerHeight(),
                        content = dialog.find('#status-modal-dialog');
                    content.width(dialog.width() - 28);
                    content.css({ height: (dialog.height() - titleHeight - buttonHeight - 10) });
                },
                close: function () {
                    // Destroy on close
                    $('.tooltip').each(function () {
                        // Remove any lingering tooltip <div> elements
                        $(this).remove();
                    });
                    $('.popover').each(function () {
                        // remove lingering popover <div> elements
                        $(this).remove();
                    });
                    $('#status-modal-dialog').dialog('destroy');
                    $('#inventory-modal-container').empty();
                    WatchInventoryWindowResize();
                },
                open: function () {
                    Wait('stop');
                }
            });

            function calcRows(content) {
                var n = content.match(/\n/g),
                    rows = (n) ? n.length : 1;
                return (rows > maxrows) ? 20 : rows;
            }

            Wait('start');
            url = GetBasePath('jobs') + job_id + '/';
            Rest.setUrl(url);
            Rest.get()
                .success(function (data) {
                    var cDate;
                    scope.id = data.id;
                    scope.name = data.name;
                    scope.status = data.status;
                    scope.result_stdout = data.result_stdout;
                    scope.result_traceback = data.result_traceback;
                    scope.stdout_rows = calcRows(scope.result_stdout);
                    scope.traceback_rows = calcRows(scope.result_traceback);
                    cDate = new Date(data.created);
                    scope.created = FormatDate(cDate);
                    $('#status-modal-dialog').dialog('open');
                })
                .error(function (data, status) {
                    ProcessErrors(scope, data, status, null, { hdr: 'Error!',
                        msg: 'Attempt to load job failed. GET returned status: ' + status });
                });
        };

    }
])

/**
 * 
 *  Called from JobsList controller to load each section or list on the page
 *
 */
.factory('LoadJobsScope', ['SearchInit', 'PaginateInit', 'GenerateList', 'JobsControllerInit', 'Rest',
    function(SearchInit, PaginateInit, GenerateList, JobsControllerInit, Rest) {
    return function(params) {
        var parent_scope = params.parent_scope,
            scope = params.scope,
            list = params.list,
            id = params.id,
            url = params.url;

        GenerateList.inject(list, {
            mode: 'edit',
            id: id,
            breadCrumbs: false,
            scope: scope,
            searchSize: 'col-lg-4 col-md-6 col-sm-12 col-xs-12',
            showSearch: true
        });

        SearchInit({
            scope: scope,
            set: list.name,
            list: list,
            url: url
        });

        PaginateInit({
            scope: scope,
            list: list,
            url: url,
            pageSize: 5
        });

        scope.iterator = list.iterator;

        if (scope.removePostRefresh) {
            scope.removePostRefresh();
        }
        scope.$on('PostRefresh', function(){
            
            JobsControllerInit({ scope: scope, parent_scope: parent_scope });

            scope[list.name].forEach(function(item, item_idx) {
                var fld, field,
                    itm = scope[list.name][item_idx];

                // Set the item type label
                if (list.fields.type) {
                    parent_scope.type_choices.every(function(choice) {
                        if (choice.value === item.type) {
                            itm.type_label = choice.label;
                            return false;
                        }
                        return true;
                    });
                }
                // Set the job status label
                parent_scope.status_choices.every(function(status) {
                    if (status.value === item.status) {
                        itm.status_label = status.label;
                        return false;
                    }
                    return true;
                });
                //Set the name link
                if (item.type === "inventory_update") {
                    Rest.setUrl(item.related.inventory_source);
                    Rest.get()
                        .success(function(data) {
                            itm.nameHref = "/inventories/" + data.inventory;
                        });
                }
                else if (item.type === "project_update") {
                    itm.nameHref = "/projects/" + item.project;
                }
                else if (item.type === "job") {
                    itm.nameHref = "";
                }
                
                if (list.name === 'completed_jobs' || list.name === 'running_jobs') {
                    itm.status_tip = itm.status_label + '. Click for details.';
                }
                else if (list.name === 'queued_jobs') {
                    itm.status_tip = 'Pending';
                }

                // Copy summary_field values
                for (field in list.fields) {
                    fld = list.fields[field];
                    if (fld.sourceModel) {
                        if (itm.summary_fields[fld.sourceModel]) {
                            itm[field] = itm.summary_fields[fld.sourceModel][fld.sourceField];
                        }
                    }
                }
            });
            parent_scope.$emit('listLoaded');
        });
        scope.search(list.iterator);
    };
}])

.factory('DeleteJob', ['Find', 'GetBasePath', 'Rest', 'Wait', 'ProcessErrors', 'Prompt',
function(Find, GetBasePath, Rest, Wait, ProcessErrors, Prompt){
    return function(params) {
        
        var scope = params.scope,
            id = params.id,
            action, jobs, job, url, action_label, hdr;

        if (scope.completed_jobs) {
            jobs = scope.completed_jobs;
        }
        else if (scope.running_jobs) {
            jobs = scope.running_jobs;
        }
        else if (scope.queued_jobs) {
            jobs = scope.queued_jobs;
        }
        job = Find({list: jobs, key: 'id', val: id });

        if (job.status === 'pending' || job.status === 'running' || job.status === 'waiting') {
            url = job.related.cancel;
            action_label = 'cancel';
            hdr = 'Cancel Job';
        } else {
            url = job.url;
            action_label = 'delete';
            hdr = 'Delete Job';
        }

        action = function () {
            Wait('start');
            Rest.setUrl(url);
            if (action_label === 'cancel') {
                Rest.post()
                    .success(function () {
                        $('#prompt-modal').modal('hide');
                        scope.search(scope.iterator);
                    })
                    .error(function (data, status) {
                        $('#prompt-modal').modal('hide');
                        ProcessErrors(scope, data, status, null, { hdr: 'Error!', msg: 'Call to ' + url +
                            ' failed. POST returned status: ' + status });
                    });
            } else {
                Rest.destroy()
                    .success(function () {
                        $('#prompt-modal').modal('hide');
                        scope.search(scope.iterator);
                    })
                    .error(function (data, status) {
                        $('#prompt-modal').modal('hide');
                        ProcessErrors(scope, data, status, null, { hdr: 'Error!', msg: 'Call to ' + url +
                            ' failed. DELETE returned status: ' + status });
                    });
            }
        };

        Prompt({
            hdr: hdr,
            body: "<div class=\"alert alert-info\">Are you sure you want to " + action_label + " job " + id + " <em>" + job.name  + "</em>?</div>",
            action: action
        });

    };
}])

.factory('RelaunchInventory', ['Find', 'Wait', 'Rest', 'InventoryUpdate', 'ProcessErrors', 'GetBasePath',
function(Find, Wait, Rest, InventoryUpdate, ProcessErrors, GetBasePath) {
    return function(params) {
        var scope = params.scope,
            id = params.id,
            url = GetBasePath('inventory_sources') + id + '/';
        Wait('start');
        Rest.setUrl(url);
        Rest.get()
            .success(function (data) {
                InventoryUpdate({
                    scope: scope,
                    url: data.related.update,
                    group_name: data.summary_fields.group.name,
                    group_source: data.source,
                    tree_id: null,
                    group_id: data.group
                });
            })
            .error(function (data, status) {
                ProcessErrors(scope, data, status, null, { hdr: 'Error!', msg: 'Failed to retrieve inventory source: ' +
                    url + ' GET returned: ' + status });
            });
    };
}])

.factory('RelaunchPlaybook', ['PlaybookRun', function(PlaybookRun) {
    return function(params) {
        var scope = params.scope,
            id = params.id;
        PlaybookRun({ scope: scope, id: id });
    };
}])

.factory('RelaunchSCM', ['ProjectUpdate', function(ProjectUpdate) {
    return function(params) {
        var scope = params.scope,
            id = params.id;
        ProjectUpdate({ scope: scope, project_id: id });
    };
}]);
