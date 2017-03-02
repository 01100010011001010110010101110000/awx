/*************************************************
 * Copyright (c) 2015 Ansible, Inc.
 *
 * All Rights Reserved
 *************************************************/

 export default ['moment', function(moment) {
     return function(input) {
        var date;
         if(input === null){
             return "";
         }else {
             date = moment(input);
             return date.format('l LTS');
         }
     };
 }];


// function longDateFilter(moment, input) {
//     var date;
//     if(input === null){
//         return "";
//     }else {
//         date = moment(input);
//         return date.format('l LTS');
//     }
// }
//
// export default
//     angular.module('longDateFilter', [])
//         .filter('longDate',
//                 [   'moment',
//                     function(moment) {
//                         return _.partial(longDateFilter, moment);
//                     }
//                 ]);
