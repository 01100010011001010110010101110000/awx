/*************************************************
 * Copyright (c) 2015 Ansible, Inc.
 *
 * All Rights Reserved
 *************************************************/

/**
 * @ngdoc function
 * @name controllers.function:JobStdout
 * @description This controller's for the standard out page that can be displayed when a job runs
*/


export function JobStdoutController ($location, $log, $rootScope, $scope, $compile, $state, $stateParams, ClearScope, GetBasePath, Wait, Rest, ProcessErrors, ModelToBasePathKey, Empty, GetChoices, LookUpName) {

    ClearScope();

    var job_id = $stateParams.id,
        jobType = $state.current.data.jobType,
        api_complete = false,
        stdout_url,
        current_range,
        loaded_sections = [],
        event_queue = 0,
        auto_scroll_down=true,  // programmatic scroll to bottom
        live_event_processing = true,
        should_apply_live_events = true,
        page_size = 500,
        lastScrollTop = 0,
        st,
        direction;

    $scope.isClosed = true;


    // function openSockets() {
    //     if (/\/jobs\/(\d)+\/stdout/.test($location.$$url)) {
    //         $log.debug("socket watching on job_events-" + job_id);
    //         $rootScope.event_socket.on("job_events-" + job_id, function() {
    //             $log.debug("socket fired on job_events-" + job_id);
    //             if (api_complete) {
    //                 event_queue++;
    //             }
    //         });
    //     } else if (/\/ad_hoc_commands\/(\d)+/.test($location.$$url)) {
    //         $log.debug("socket watching on ad_hoc_command_events-" + job_id);
    //         $rootScope.adhoc_event_socket.on("ad_hoc_command_events-" + job_id, function() {
    //             $log.debug("socket fired on ad_hoc_command_events-" + job_id);
    //             if (api_complete) {
    //                 event_queue++;
    //             }
    //         });
    //     }
    // }
    //
    // openSockets();

    if ($rootScope.removeJobStatusChange) {
        $rootScope.removeJobStatusChange();
    }
    $rootScope.removeJobStatusChange = $rootScope.$on('JobStatusChange-jobStdout', function(e, data) {
        if (parseInt(data.unified_job_id, 10) === parseInt(job_id,10) && $scope.job) {
            $scope.job.status = data.status;
            if (data.status === 'failed' || data.status === 'canceled' ||
                    data.status === 'error' || data.status === 'successful') {
                if ($rootScope.jobStdOutInterval) {
                    window.clearInterval($rootScope.jobStdOutInterval);
                }
                if (live_event_processing) {
                    if (loaded_sections.length === 0) {
                        $scope.$emit('LoadStdout');
                    }
                    else {
                        getNextSection();
                    }
                }
                live_event_processing = false;
            }
        }
    });

    $rootScope.jobStdOutInterval = setInterval( function() {
        if (event_queue > 0) {
            // events happened since the last check
            $log.debug('checking for stdout...');
            if (loaded_sections.length === 0) { ////this if statement for refresh
                $log.debug('calling LoadStdout');
                $scope.$emit('LoadStdout');
            }
            else if (live_event_processing) {
                $log.debug('calling getNextSection');
                getNextSection();
            }
            event_queue = 0;
        }
    }, 2000);

    if ($scope.removeLoadStdout) {
        $scope.removeLoadStdout();
    }
    $scope.removeLoadStdout = $scope.$on('LoadStdout', function() {
        Rest.setUrl(stdout_url + '?format=json&start_line=-' + page_size);
        Rest.get()
            .success(function(data) {
                Wait('stop');
                if (data.content) {
                    api_complete = true;
                    $('#pre-container-content').html(data.content);
                    current_range = data.range;
                    if (data.content !== "Waiting for results...") {
                        loaded_sections.push({
                            start: (data.range.start < 0) ? 0 : data.range.start,
                            end: data.range.end
                        });
                    }

                    $('#pre-container').scrollTop($('#pre-container').prop("scrollHeight"));
                }
                else {
                    api_complete = true;
                }
            })
            .error(function(data, status) {
                ProcessErrors($scope, data, status, null, { hdr: 'Error!',
                    msg: 'Failed to retrieve stdout for job: ' + job_id + '. GET returned: ' + status });
            });
    });

    function detectDirection() {
        st = $('#pre-container').scrollTop();
        if (st > lastScrollTop) {
            direction = "down";
        } else {
            direction = "up";
        }
        lastScrollTop = st;
        return  direction;
    }

    $('#pre-container').bind('scroll', function() {
        if (detectDirection() === "up") {
            should_apply_live_events = false;
        }

        if ($(this).scrollTop() + $(this).height() === $(this).prop("scrollHeight")) {
            should_apply_live_events = true;
        }
    });

    $scope.toggleClosedStatus = function() {
        if (!$scope.isClosed) {
            $('.StandardOutDetails-detailRow--closable').slideUp(200);
            $scope.isClosed = true;
        }
        else {
            $('.StandardOutDetails-detailRow--closable').slideDown(200);
            $scope.isClosed = false;
        }
    };

    Rest.setUrl(GetBasePath('base') + jobType + '/' + job_id + '/');
    Rest.get()
        .success(function(data) {
            $scope.job = data;
            $scope.job_template_name = data.name;
            $scope.created_by = data.summary_fields.created_by;
            $scope.project_name = (data.summary_fields.project) ? data.summary_fields.project.name : '';
            $scope.inventory_name = (data.summary_fields.inventory) ? data.summary_fields.inventory.name : '';
            $scope.job_template_url = '/#/job_templates/' + data.unified_job_template;
            $scope.inventory_url = ($scope.inventory_name && data.inventory) ? '/#/inventories/' + data.inventory : '';
            $scope.project_url = ($scope.project_name && data.project) ? '/#/projects/' + data.project : '';
            $scope.credential_name = (data.summary_fields.credential) ? data.summary_fields.credential.name : '';
            $scope.credential_url = (data.credential) ? '/#/credentials/' + data.credential : '';
            $scope.cloud_credential_url = (data.cloud_credential) ? '/#/credentials/' + data.cloud_credential : '';
            $scope.playbook = data.playbook;
            $scope.credential = data.credential;
            $scope.cloud_credential = data.cloud_credential;
            $scope.forks = data.forks;
            $scope.limit = data.limit;
            $scope.verbosity = data.verbosity;
            $scope.job_tags = data.job_tags;
            stdout_url = data.related.stdout;

            // If we have a source then we have to go get the source choices from the server
            if (!Empty(data.source)) {
                if ($scope.removeChoicesReady) {
                    $scope.removeChoicesReady();
                }
                $scope.removeChoicesReady = $scope.$on('ChoicesReady', function() {
                    $scope.source_choices.every(function(e) {
                        if (e.value === data.source) {
                            $scope.source = e.label;
                            return false;
                        }
                        return true;
                    });
                });
                // GetChoices can be found in the helper: LogViewer.js
                // It attaches the source choices to $scope.source_choices.
                // Then, when the callback is fired, $scope.source is bound
                // to the corresponding label.
                GetChoices({
                    scope: $scope,
                    url: GetBasePath('inventory_sources'),
                    field: 'source',
                    variable: 'source_choices',
                    choice_name: 'choices',
                    callback: 'ChoicesReady'
                });
            }

            // LookUpName can be found in the helper: LogViewer.js
            // It attaches the name that it gets (based on the url)
            // to the $scope variable defined by the attribute scope_var.
            if (!Empty(data.credential)) {
                LookUpName({
                    scope: $scope,
                    scope_var: 'credential',
                    url: GetBasePath('credentials') + data.credential + '/'
                });
            }

            if (!Empty(data.inventory)) {
                LookUpName({
                    scope: $scope,
                    scope_var: 'inventory',
                    url: GetBasePath('inventory') + data.inventory + '/'
                });
            }

            if (!Empty(data.project)) {
                LookUpName({
                    scope: $scope,
                    scope_var: 'project',
                    url: GetBasePath('projects') + data.project + '/'
                });
            }

            if (!Empty(data.cloud_credential)) {
                LookUpName({
                    scope: $scope,
                    scope_var: 'cloud_credential',
                    url: GetBasePath('credentials') + data.cloud_credential + '/'
                });
            }

            if (!Empty(data.inventory_source)) {
                LookUpName({
                    scope: $scope,
                    scope_var: 'inventory_source',
                    url: GetBasePath('inventory_sources') + data.inventory_source + '/'
                });
            }

            // if (data.status === 'successful' || data.status === 'failed' || data.status === 'error' || data.status === 'canceled') {
            //     live_event_processing = false;
            //     if ($rootScope.jobStdOutInterval) {
            //         window.clearInterval($rootScope.jobStdOutInterval);
            //     }
            // }
            if(stdout_url) {
                $scope.$emit('LoadStdout');
            }
        })
        .error(function(data, status) {
            ProcessErrors($scope, data, status, null, { hdr: 'Error!',
                msg: 'Failed to retrieve job: ' + job_id + '. GET returned: ' + status });
        });

    $scope.refresh = function(){
        if (loaded_sections.length === 0) { ////this if statement for refresh
            $scope.$emit('LoadStdout');
        }
        else if (live_event_processing) {
            getNextSection();
        }
    };

    $scope.stdOutScrollToTop = function() {
        // scroll up or back in time toward the beginning of the file
        var start, end, url;
        if (loaded_sections.length > 0 && loaded_sections[0].start > 0) {
            start = (loaded_sections[0].start - page_size > 0) ? loaded_sections[0].start - page_size : 0;
            end = loaded_sections[0].start - 1;
        }
        else if (loaded_sections.length === 0) {
            start = 0;
            end = page_size;
        }
        if (start !== undefined  && end !== undefined) {
            $('#stdoutMoreRowsTop').fadeIn();
            url = stdout_url + '?format=json&start_line=' + start + '&end_line=' + end;
            Rest.setUrl(url);
            Rest.get()
                .success( function(data) {
                    //var currentPos = $('#pre-container').scrollTop();
                    var newSH, oldSH = $('#pre-container').prop('scrollHeight'),
                        st = $('#pre-container').scrollTop();

                    $('#pre-container-content').prepend(data.content);

                    newSH = $('#pre-container').prop('scrollHeight');
                    $('#pre-container').scrollTop(newSH - oldSH + st);

                    loaded_sections.unshift({
                        start: (data.range.start < 0) ? 0 : data.range.start,
                        end: data.range.end
                    });
                    current_range = data.range;
                    $('#stdoutMoreRowsTop').fadeOut(400);
                })
                .error(function(data, status) {
                    ProcessErrors($scope, data, status, null, { hdr: 'Error!',
                        msg: 'Failed to retrieve stdout for job: ' + job_id + '. GET returned: ' + status });
                });
        }
    };

    function getNextSection() {
        // get the next range of data from the API
        var start = loaded_sections[loaded_sections.length - 1].end, url;
        url = stdout_url + '?format=json&start_line=' + start + '&end_line=' + (start + page_size);
        $('#stdoutMoreRowsBottom').fadeIn();
        Rest.setUrl(url);
        Rest.get()
            .success( function(data) {
                if ($('#pre-container-content').html() === "Waiting for results...") {
                    $('#pre-container-content').html(data.content);
                } else {
                    $('#pre-container-content').append(data.content);
                }
                loaded_sections.push({
                    start: (data.range.start < 0) ? 0 : data.range.start,
                    end: data.range.end
                });
                //console.log('loaded start: ' + data.range.start + ' end: ' + data.range.end);
                //console.log(data.content);
                if (should_apply_live_events) {
                    // if user has not disabled live event view by scrolling upward, then scroll down to the new content
                    current_range = data.range;
                    auto_scroll_down = true; // prevent auto load from happening
                    $('#pre-container').scrollTop($('#pre-container').prop("scrollHeight"));
                }
                $('#stdoutMoreRowsBottom').fadeOut(400);
            })
            .error(function(data, status) {
                ProcessErrors($scope, data, status, null, { hdr: 'Error!',
                    msg: 'Failed to retrieve stdout for job: ' + job_id + '. GET returned: ' + status });
            });
    }

}

JobStdoutController.$inject = [ '$location', '$log', '$rootScope', '$scope', '$compile', '$state', '$stateParams', 'ClearScope', 'GetBasePath', 'Wait', 'Rest', 'ProcessErrors', 'ModelToBasePathKey', 'Empty', 'GetChoices', 'LookUpName'];
