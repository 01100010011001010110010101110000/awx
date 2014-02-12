/*********************************************
 *  Copyright (c) 2014 AnsibleWorks, Inc.
 *
 *  JobEventData.js
 *  Form definition for Job Events -JSON view
 *
 *  
 */
angular.module('JobEventDataDefinition', [])
    .value('JobEventDataForm', {
        
        editTitle: '{{ id }} - {{ event_display }}',
        name: 'job_events',
        well: false,
        'class': 'horizontal-narrow',

        fields: {
            event_data: {
                label: false,
                type: 'textarea',
                readonly: true,
                rows: 18,
                'class': 'modal-input-xxlarge'
            }
        }
            
    }); //Form
