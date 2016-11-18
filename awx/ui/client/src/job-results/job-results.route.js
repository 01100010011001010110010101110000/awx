/*************************************************
 * Copyright (c) 2016 Ansible, Inc.
 *
 * All Rights Reserved
 *************************************************/

import {templateUrl} from '../shared/template-url/template-url.factory';

import jobResultsController from './job-results.controller';

export default {
    name: 'jobDetail',
    url: '/jobs/:id',
    ncyBreadcrumb: {
        parent: 'jobs',
        label: '{{ job.id }} - {{ job.name }}'
    },
    socket: {
        "groups":{
            "jobs": ["status_changed", "summary"],
            "job_events": []
        }
    },
    resolve: {
        // the GET for the particular job
        jobData: ['Rest', 'GetBasePath', '$stateParams', '$q', '$state', 'Alert', function(Rest, GetBasePath, $stateParams, $q, $state, Alert) {
            Rest.setUrl(GetBasePath('jobs') + $stateParams.id);
            var val = $q.defer();
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
        }],
        // after the GET for the job, this helps us keep the status bar from
        // flashing as rest data comes in.  If the job is finished and
        // there's a playbook_on_stats event, go ahead and resolve the count
        // so you don't get that flashing!
        count: ['jobData', 'jobResultsService', 'Rest', '$q', function(jobData, jobResultsService, Rest, $q) {
            var defer = $q.defer();
            if (jobData.finished) {
                // if the job is finished, grab the playbook_on_stats
                // role to get the final count
                Rest.setUrl(jobData.related.job_events);// +
                    // "?event=playbook_on_stats");
                Rest.get()
                    .success(function(data) {
                        defer.resolve({
                            val: jobResultsService
                                .getCountsFromStatsEvent(data
                                    .results[0].event_data),
                            countFinished: true});
                    })
                    .error(function() {
                        defer.resolve({val: {
                            ok: 0,
                            skipped: 0,
                            unreachable: 0,
                            failures: 0,
                            changed: 0
                        }, countFinished: false});
                    });
            } else {
                // job isn't finished so just send an empty count and read
                // from events
                defer.resolve({val: {
                    ok: 0,
                    skipped: 0,
                    unreachable: 0,
                    failures: 0,
                    changed: 0
                }, countFinished: false});
            }
            return defer.promise;
        }],
        // GET for the particular jobs labels to be displayed in the
        // left-hand pane
        jobLabels: ['Rest', 'GetBasePath', '$stateParams', '$q', function(Rest, GetBasePath, $stateParams, $q) {
            var getNext = function(data, arr, resolve) {
                Rest.setUrl(data.next);
                Rest.get()
                    .success(function (data) {
                        if (data.next) {
                            getNext(data, arr.concat(data.results), resolve);
                        } else {
                            resolve.resolve(arr.concat(data.results)
                                .map(val => val.name));
                        }
                    });
            };

            var seeMoreResolve = $q.defer();

            Rest.setUrl(GetBasePath('jobs') + $stateParams.id + '/labels/');
            Rest.get()
                .success(function(data) {
                    if (data.next) {
                        getNext(data, data.results, seeMoreResolve);
                    } else {
                        seeMoreResolve.resolve(data.results
                            .map(val => val.name));
                    }
                });

            return seeMoreResolve.promise;
        }],
        // OPTIONS request for the job.  Used to make things like the
        // verbosity data in the left-hand pane prettier than just an
        // integer
        jobDataOptions: ['Rest', 'GetBasePath', '$stateParams', '$q', function(Rest, GetBasePath, $stateParams, $q) {
            Rest.setUrl(GetBasePath('jobs') + $stateParams.id);
            var val = $q.defer();
            Rest.options()
                .then(function(data) {
                    val.resolve(data.data);
                }, function(data) {
                    val.reject(data);
                });
            return val.promise;
        }],
        // This clears out the event queue, otherwise it'd be full of events
        // for previous job results the user had navigated to
        eventQueueInit: ['eventQueue', function(eventQueue) {
            eventQueue.initialize();
        }]
    },
    templateUrl: templateUrl('job-results/job-results'),
    controller: jobResultsController
};
