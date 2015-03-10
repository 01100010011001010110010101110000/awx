export default ['$scope', function ($scope) {

    var str = $scope.job_template.id+'_smart',
    recentJobs = $scope.job_template.summary_fields.recent_jobs;
    $scope[str] = {
        id: $scope.job_template.id,
        sparkArray: [],
        jobIds: {},
        smartStatus: []
    };

    function isFailureState(status) {
        return status === 'failed' || status === 'error' || status === 'canceled';
    }

    var sparkData =
        recentJobs.map(function(job) {

            var data = {};

            if (job.status === 'successful') {
                data.value = 1;
            } else if (isFailureState(job.status)) {
                data.value = -1;
            } else {
                data.value = 0;
            }

            data.jobId = job.id;
            data.smartStatus = job.status;

            return data;
        });

    $scope[str].sparkArray = _.pluck(sparkData, 'value');
    $scope[str].jobIds = _.pluck(sparkData, 'jobId');
    $scope[str].smartStatus = _.pluck(sparkData, 'smartStatus');

}];

//
//
// JOB_STATUS_CHOICES = [
//         ('new', _('New')),                  # Job has been created, but not started.
//         ('pending', _('Pending')),          # Job has been queued, but is not yet running.
//         ('waiting', _('Waiting')),          # Job is waiting on an update/dependency.
//         ('running', _('Running')),          # Job is currently running.
//         ('successful', _('Successful')),    # Job completed successfully.
//         ('failed', _('Failed')),            # Job completed, but with failures.
//         ('error', _('Error')),              # The job was unable to run.
//         ('canceled', _('Canceled')),        # The job was canceled before completion.
// final states only*****
//     ]
//
