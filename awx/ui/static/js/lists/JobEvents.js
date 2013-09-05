/*********************************************
 *  Copyright (c) 2013 AnsibleWorks, Inc.
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
        
        fields: {
            created: {
                label: 'Date',
                key: true,
                nosort: true,
                searchable: false,
                link: false
                },
            status: {
                label: 'Status',
                icon: 'icon-circle',
                showValue: true,
                "class": 'job-\{\{ jobevent.status \}\}',
                searchField: 'failed',
                searchType: 'boolean',
                searchOptions: [{ name: "success", value: 0 }, { name: "error", value: 1 }],
                nosort: true,
                searchable: false
                },
            event_display: {
                label: 'Event',
                hasChildren: true,
                ngClick: "toggleChildren(\{\{ jobevent.id \}\}, '\{\{ jobevent.related.children \}\}')",
                nosort: true,
                searchable: false,
                ngClass: '\{\{ jobevent.class \}\}',
                appendHTML: 'jobevent.event_detail'
                },
            host: {
                label: 'Host',
                ngBind: 'jobevent.summary_fields.host.name',
                searchField: 'hosts__name',
                nosort: true,
                searchOnly: false,
                id: 'job-event-host-header',
                columnClass: 'hidden-sm'
                }
            },
        
        actions: {
            refresh: {
                ngClick: "refresh()",
                icon: 'icon-refresh',
                label: 'Refresh',
                awToolTip: 'Refresh the page',
                "class": 'btn-sm btn-primary',
                mode: 'all'
                },
            edit: {
                label: 'Details',
                ngClick: "jobDetails()",
                icon: 'icon-zoom-in',
                "class": 'btn btn-default btn-sm',
                awToolTip: 'Edit job details',
                mode: 'all'
                },
            summary: {
                label: 'Hosts',
                icon: 'icon-laptop',
                ngClick: "jobSummary()",
                "class": 'btn btn-default btn-sm',
                awToolTip: 'View host summary',
                mode: 'all'
                }
            },

        fieldActions: {
            edit: {
                label: 'View',
                ngClick: "viewJobEvent(\{\{ jobevent.id \}\})",
                icon: 'icon-zoom-in',
                "class": 'btn-default btn-xs',
                awToolTip: 'View event details'
                }
            }
        });
