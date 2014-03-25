/*********************************************
 *  Copyright (c) 2014 AnsibleWorks, Inc.
 *
 *  Schedules Helper
 *
 *  Display the scheduler widget in a dialog
 *
 */

'use strict';

angular.module('SchedulesHelper', ['Utilities', 'SchedulesHelper'])
  
    .factory('ShowSchedulerModal', ['Wait', function(Wait) {
        return function(params) {
            // Set modal dimensions based on viewport width
            
            var ww, wh, x, y, maxrows, scope = params.scope;

            ww = $(document).width();
            wh = $('body').height();
            if (ww > 1199) {
                // desktop
                x = 675;
                y = (675 > wh) ? wh - 20 : 675;
                maxrows = 20;
            } else if (ww <= 1199 && ww >= 768) {
                x = 550;
                y = (675 > wh) ? wh - 15 : 675;
                maxrows = 15;
            } else {
                x = (ww - 20);
                y = (675 > wh) ? wh : 675;
                maxrows = 10;
            }

            // Create the modal
            $('#scheduler-modal-dialog').dialog({
                buttons: {
                    'Cancel': function() {
                        $(this).dialog('close');
                    },
                    'Save': function () {
                        setTimeout(function(){
                            scope.$apply(function(){
                                scope.saveSchedule();
                            });
                        });
                    }
                },
                modal: true,
                width: x,
                height: y,
                autoOpen: false,
                create: function () {
                    $('.ui-dialog[aria-describedby="scheduler-modal-dialog"]').find('.ui-dialog-titlebar button').empty().attr({'class': 'close'}).text('x');
                    $('.ui-dialog[aria-describedby="scheduler-modal-dialog"]').find('.ui-dialog-buttonset button').each(function () {
                        var c, h, i, l;
                        l = $(this).text();
                        if (l === 'Cancel') {
                            h = "fa-times";
                            c = "btn btn-default";
                            i = "schedule-close-button";
                            $(this).attr({
                                'class': c,
                                'id': i
                            }).html("<i class=\"fa " + h + "\"></i> Cancel");
                        } else if (l === 'Save') {
                            h = "fa-check";
                            c = "btn btn-primary";
                            i = "schedule-save-button";
                            $(this).attr({
                                'class': c,
                                'id': i
                            }).html("<i class=\"fa " + h + "\"></i> Save");
                        }
                    });
                    $('#scheduler-tabs a:first').tab('show');
                },
                resizeStop: function () {
                    // for some reason, after resizing dialog the form and fields (the content) doesn't expand to 100%
                    var dialog = $('.ui-dialog[aria-describedby="status-modal-dialog"]'),
                    content = dialog.find('#scheduler-modal-dialog');
                    content.width(dialog.width() - 28);
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
                    $('#scheduler-modal-dialog').dialog('destroy');
                    $('#scheduler-modal-dialog #form-container').empty();
                },
                open: function () {
                    Wait('stop');
                    $('#schedulerName').focus();
                    $('#rrule_nlp_description').dblclick(function() {
                        setTimeout(function() { scope.$apply(function() { scope.showRRule = (scope.showRRule) ? false : true; }); }, 100);
                    });
                }
            });
        };
    }])

    .factory('EditSchedule', ['SchedulerInit', 'ShowSchedulerModal', 'Wait', 'Rest',
    function(SchedulerInit, ShowSchedulerModal, Wait, Rest) {
        return function(params) {
            var scope = params.scope,
                schedule = params.schedule,
                url = params.url,
                scheduler;

            Wait('start');
            $('#form-container').empty();
            scheduler = SchedulerInit({ scope: scope, requireFutureStartTime: false });
            scheduler.inject('form-container', false);
            scheduler.injectDetail('occurrences', false);

            ShowSchedulerModal({ scope: scope });
            scope.showRRuleDetail = false;

            setTimeout(function(){
                $('#scheduler-modal-dialog').dialog('open');
                scope.$apply(function() {
                    scheduler.setRRule(schedule.rrule);
                    scheduler.setName(schedule.name);
                });
                $('#schedulerName').focus();
            }, 500);

            scope.saveSchedule = function() {
                var newSchedule;
                $('#scheduler-tabs a:first').tab('show');
                if (scheduler.isValid()) {
                    Wait('start');
                    newSchedule = scheduler.getValue();
                    schedule.name = newSchedule.name;
                    schedule.rrule = newSchedule.rrule;
                    Rest.setUrl(url);
                    Rest.post(schedule)
                        .success(function(){
                            Wait('stop');
                            $('#scheduler-modal-dialog').dialog('close');
                        })
                        .error(function(){
                            Wait('stop');
                            $('#scheduler-modal-dialog').dialog('close');
                        });
                }
            };

            $('#scheduler-tabs li a').on('shown.bs.tab', function(e) {
                if ($(e.target).text() === 'Details') {
                    if (!scheduler.isValid()) {
                        $('#scheduler-tabs a:first').tab('show');
                    }
                }
            });
        };
    }])

    .factory('AddSchedule', ['SchedulerInit', 'ShowSchedulerModal', 'Wait', 'Rest',
    function(SchedulerInit, ShowSchedulerModal, Wait, Rest) {
        return function(params) {
            var scope = params.scope,
                url = params.url,
                schedule = params.schedule,
                scheduler;

            Wait('start');
            $('#form-container').empty();
            scheduler = SchedulerInit({ scope: scope, requireFutureStartTime: false });
            scheduler.inject('form-container', false);
            scheduler.injectDetail('occurrences', false);
            scheduler.clear();
            ShowSchedulerModal({ scope: scope });
            scope.showRRuleDetail = false;

            setTimeout(function(){
                $('#scheduler-modal-dialog').dialog('open');
            }, 300);

            scope.saveSchedule = function() {
                var newSchedule;
                $('#scheduler-tabs a:first').tab('show');
                if (scheduler.isValid()) {
                    Wait('start');
                    newSchedule = scheduler.getValue();
                    schedule.name = newSchedule.name;
                    schedule.rrule = newSchedule.rrule;
                    Rest.setUrl(url);
                    Rest.post(schedule)
                        .success(function(){
                            Wait('stop');
                            $('#scheduler-modal-dialog').dialog('close');
                        })
                        .error(function(){
                            Wait('stop');
                            $('#scheduler-modal-dialog').dialog('close');
                        });
                }
            };

            $('#scheduler-tabs li a').on('shown.bs.tab', function(e) {
                if ($(e.target).text() === 'Details') {
                    if (!scheduler.isValid()) {
                        $('#scheduler-tabs a:first').tab('show');
                    }
                }
            });
        };
    }])

    /**
     * Flip a schedule's enable flag
     *
     * ToggleSchedule({
     *     scope:       scope,
     *     id:          schedule.id to update
     *     callback:    scope.$emit label to call when update completes
     * });
     *
     */
    .factory('ToggleSchedule', ['Wait', 'GetBasePath', 'ProcessErrors', 'Rest', function(Wait, GetBasePath, ProcessErrors, Rest) {
        return function(params) {
            var scope = params.scope,
                id = params.id,
                callback = params.callback,
                url = GetBasePath('schedules') + id +'/';
            
            // Perform the update
            if (scope.removeScheduleFound) {
                scope.removeScheduleFound();
            }
            scope.removeScheduleFound = scope.$on('removeScheduleFound', function(e, data) {
                data.enabled = (data.enabled) ? false : true;
                Rest.put(data)
                    .success( function() {
                        if (callback) {
                            scope.$emit(callback, id);
                        }
                    })
                    .error( function() {
                        ProcessErrors(scope, data, status, null, { hdr: 'Error!',
                            msg: 'Failed to update schedule ' + id + ' PUT returned: ' + status });
                    });
            });

            // Get the existing record
            Rest.setUrl(url);
            Rest.get()
                .success(function(){
                    
            })
            .error(function(data,status){
                ProcessErrors(scope, data, status, null, { hdr: 'Error!',
                    msg: 'Failed to retrieve schedule ' + id + ' GET returned: ' + status });
            });
        };
    }]);















