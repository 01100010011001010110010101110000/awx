/*************************************************
 * Copyright (c) 2015 Ansible, Inc.
 *
 * All Rights Reserved
 *************************************************/


export default
    angular.module('JobHostDefinition', [])
    .value('JobHostList', {

        name: 'jobhosts',
        iterator: 'jobhost',
        editTitle: 'All summaries',
        "class": "table-condensed",
        index: false,
        hover: true,

        navigationLinks: {
            ngHide: 'host_id !== null',
            //details: {
            //    href: "/#/jobs/{{ job_id }}",
            //    label: 'Status',
            //    icon: 'icon-zoom-in',
            //    ngShow: "job_id !== null"
            //},
            events: {
                href: "/#/job_events/{{ job_id }}",
                label: 'Events',
                icon: 'icon-list-ul'
            },
            hosts: {
                href: "/#/job_host_summariess/{{ job_id }}",
                label: 'Host Summary',
                active: true,
                icon: 'icon-laptop'
            }
        },

        fields: {
            host: {
                label: 'Host',
                key: true,
                sourceModel: 'host',
                sourceField: 'name',
                ngBind: 'jobhost.host_name',
                ngHref: "{{ jobhost.hostLinkTo }}"
            },
            status: {
                label: 'Status',
                badgeNgHref: "{{ jobhost.statusLinkTo }}",
                badgeIcon: 'fa icon-job-{{ jobhost.status }}',
                badgePlacement: 'left',
                badgeToolTip: "{{ jobhost.statusBadgeToolTip }}",
                badgeTipPlacement: 'top',
                ngHref: "{{ jobhost.statusLinkTo }}",
                awToolTip: "{{ jobhost.statusBadgeToolTip }}",
                dataPlacement: 'top',
                searchField: 'failed',
                searchType: 'boolean',
                showValue: false,
                searchOptions: [{
                    name: "success",
                    value: 0
                }, {
                    name: "error",
                    value: 1
                }]
            },
            failed: {
                label: 'Job failed?',
                searchSingleValue: true,
                searchType: 'boolean',
                searchValue: 'true',
                searchOnly: true,
                nosort: true
            },
            ok: {
                label: 'Success',
                searchable: false
            },
            changed: {
                label: 'Changed',
                searchable: false
            },
            failures: {
                label: 'Failure',
                searchable: true,
                searchLabel: 'Contains failed events?',
                searchType: 'gtzero'
            },
            dark: {
                label: 'Unreachable',
                searchable: true,
                searchType: 'gtzero',
                searchLabel: 'Contains unreachable hosts?'
            },
            skipped: {
                label: 'Skipped',
                searchable: false
            }
        },

        actions: {
            help: {
                awPopOver: "<dl>\n<dt>Success</dt><dd>Tasks successfully executed on the host.</dd>\n" +
                    "<dt>Changed</dt><dd>Actions taken on the host.</dd>\n" +
                    "<dt>Failure</dt><dd>Tasks that failed on the host.</dd>\n" +
                    "<dt>Unreachable</dt><dd>Times the ansible server could not reach the host.</dd>\n" +
                    "<dt>Skipped</dt><dd>Tasks bypassed and not performed on the host due to prior task failure or the host being unreachable.</dd>\n" +
                    "</dl>\n",
                dataPlacement: 'left',
                dataContainer: "body",
                mode: 'all',
                actionClass: 'btn-xs btn-help',
                awToolTip: 'Click for help',
                dataTitle: 'Job Host Summary',
                id: 'jobhost-help-button'
            },
            refresh: {
                mode: 'all',
                awToolTip: "Refresh the page",
                ngClick: "refresh()",
                ngShow: "host_id == null", //don't show when viewing from inventory->hosts
                actionClass: 'btn List-buttonDefault',
                buttonContent: 'REFRESH'
            }
        }

        //fieldActions: {}

    });
