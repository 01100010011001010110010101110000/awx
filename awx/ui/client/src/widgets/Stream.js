/*************************************************
 * Copyright (c) 2015 Ansible, Inc.
 *
 * All Rights Reserved
 *************************************************/


    /**
 * @ngdoc function
 * @name widgets.function:Stream
 * @description
 *  Stream.js
 *
 *  Activity stream widget that can be called from anywhere
 *
 */

import listGenerator from '../shared/list-generator/main';


angular.module('StreamWidget', ['RestServices', 'Utilities', 'StreamListDefinition', listGenerator.name, 'StreamWidget',
])

.factory('BuildAnchor', [ '$log', '$filter',
    // Returns a full <a href=''>resource_name</a> HTML string if link can be derived from supplied context
    // returns name of resource if activity stream object doesn't contain enough data to build a UI url
    // arguments are: a summary_field object, a resource type, an activity stream object
    function ($log, $filter) {
        return function (obj, resource, activity) {
            var url = '/#/';
            // try/except pattern asserts that:
            // if we encounter a case where a UI url can't or shouldn't be generated, just supply the name of the resource
            try {
                // catch-all case to avoid generating urls if a resource has been deleted
                // if a resource still exists, it'll be serialized in the activity's summary_fields
                if (!activity.summary_fields[resource]){
                    throw {name : 'ResourceDeleted', message: 'The referenced resource no longer exists'};
                }
                switch (resource) {
                    case 'custom_inventory_script':
                        url += 'inventory_scripts/' + obj.id + '/';
                        break;
                    case 'group':
                        if (activity.operation === 'create' || activity.operation === 'delete'){
                            // the API formats the changes.inventory field as str 'myInventoryName-PrimaryKey'
                            var inventory_id = _.last(activity.changes.inventory.split('-'));
                            url += 'inventories/' + inventory_id + '/manage?group=' + activity.changes.id;
                        }
                        else {
                            url += 'inventories/' + activity.summary_fields.inventory[0].id + '/manage?group=' + (activity.changes.id || activity.changes.object1_pk);
                        }
                        break;
                    case 'host':
                        url += 'home/hosts/' + obj.id;
                        break;
                    case 'job':
                        url += 'jobs/' + obj.id;
                        break;
                    case 'inventory':
                        url += 'inventories/' + obj.id + '/';
                        break;
                    case 'schedule':
                        // schedule urls depend on the resource they're associated with
                        if (activity.summary_fields.job_template){
                            url += 'job_templates/' + activity.summary_fields.job_template.id + '/schedules/' + obj.id;
                        }
                        else if (activity.summary_fields.project){
                            url += 'projects/' + activity.summary_fields.project.id + '/schedules/' + obj.id;
                        }
                        else if (activity.summary_fields.system_job_template){
                            url += 'management_jobs/' + activity.summary_fields.system_job_template.id + '/schedules/edit/' + obj.id;
                        }
                        // urls for inventory sync schedules currently depend on having an inventory id and group id
                        else {
                            throw {name : 'NotImplementedError', message : 'activity.summary_fields to build this url not implemented yet'};
                        }
                        break;
                    case 'notification_template':
                        throw {name : 'NotImplementedError', message : 'activity.summary_fields to build this url not implemented yet'};
                    case 'role':
                        throw {name : 'NotImplementedError', message : 'role object management is not consolidated to a single UI view'};
                    default:
                        url += resource + 's/' + obj.id + '/';
                }
                return ' <a href=\"' + url + '\"> ' + $filter('sanitize')(obj.name || obj.username) + ' </a> ';
            }
            catch(err){
                $log.debug(err);
                return ' ' + $filter('sanitize')(obj.name || obj.username || '') + ' ';
            }
        };
    }
])

.factory('BuildDescription', ['BuildAnchor', '$log', 'i18n',
    function (BuildAnchor, $log, i18n) {
        return function (activity) {

            var pastTense = function(operation){
                return (/e$/.test(activity.operation)) ? operation + 'd ' : operation + 'ed ';
            };
            // convenience method to see if dis+association operation involves 2 groups
            // the group cases are slightly different because groups can be dis+associated into each other
            var isGroupRelationship = function(activity){
                return activity.object1 === 'group' && activity.object2 === 'group' && activity.summary_fields.group.length > 1;
            };

            // Activity stream objects will outlive the resources they reference
            // in that case, summary_fields will not be available - show generic error text instead
            try {
                activity.description = pastTense(activity.operation);
                switch(activity.object_association){
                    // explicit role dis+associations
                    case 'role':
                        // object1 field is resource targeted by the dis+association
                        // object2 field is the resource the role is inherited from
                        // summary_field.role[0] contains ref info about the role
                        switch(activity.operation){
                            // expected outcome: "disassociated <object2> role_name from <object1>"
                            case 'disassociate':
                                if (isGroupRelationship(activity)){
                                    activity.description += BuildAnchor(activity.summary_fields.group[1], activity.object2, activity) + activity.summary_fields.role[0].role_field +
                                        ' from ' + BuildAnchor(activity.summary_fields.group[0], activity.object1, activity);
                                }
                                else{
                                    activity.description += BuildAnchor(activity.summary_fields[activity.object2][0], activity.object2, activity) + activity.summary_fields.role[0].role_field +
                                    ' from ' + BuildAnchor(activity.summary_fields[activity.object1][0], activity.object1, activity);
                                }
                                break;
                            // expected outcome: "associated <object2> role_name to <object1>"
                            case 'associate':
                                if (isGroupRelationship(activity)){
                                    activity.description += BuildAnchor(activity.summary_fields.group[1], activity.object2, activity) + activity.summary_fields.role[0].role_field +
                                        ' to ' + BuildAnchor(activity.summary_fields.group[0], activity.object1, activity);
                                }
                                else{
                                    activity.description += BuildAnchor(activity.summary_fields[activity.object2][0], activity.object2, activity) + activity.summary_fields.role[0].role_field +
                                    ' to ' + BuildAnchor(activity.summary_fields[activity.object1][0], activity.object1, activity);
                                }
                                break;
                        }
                        break;
                    // inherited role dis+associations (logic identical to case 'role')
                    case 'parents':
                        // object1 field is resource targeted by the dis+association
                        // object2 field is the resource the role is inherited from
                        // summary_field.role[0] contains ref info about the role
                        switch(activity.operation){
                            // expected outcome: "disassociated <object2> role_name from <object1>"
                            case 'disassociate':
                                if (isGroupRelationship(activity)){
                                    activity.description += activity.object2 + BuildAnchor(activity.summary_fields.group[1], activity.object2, activity) +
                                        'from ' + activity.object1 + BuildAnchor(activity.summary_fields.group[0], activity.object1, activity);
                                }
                                else{
                                    activity.description += BuildAnchor(activity.summary_fields[activity.object2][0], activity.object2, activity) + activity.summary_fields.role[0].role_field +
                                    ' from ' + BuildAnchor(activity.summary_fields[activity.object1][0], activity.object1, activity);
                                }
                                break;
                            // expected outcome: "associated <object2> role_name to <object1>"
                            case 'associate':
                                if (isGroupRelationship(activity)){
                                    activity.description += activity.object1 + BuildAnchor(activity.summary_fields.group[0], activity.object1, activity) +
                                        'to ' + activity.object2 + BuildAnchor(activity.summary_fields.group[1], activity.object2, activity);
                                }
                                else{
                                    activity.description += BuildAnchor(activity.summary_fields[activity.object2][0], activity.object2, activity) + activity.summary_fields.role[0].role_field +
                                    ' to ' + BuildAnchor(activity.summary_fields[activity.object1][0], activity.object1, activity);
                                }
                                break;
                        }
                        break;
                    // CRUD operations / resource on resource dis+associations
                    default:
                        switch(activity.operation){
                            // expected outcome: "disassociated <object2> from <object1>"
                            case 'disassociate' :
                                if (isGroupRelationship(activity)){
                                    activity.description += activity.object2 + BuildAnchor(activity.summary_fields.group[1], activity.object2, activity) +
                                        'from ' + activity.object1 + BuildAnchor(activity.summary_fields.group[0], activity.object1, activity);
                                }
                                else {
                                    activity.description += activity.object2 + BuildAnchor(activity.summary_fields[activity.object2][0], activity.object2, activity) +
                                        'from ' + activity.object1 + BuildAnchor(activity.summary_fields[activity.object1][0], activity.object1, activity);
                                }
                                break;
                            // expected outcome "associated <object2> to <object1>"
                            case 'associate':
                                // groups are the only resource that can be associated/disassociated into each other
                                if (isGroupRelationship(activity)){
                                    activity.description += activity.object1 + BuildAnchor(activity.summary_fields.group[0], activity.object1, activity) +
                                        'to ' + activity.object2 + BuildAnchor(activity.summary_fields.group[1], activity.object2, activity);
                                }
                                else {
                                    activity.description += activity.object1 + BuildAnchor(activity.summary_fields[activity.object1][0], activity.object1, activity) +
                                        'to ' + activity.object2 + BuildAnchor(activity.summary_fields[activity.object2][0], activity.object2, activity);
                                }
                                break;
                            case 'delete':
                                activity.description += activity.object1 + BuildAnchor(activity.changes, activity.object1, activity);
                                break;
                            // expected outcome: "operation <object1>"
                            case 'update':
                                activity.description += activity.object1 + BuildAnchor(activity.summary_fields[activity.object1][0], activity.object1, activity);
                                break;
                            case 'create':
                                activity.description += activity.object1 + BuildAnchor(activity.changes, activity.object1, activity);
                                break;
                        }
                        break;
                }
            }
            catch(err){
                $log.debug(err);
                activity.description = i18n._('Event summary not available');
            }
        };
    }
])

.factory('ShowDetail', ['$filter', '$rootScope', 'Rest', 'Alert', 'GenerateForm', 'ProcessErrors', 'GetBasePath', 'FormatDate',
    'ActivityDetailForm', 'Empty', 'Find',
    function ($filter, $rootScope, Rest, Alert, GenerateForm, ProcessErrors, GetBasePath, FormatDate, ActivityDetailForm, Empty, Find) {
        return function (params, scope) {

            var activity_id = params.activity_id,
                activity = Find({ list: params.scope.activities, key: 'id', val: activity_id }),
                element;

            if (activity) {

                // Grab our element out of the dom
                element = angular.element(document.getElementById('stream-detail-modal'));

                // Grab the modal's scope so that we can set a few variables
                scope = element.scope();

                scope.changes = activity.changes;
                scope.user = ((activity.summary_fields.actor) ? activity.summary_fields.actor.username : 'system') +
                     ' on ' + $filter('longDate')(activity.timestamp);
                scope.operation = activity.description;
                scope.header = "Event " + activity.id;

                // Open the modal
                $('#stream-detail-modal').modal({
                    show: true,
                    backdrop: 'static',
                    keyboard: true
                });

                if (!scope.$$phase) {
                    scope.$digest();
                }
            }
        };
    }
])

.factory('Stream', ['$rootScope', '$location', '$state', 'Rest', 'GetBasePath',
    'ProcessErrors', 'Wait', 'StreamList', 'generateList', 'FormatDate', 'BuildDescription',
    'ShowDetail',
    function ($rootScope, $location, $state, Rest, GetBasePath, ProcessErrors,
        Wait, StreamList, GenerateList, FormatDate,
        BuildDescription, ShowDetail) {
        return function (params) {

            var scope = params.scope;

            $rootScope.flashMessage = null;

            // descriptive title describing what AS is showing
            scope.streamTitle = (params && params.title) ? params.title : null;

            scope.refreshStream = function () {
                $state.go('.', null, {reload: true});
            };

            scope.showDetail = function (id) {
                ShowDetail({
                    scope: scope,
                    activity_id: id
                });
            };

            scope.activities.forEach(function(activity, i) {
                // build activity.user
                if (scope.activities[i].summary_fields.actor) {
                    scope.activities[i].user = "<a href=\"/#/users/" + scope.activities[i].summary_fields.actor.id  + "\">" +
                        scope.activities[i].summary_fields.actor.username + "</a>";
                } else {
                    scope.activities[i].user = 'system';
                }
                // build description column / action text
                BuildDescription(scope.activities[i]);

            });
        };
    }
]);
