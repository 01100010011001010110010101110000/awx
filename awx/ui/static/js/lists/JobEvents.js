/*********************************************
 *  Copyright (c) 2014 AnsibleWorks, Inc.
 *
 *  Jobs.js 
 *  List view object for Team data model.
 *
 *  
 */
angular.module('JobEventsListDefinition', [])
    .value(
    'JobEventList', {
        
        name: 'jobevents',
        iterator: 'jobevent',
        editTitle: 'Job Events',
        index: false,
        hover: true,
        hasChildren: true,
        filterBy: '\{ show: true \}',

        navigationLinks: {
            details: {
                href: "/#/jobs/{{ job_id }}",
                label: 'Status',
                icon: 'icon-zoom-in',
                ngShow: "job_id !== null"
                },
            events: {
                href: "/#/jobs/{{ job_id }}/job_events",
                label: 'Events',
                active: true,
                icon: 'icon-list-ul'
                },
            hosts: {
                href: "/#/jobs/{{ job_id }}/job_host_summaries",
                label: 'Host Summary',
                icon: 'icon-laptop'
                }
            },
        
        fields: {
            created: {
                label: 'Created On',
                key: true,
                nosort: true,
                searchable: false,
                link: false
                },
            status: {
                label: 'Status',
                showValue: true,
                searchField: 'failed',
                searchType: 'boolean',
                searchOptions: [{ name: "success", value: 0 }, { name: "error", value: 1 }],
                nosort: true,
                searchable: false,
                ngClick: "viewJobEvent(\{\{ jobevent.id \}\})",
                awToolTip: "\{\{ jobevent.statusBadgeToolTip \}\}",
                dataPlacement: 'top',
                badgeIcon: 'fa icon-job-\{\{ jobevent.status \}\}',
                badgePlacement: 'left',
                badgeToolTip: "\{\{ jobevent.statusBadgeToolTip \}\}",
                badgeTipPlacement: 'top',
                badgeNgClick: "viewJobEvent(\{\{ jobevent.id \}\})"
                },
            event_display: {
                label: 'Event',
                hasChildren: true,
                ngClick: "toggleChildren(\{\{ jobevent.id \}\}, '\{\{ jobevent.related.children \}\}')",
                nosort: true,
                searchable: false,
                ngClass: '\{\{ jobevent.class \}\}',
                appendHTML: 'jobevent.event_detail',
                'columnClass': 'col-lg-4'
                },
            host: {
                label: 'Host',
                ngBind: 'jobevent.summary_fields.host.name',
                ngHref: "\{\{ jobevent.hostLink \}\}",
                searchField: 'hosts__name',
                nosort: true,
                searchOnly: false,
                id: 'job-event-host-header',
                columnClass: 'col-lg-3 hidden-sm hidden-xs'
                }
            },
        
        actions: {
            refresh: {
                mode: 'all',
                awToolTip: "Refresh the page",
                ngClick: "refresh()"
                }
            },

        fieldActions: {
            view: {
                label: 'View',
                ngClick: "viewJobEvent(\{\{ jobevent.id \}\})",
                awToolTip: 'View event details',
                dataPlacement: 'top'
                }
            }
        });
