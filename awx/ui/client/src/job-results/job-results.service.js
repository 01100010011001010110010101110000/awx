/*************************************************
* Copyright (c) 2016 Ansible, Inc.
*
* All Rights Reserved
*************************************************/


export default ['$q', 'Prompt', '$filter', 'Wait', 'Rest', '$state', 'ProcessErrors', 'InitiatePlaybookRun', 'GetBasePath', 'Alert',
function ($q, Prompt, $filter, Wait, Rest, $state, ProcessErrors, InitiatePlaybookRun, GetBasePath, Alert) {
    var val = {
        // the playbook_on_stats event returns the count data in a weird format.
        // format to what we need!
        getCountsFromStatsEvent: function(event_data) {
            var hosts = {},
                hostsArr;

            // iterate over the event_data and populate an object with hosts
            // and their status data
            Object.keys(event_data).forEach(key => {
                // failed passes boolean not integer
                if (key === "changed" ||
                    key === "dark" ||
                    key === "failures" ||
                    key === "ok" ||
                    key === "skipped") {
                    // array of hosts from each type ("changed", "dark", etc.)
                    hostsArr = Object.keys(event_data[key]);
                    hostsArr.forEach(host => {
                        if (!hosts[host]) {
                            // host has not been added to hosts object
                            // add now
                            hosts[host] = {};
                        }

                        if (!hosts[host][key]) {
                            // host doesn't have key
                            hosts[host][key] = 0;
                        }
                        hosts[host][key] += event_data[key][host];
                    });
                }
            });

            // use the hosts data populate above to get the count
            var count = {
                ok : _.filter(hosts, function(o){
                    return !o.failures && !o.changed && o.ok > 0;
                }),
                skipped : _.filter(hosts, function(o){
                    return o.skipped > 0;
                }),
                unreachable : _.filter(hosts, function(o){
                    return o.dark > 0;
                }),
                failures : _.filter(hosts, function(o){
                    return o.failures > 0;
                }),
                changed : _.filter(hosts, function(o){
                    return o.changed > 0;
                })
            };

            // turn the count into an actual count, rather than a list of host
            // names
            Object.keys(count).forEach(key => {
                count[key] = count[key].length;
            });

            return count;
        },
        // rest call to grab previously complete job_events
        getEvents: function(url) {
            var val = $q.defer();

            Rest.setUrl(url);
            Rest.get()
                .success(function(data) {
                    val.resolve({results: data.results,
                        next: data.next});
                })
                .error(function(obj, status) {
                    ProcessErrors(null, obj, status, null, {
                        hdr: 'Error!',
                        msg: `Could not get job events.
                            Returned status: ${status}`
                    });
                    val.reject(obj);
                });

            return val.promise;
        },
        deleteJob: function(job) {
            Prompt({
                hdr: 'Delete Job',
                body: `<div class='Prompt-bodyQuery'>
                        Are you sure you want to delete the job below?
                    </div>
                    <div class='Prompt-bodyTarget'>
                        #${job.id} ${$filter('sanitize')(job.name)}
                    </div>`,
                action: function() {
                    Wait('start');
                    Rest.setUrl(job.url);
                    Rest.destroy()
                        .success(function() {
                            Wait('stop');
                            $('#prompt-modal').modal('hide');
                            $state.go('jobs');
                        })
                        .error(function(obj, status) {
                            Wait('stop');
                            $('#prompt-modal').modal('hide');
                            ProcessErrors(null, obj, status, null, {
                                hdr: 'Error!',
                                msg: `Could not delete job.
                                    Returned status: ${status}`
                            });
                        });
                },
                actionText: 'DELETE'
            });
        },
        cancelJob: function(job) {
            var doCancel = function() {
                Rest.setUrl(job.url + 'cancel');
                Rest.post({})
                    .success(function() {
                        Wait('stop');
                        $('#prompt-modal').modal('hide');
                    })
                    .error(function(obj, status) {
                        Wait('stop');
                        $('#prompt-modal').modal('hide');
                        ProcessErrors(null, obj, status, null, {
                            hdr: 'Error!',
                            msg: `Could not cancel job.
                                Returned status: ${status}`
                        });
                    });
            };

            Prompt({
                hdr: 'Cancel Job',
                body: `<div class='Prompt-bodyQuery'>
                        Are you sure you want to cancel the job below?
                    </div>
                    <div class='Prompt-bodyTarget'>
                        #${job.id} ${$filter('sanitize')(job.name)}
                    </div>`,
                action: function() {
                    Wait('start');
                    Rest.setUrl(job.url + 'cancel');
                    Rest.get()
                        .success(function(data) {
                            if (data.can_cancel === true) {
                                doCancel();
                            } else {
                                $('#prompt-modal').modal('hide');
                                ProcessErrors(null, data, null, null, {
                                    hdr: 'Error!',
                                    msg: `Job has completed,
                                        unabled to be canceled.`
                                });
                            }
                        });
                },
                actionText: 'PROCEED'
            });
        },
        relaunchJob: function(scope) {
            InitiatePlaybookRun({ scope: scope, id: scope.job.id,
                relaunch: true });
        },
        getJobData: function(id){
            var val = $q.defer();

            Rest.setUrl(GetBasePath('jobs') + id );
            Rest.get()
                .then(function(data) {
                    val.resolve(data.data);
                }, function(data) {
                    val.reject(data);

                    if (data.status === 404) {
                        Alert('Job Not Found', 'Cannot find job.', 'alert-info');
                    } else if (data.status === 403) {
                        Alert('Insufficient Permissions', 'You do not have permission to view this job.', 'alert-info');
                    }

                    $state.go('jobs');
                });

            return val.promise;
        }
    };
    return val;
}];
