/************************************
 * Copyright (c) 2014 AnsibleWorks, Inc.
 *
 *  JobStdout.js
 *
 */

'use strict';

function JobStdoutController ($rootScope, $scope, $compile, $routeParams, ClearScope, GetBasePath, Wait, Rest, ProcessErrors, Socket) {

    ClearScope();

    var available_height, job_id = $routeParams.id,
        api_complete = false,
        stdout_url,
        event_socket = Socket({
            scope: $scope,
            endpoint: "job_events"
        });

    Wait('start');

    event_socket.init();

    event_socket.on("job_events-" + job_id, function() {
        if (api_complete) {
            $scope.$emit('LoadStdout');
        }
    });

    if ($scope.removeLoadStdout) {
        $scope.removeLoadStdout();
    }
    $scope.removeLoadStdout = $scope.$on('LoadStdout', function() {
        Rest.setUrl(stdout_url + '?format=json&start_line=-1000');
        Rest.get()
            .success(function(data) {
                api_complete = true;
                Wait('stop');
                if (data.content) {
                    $('#pre-container-content').empty().html(data.content);
                }
                else {
                    $('#pre-container-content').empty();
                }
                setTimeout(function() { $('#pre-container').mCustomScrollbar("scrollTo", 'bottom'); }, 1000);
            })
            .error(function(data, status) {
                ProcessErrors($scope, data, status, null, { hdr: 'Error!',
                    msg: 'Failed to retrieve stdout for job: ' + job_id + '. GET returned: ' + status });
            });
    });

    function resizeToFit() {
        available_height = $(window).height() - $('#main-menu-container .navbar').outerHeight() -
            $('#breadcrumb-container').outerHeight() - 20;
        /*if ($(window).width() < 768) {
            available_height += 55;
        }
        else if ($(window).width() > 1240) {
            available_height += 5;
        }*/
        $('#pre-container').height(available_height);
        $('#pre-container').mCustomScrollbar("update");
    }
    resizeToFit();

    $(window).resize(_.debounce(function() {
        resizeToFit();
    }, 500));

    Rest.setUrl(GetBasePath('jobs') + job_id + '/');
    Rest.get()
        .success(function(data) {
            $scope.job = data;
            stdout_url = data.related.stdout;
            $scope.$emit('LoadStdout');
        })
        .error(function(data, status) {
            ProcessErrors($scope, data, status, null, { hdr: 'Error!',
                msg: 'Failed to retrieve job: ' + job_id + '. GET returned: ' + status });
        });
}

JobStdoutController.$inject = [ '$rootScope', '$scope', '$compile', '$routeParams', 'ClearScope', 'GetBasePath', 'Wait', 'Rest', 'ProcessErrors', 'Socket' ];

