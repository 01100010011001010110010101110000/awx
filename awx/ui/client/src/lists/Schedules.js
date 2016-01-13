/*************************************************
 * Copyright (c) 2015 Ansible, Inc.
 *
 * All Rights Reserved
 *************************************************/


export default
    angular.module('SchedulesListDefinition', [])
    .value('SchedulesList', {

        name: 'schedules',
        iterator: 'schedule',
        selectTitle: '',
        editTitle: 'Schedules',
        well: false,
        index: false,
        hover: true,

        fields: {
            name: {
                key: true,
                label: 'Name',
                ngClick: "editSchedule(schedule.id)",
                columnClass: "col-md-3 col-sm-3 col-xs-3"
            },
            dtstart: {
                label: 'First Run',
                filter: "longDate",
                searchable: false,
                columnClass: "col-md-2 col-sm-3 hidden-xs"
            },
            next_run: {
                label: 'Next Run',
                filter: "longDate",
                searchable: false,
                columnClass: "col-md-2 col-sm-3 col-xs-3"
            },
            dtend: {
                label: 'Final Run',
                filter: "longDate",
                searchable: false,
                columnClass: "col-md-2 col-sm-3 hidden-xs"
            }
        },

        actions: {
            refresh: {
                mode: 'all',
                awToolTip: "Refresh the page",
                ngClick: "refreshSchedules()",
                actionClass: 'btn List-buttonDefault',
                buttonContent: 'REFRESH'
            },
            add: {
                mode: 'all',
                ngClick: 'addSchedule()',
                awToolTip: 'Add a new schedule',
                actionClass: 'btn List-buttonSubmit',
                buttonContent: '&#43; ADD'
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
