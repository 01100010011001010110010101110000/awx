/*********************************************
 *  Copyright (c) 2013 AnsibleWorks, Inc.
 *
 * GeneratorHelpers
 *
 * Functions shared between FormGenerator and ListGenerator 
 * 
 */

angular.module('GeneratorHelpers', ['GeneratorHelpers'])
    
    .factory('Attr', function() {
    return function(obj, key) { 
        var result;
        switch(key) {
            case 'ngClick':
               result = "ng-click=\"" + obj[key] + "\" ";
               break;
            case 'ngOptions':
               result = "ng-options=\"" + obj[key] + "\" ";
               break;
            case 'ngClass':
                result = "ng-class=\"" + obj[key] + "\" ";
                break;
            case 'ngChange':
               result = "ng-change=\"" + obj[key] + "\" ";
               break;
            case 'ngDisabled':
                result = "ng-disabled=\"" + obj[key] + "\" ";
                break;
            case 'ngShow':
               result = "ng-show=\"" + obj[key] + "\" ";
               break;
            case 'ngHide':
               result = "ng-hide=\"" + obj[key] + "\" ";
               break;
            case 'ngBind':
                result = "ng-bind=\"" + obj[key] + "\" ";
                break;
            case 'trueValue':
               result = "ng-true-value=\"" + obj[key] + "\" ";
               break;
            case 'falseValue':
               result = "ng-false-value=\"" + obj[key] + "\" ";
               break;
            case 'awToolTip':
               result = "aw-tool-tip=\"" + obj[key] + "\" ";
               break;
            case 'awPopOver':
               result = "aw-pop-over='" + obj[key] + "' ";
               break;
            case 'dataTitle':
               result = "data-title=\"" + obj[key] + "\" ";
               break;
            case 'dataPlacement':
               result = "data-placement=\"" + obj[key] + "\" ";
               break;
            default: 
               result = key + "=\"" + obj[key] + "\" ";
        }
        
        return  result; 
        
        }
        })

    .factory('Icon', function() {
    return function(icon) {
       return "<i class=\"" + icon + "\"></i> ";
        }
        })

    .factory('Column', ['Attr', 'Icon', function(Attr, Icon) {
    return function(params) {
        var list = params['list'];
        var fld = params['fld'];
        var options = params['options'];
        var base = params['base'];

        var field = list['fields'][fld];
        var html = '';
        
        html += "<td ";
        html += "<td class=\"" + fld + "-column";
        html += (field['class']) ? " " + field['class'] : "";
        html +=  "\" ";  
        html += (field.ngClass) ? Attr(field, 'ngClass') : "";
        html += ">\n";

        // Add ngShow
        html += (field.ngShow) ? "<span " + Attr(field,'ngShow') + ">" : "";
        
        // Add collapse/expand icon  --used on job_events page
        if (list['hasChildren'] && field.hasChildren) {
           html += "<span style=\"padding-left: \{\{ " + list.iterator + ".spaces \}\}px\"><a href=\"\" ng-click=\"\{\{ " + list.iterator + ".ngclick \}\}\"> " +
               "<i class=\"\{\{ " + list.iterator + ".ngicon \}\}\" ng-show=\"'\{\{ " + 
               list.iterator + ".related.children \}\}' !== ''\" ></i></a> ";
        }

        // Start the Link
        if ((field.key || field.link || field.linkTo || field.ngClick ) && options['mode'] != 'lookup' && options['mode'] != 'select') {
          if (field.linkTo) {
             html += "<a href=\"#" + field.linkTo + "\">";
          }
          else if (field.ngClick) {
             html += "<a href=\"\"" + Attr(field, 'ngClick') + "\">";
          }
          else if (field.link == undefined || field.link) {
             html += "<a href=\"#/" + base + "/{{" + list.iterator + ".id }}\">";
          }
        }

        // Add icon:
        if (field.ngShowIcon) {
          html += "<i ng-show=\"" + field.ngShowIcon + "\" class=\"" + field.icon + "\"></i> ";
        }
        else {
          if (field.icon) {
             html += Icon(field.icon) + " ";
          }
        }

        // Add data binds 
        if (field.showValue == undefined || field.showValue == true) {
          if (field.ngBind) {       
             html += "{{ " + field.ngBind + " }}";
          }
          else {
             html += "{{" + list.iterator + "." + fld + "}}";   
          }
        }
        
        // Add additional text:
        if (field.text) {
          html += field.text;
        }

        if (list['hasChildren'] && field.hasChildren) {
           html += "</span>";
        }
        
        // close the link
        if ((field.key || field.link || field.linkTo || field.ngClick )
            && options.mode != 'lookup' && options.mode != 'select') {
            html += "</a>";
        }

        // close ngShow
        html += (field.ngShow) ? "</span>" : "";
 
        // Specific to Job Events page -showing event detail/results
        html += (field.appendHTML) ? "<div ng-show=\"" +  field.appendHTML + " !== null\" " + 
            "ng-bind-html-unsafe=\"" + field.appendHTML + "\" " +
            "style=\"padding-left: \{\{ " + list.iterator + ".spaces + 12 \}\}px\" " +
            "></div>\n" : "";

        return html += "</td>\n";
    
        }
        }])

    .factory('SearchWidget', function() {
    return function(params) {
        //
        // Generate search widget
        //
        var iterator = params.iterator; 
        var form = params.template; 
        var useMini = params.mini; 
        var label = (params.label) ? params.label : null;
        var html= '';
   
        html += "<div class=\"search-widget\">\n";
        html += (label) ? "<label>" + label +"</label>" : "";
        html += "<div class=\"input-prepend input-append\">\n";
        html += "<div class=\"btn-group\">\n";
        html += "<button class=\"btn "; 
        html += (useMini) ? "btn-mini " : "btn-small";
        html += "dropdown-toggle\" data-toggle=\"dropdown\">\n";
        html += "<span ng-bind=\"" + iterator + "SearchFieldLabel\"></span>\n";
        html += "<span class=\"caret\"></span>\n";
        html += "</button>\n";
        html += "<ul class=\"dropdown-menu\" id=\"" + iterator + "SearchDropdown\">\n";
        
        for ( var fld in form.fields) {
          if (form.fields[fld].searchable == undefined || form.fields[fld].searchable == true) {
             html += "<li><a href=\"\" ng-click=\"setSearchField('" + iterator + "','";
             html += fld + "','" + form.fields[fld].label + "')\">" 
                 + form.fields[fld].label + "</a></li>\n";
          }
        }
        html += "</ul>\n";
        html += "</div>\n";

        html += "<select ng-show=\"" + iterator + "SelectShow\" ng-model=\""+ iterator + "SearchSelectValue\" ng-change=\"search('" + iterator + "')\" ";
        html += "ng-options=\"c.name for c in " + iterator + "SearchSelectOpts\" class=\"search-select";
        html += (useMini) ? " field-mini-height" : "";
        html += "\"></select>\n";

        html += "<input ng-hide=\"" + iterator + "SelectShow || " + iterator + "InputHide\" class=\"input-medium";
        html += (useMini) ? " field-mini-height" : "";
        html += "\" ng-model=\"" + iterator + "SearchValue\" ng-change=\"search('" + iterator + 
                "')\" placeholder=\"Search\" type=\"text\" >\n";

        html += "<div class=\"btn-group\">\n";
        html += "<button ng-hide=\"" + iterator + "SelectShow || " + iterator + "HideSearchType || " + iterator + "InputHide\" class=\"btn ";
        html += (useMini) ? "btn-mini " : "btn-small";
        html += "dropdown-toggle\" data-toggle=\"dropdown\">\n";
        html += "<span ng-bind=\"" + iterator + "SearchTypeLabel\"></span>\n";
        html += "<span class=\"caret\"></span>\n";
        html += "</button>\n";
        html += "<ul class=\"dropdown-menu\">\n";
        html += "<li><a href=\"\" ng-click=\"setSearchType('" + iterator + "','iexact','Exact Match')\">Exact Match</a></li>\n";
        html += "<li><a href=\"\" ng-click=\"setSearchType('" + iterator + "','icontains','Contains')\">Contains</a></li>\n";
        html += "</ul>\n";
        html += "</div>\n";
        html += "</div>\n";
        html += "<div class=\"spin\"><i class=\"icon-spinner icon-spin\" ng-show=\"" + iterator + "SearchSpin == true\"></i></div>\n";
        html += "</div>\n";

        return html;
        
        }
        })

    .factory('PaginateWidget', function() {
    return function(params) {
        var set = params.set; 
        var iterator = params.iterator; 
        var useMini = params.mini;
        var mode = (params.mode) ? params.mode : null;
        var html = '';

        if (mode == 'lookup') {
           html += "<div class=\"lookup-navigation";
        }
        else { 
           html += "<div class=\"footer-navigation";
        }
        html += (useMini) ? " related-footer" : "";
        html += "\">\n";
        html += "<form class=\"form-inline\">\n";
        html += "<button class=\"previous btn";
        html += (useMini) ? " btn-mini\" " : "\" ";
        html += "ng-click=\"prevSet('" + set + "','" + iterator + "')\" " +
                "ng-disabled=\"" + iterator + "PrevUrl == null || " + iterator + "PrevUrl == undefined\"><i class=\"icon-chevron-left\"></i> Prev</button>\n";
        html += "<button class=\"next btn btn";
        html += (useMini) ? " btn-mini\" " : "\" ";
        html += " ng-click=\"nextSet('" + set + "','" + iterator + "')\"" + 
                "ng-disabled=\"" + iterator + "NextUrl == null || " + iterator + "NextUrl == undefined\">Next <i class=\"icon-chevron-right\"></i></button>\n";
        
        if (mode != 'lookup') {
           html += "<label class=\"page-size-label\">Rows per page:</label>\n";
           html += "<select ng-model=\"" + iterator + "PageSize\" ng-change=\"changePageSize('" + 
                    set + "'," + "'" + iterator + "')\" class=\"input-mini";
           html += (useMini) ? " field-mini-height" : "";
           html += " page-size\">\n";
           html += "<option value=\"10\" selected>10</option>\n";
           html += "<option value=\"20\" selected>20</option>\n";
           html += "<option value=\"40\">40</option>\n";
           html += "<option value=\"60\">60</option>\n";
           html += "<option value=\"80\">80</option>\n";    
           html += "</select>\n";
        }

        html += "<div class=\"page-number-small\" ng-show=\"" + iterator + "PageCount > 0\" ";
        html += ">Page: {{ " + iterator + "Page + 1 }} of {{ " + iterator + "PageCount }}</div>\n";
        html += "</form>\n";
        html += "</div>\n";

        return html;

        }
        });