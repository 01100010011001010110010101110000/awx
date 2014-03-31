/*********************************************
 *  Copyright (c) 2014 AnsibleWorks, Inc.
 *
 *  Schedules.js
 *  List object for Schedule data model.
 *
 */

'use strict';

angular.module('SchedulesListDefinition', [])
    .value('SchedulesList', {

        name: 'schedules',
        iterator: 'schedule',
        selectTitle: '',
        editTitle: 'Schedules',
        well: true,
        index: true,
        hover: true,

        fields: {
            name: {
                key: true,
                label: 'Name',
                ngClick: "editSchedule(schedule.id)",
                columnClass: "col-md-3 col-sm-3 col-xs-3"
            },
            next_run: {
                label: 'Next Run',
                filter: "date:'MM/dd/yy HH:mm:ss'",
                searchable: false,
                columnClass: "col-md-2 col-sm-3 col-xs-3"
            },
            dtstart: {
                label: 'Start',
                filter: "date:'MM/dd/yy HH:mm:ss'",
                searchable: false,
                columnClass: "col-md-2 col-sm-3 hidden-xs"
            },
            dtend: {
                label: 'End',
                filter: "date:'MM/dd/yy HH:mm:ss'",
                searchable: false,
                columnClass: "col-md-2 col-sm-3 hidden-xs"
            }
        },

        actions: {
            add: {
                mode: 'all',
                ngClick: 'addSchedule()',
                awToolTip: 'Add a new schedule'
            },
            stream: {
                ngClick: "showActivity()",
                awToolTip: "View Activity Stream",
                mode: 'edit'
            }
        },

        fieldActions: {
            "play": {
                mode: "all",
                ngClick: "toggleSchedule($event, schedule.id)",
                awToolTip: "{{ schedule.play_tip }}",
                dataTipWatch: "schedule.play_tip",
                iconClass: "{{ 'fa icon-schedule-enabled-' + schedule.enabled }}",
                dataPlacement: "top"
            },
            edit: {
                label: 'Edit',
                ngClick: "editSchedule(schedule.id)",
                icon: 'icon-edit',
                awToolTip: 'Edit schedule',
                dataPlacement: 'top'
            },
            "delete": {
                label: 'Delete',
                ngClick: "deleteSchedule(schedule.id)",
                icon: 'icon-trash',
                awToolTip: 'Delete schedule',
                dataPlacement: 'top'
            }
        }
    });