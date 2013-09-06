/************************************
 * 
 *  Copyright (c) 2013 AnsibleWorks, Inc.
 *
 *  config.js
 *
 *  Gobal configuration variables for controlling application behavior.
 *
 */

var $AnsibleConfig = 
{                                     
   tooltip_delay: {show: 500, hide: 100},   // Default number of milliseconds to delay displaying/hiding tooltips    

   debug_mode: true,                        // Enable console logging messages

   password_strength: 45              // User password strength. Integer between 0 and 100, 100 being impossibly strong.
                                      // This value controls progress bar colors: 
                                      //   0 to password_strength - 15 = red; 
                                      //   password_strength - 15 to password_strength = yellow 
                                      //   > password_strength = green
                                      // It also controls password validation. Passwords are rejected if the score is not > password_strength.  
   }
