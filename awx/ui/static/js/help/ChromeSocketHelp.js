/*********************************************
 *  Copyright (c) 2014 AnsibleWorks, Inc.
 *
 *  ChromeSocketHelp.js
 *
 *  Help object for socket connection troubleshooting
 *
 */

'use strict';

angular.module('ChromeSocketHelpDefinition', [])
    .value('ChromeSocketHelp', {
        story: {
            hdr: 'Live Events',
            width: 510,
            height: 560,
            steps: [{
                intro: 'Connection status indicator:',
                img: {
                    src: 'socket_indicator.png',
                    maxWidth: 360
                },
                box: "<p><i class=\"fa icon-socket-ok\"></i> indicates live events are streaming and the browser is connected to the live events server.</p><p>If the indicator continually shows <i class=\"fa icon-socket-error\"></i> " +
                    "or <i class=\"fa icon-socket-connecting\"></i>, then live events are not streaming, and the browser is having difficulty connecting to the live events server. In this case click Next for troubleshooting help.</p>"
            }, {
                intro: 'Live events connection:',
                icon: {
                    "class": "fa fa-5x fa-rss {{ socketStatus }}-color",
                    style: "margin-top: 75px;",
                    containerHeight: 200
                },
                box: "<p><strong>{{ browserName }}</strong> is connecting to the live events server on port <strong>{{ socketPort }}</strong>. The current connection status is " +
                    "<i class=\"fa icon-socket-{{ socketStatus }}\"></i> <strong>{{ socketStatus }}</strong>.</p><p>If the connection status indicator is not green, have the " +
                    "system administrator verify this is the correct port and that access to the port is not blocked by a firewall."
            }]
        }
    });
