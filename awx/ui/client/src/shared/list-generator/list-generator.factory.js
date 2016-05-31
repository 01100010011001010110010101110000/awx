/*************************************************
 * Copyright (c) 2015 Ansible, Inc.
 *
 * All Rights Reserved
 *************************************************/

  /**
 *  @ngdoc function
 *  @name shared.function:list-generator
 *  @description
 * #ListGenerator
 *
 * Use GenerateList.inject(list_object, { key:value }) to generate HTML from a list object and inject it into the DOM. Returns the $scope of the new list.
 *
 * Pass in a list object and a JSON object of key:value parameters. List objects are found in lists/*.js. Possible parameters include:
 *
 * | Parameter | Required | Description |
 * | --------- | -------- | ----------- |
 * | activityStream | | Used in widgets/stream.js to create the list contained within the activity stream widget. |
 * | hdr | | Deprecated. Was used when list generator created the lookup dialog. This was moved to helpers/Lookup.js. |
 * | id | | DOM element ID attribute value. Use to inject the list into a custom DOM element. Otherwise, the HTML for a list will be injected into the DOM element with an ID attribute of 'htmlTemplate'. |
 * | listSize  | | Bootstrap size class to apply to the grid column containing the action buttons, which generally appears to the right of the search widget. Defaults to 'col-lg-8 col-md-6 col-sm-4 col-xs-3'. |
 * | mode | Yes | One of 'edit', 'lookup', 'select', or 'summary'. Generally this will be 'edit'. helpers/Lookup.js uses 'lookup' to generate the lookup dialog. The 'select' option is used in certain controllers when multiple objects are being added to a parent object. For example, building a select list of Users that can be added to an Oranization. 'summary' is no longer used. |
 * | scope |  | If the HTML will be injected into the DOM by list generator, pass in an optional $scope to be used in conjuction with $compile. The list will be associated with the scope value. Otherwise, the scope of the DOM element will be fetched passed to $compile. |
 * | showSearch | | true or false. Set to false, if the search widget should not be included in the generated HTML. |
 * | searchSize | | Bootstrap size class (e.g. col-lg-3, col-md-4, col-sm-5, etc.) to apply to the search widget. Defaults to 'col-lg-4 col-md-6 col-sm-8 col-xs-9'. |
 *
 * #HTML only
 *
 * Use the buildHTML() method to get a string containing the generated HTML for a list object. buldHTML() expects the same parameters as the inject method. For example:
 * ```
 *     var html = GenerateList.buildHTML({
 *         mode: 'edit',
 *         showSearch: false
 *     });
 * ```
 *
 * #List Objects
 *
 * List objects are found in lists/*.js. Any API endpoint that returns a collection or array is represented with a list object. Examples inlcude Organizations, Credentials, Inventories, etc.
 * A list can have the following attributes:
 *
 * | Attribute | Description |
 * | --------- | ----------- |
 * | index | true or false. If false, the index column, which adds a sequential number to each table row starting with 1, will not be added to the table. |
 * | iterator | String containing a descriptive name of a single row in the collection - inventory, organization, credential, etc. Used to generate name and ID attributes in the list HTML. |
 * | name | Name of the collection. Generally matches the endpoint name - inventories, organizations, etc. Will match the $scope variable containing the array of rows comprising the collection. |
 * | selectTitle | Descriptive title used when mode is 'select'. |
 * | selectInstructions | Text and HTML used to create popover for help button when mode is 'select'. |
 * | editTitle | Descriptive title used when mode is 'edit'. |
 *
 * ##Fields
 *
 * A list contains a fields object. Each column in the list is defined as a separate object within the fields object. A field definition may contain the following attributes:
 *
 * | Attribute | Description |
 * | --------- | ----------- |
 * | columnClass | String of CSS class names to add to the &lt;td&gt; elemnts of the table column. |
 * | columnClick | Adds an ng-click directive to the &lt;td&gt; element. |
 * | excludeModal | true or false. If false, the field will not be included in the generated HTML when the mode is 'lookup' |
 * | key | true or false. If set to true, helpers/search.js will use the field name as the default sort order when generating the API request. |
 * | noLink | true or false. If set to true this will override any 'key', 'linkTo', 'ngClick', or other option that would cause the field to be a link. Used in portal mode and custom inv. script. |
 * | label | Text string used as the column header text. |
 * | linkTo | Wraps the field value with an &lt;a&gt; element. Set to the value of the href attribute. |
 * | ngClick | Wraps the field value with an &lt;a&gt; and adds the ng-click directive. Set to the JS expression that ng-click will evaluate. |
 * | nosort | true or false. Setting to false removes the ability to sort the table by the column. |
 * | searchable | true or fasel. Set to false if the field should not be included as in option in the search widget. |
 * | searchOnly | true or false. Set to true if the field should be included in the search widget but not included as a column in the generated HTML &lt;table&gt;. |
 * | searchOptions | Array of { name: 'Descriptive Name', value: 'api_value' } objects used to generate &lt;options&gt; for the &lt;select&gt; when searchType is 'select'. |
 * | searchType | One of the available search types defined in helpers/search.js. |
 * | sourceField | Name of the attribute within summary_fields.<source_model> that the field maps to in the API response object. Used in conjunction with sourceModel. |
 * | sourceModel | Name of the summary_fields object that the field maps to in the API response object. |
 *
 * ##Field Actions
 *
 * A list contains a fieldActions object. Each icon found in the Actions column is defined as an object within the feildActions object. fieldActions can have a columnClass attribute,
 * which may contain a string of CSS class names to add to the action &lt;td&gt; element. It may also contain a label attribute, which can be set to false to suppress the Actions column header.
 *
 * Feld action items can have the following attributes:
 *
 * | Attribute | Description |
 * | --------- | ----------- |
 * | actionclass | Set to a string containing any CSS classes to add to the button. |
 * | awToolTip | Adds the aw-tool-tip directive. Set to the value of the HTML or text to dislay in the tooltip. |
 * | buttonContent | String containing button content.  HTML is accepted in this string. |
 * | dataPlacement | Set to the Bootstrip tooltip placement - right, left, top, bottom, etc. |
 * | dataTipWatch | Set to the $scope variable that contains the text and HTML to display in the tooltip. A $scope.$watch will be added to the variable so that anytime its value changes the tooltip will change. |
 * | mode | One of 'all' or 'edit'. Will generally be 'all'. Note that field actions are not displayed when the list is in 'lookup' mode. |
 * | ngClass | Adds the ng-class directive. Set to the JS expression that ng-class will evaluate. |
 * | ngShow | Adds the ng-show directive. Set to the JS expression that ng-show will evaluate. |
 *
 * ##Actions
 *
 * A list can contain an actions object. The actions object contains an object for each action button displayed in the top-right corner of the list container. An action can have the same
 * attributes as an action defined in fieldAction. Both are actions. Clicking on an action evaluates the JS found in the ngClick attribute. In both cases icon is generated automatically by the SelectIcon() method in js/shared/generator-helpers.js.
 * The real difference is that an &lt;a&gt element is used to generate fieldAction items while a &lt;button&gt; element is used for action items.
 */

import {templateUrl} from '../../shared/template-url/template-url.factory';

export default ['$location', '$compile', '$rootScope', 'SearchWidget', 'PaginateWidget', 'Attr', 'Icon', 'getSearchHtml',
        'Column', 'DropDown', 'NavigationLink', 'SelectIcon', 'ActionButton',
    function ($location, $compile, $rootScope, SearchWidget, PaginateWidget, Attr, Icon, getSearchHtml, Column, DropDown, NavigationLink,
        SelectIcon, ActionButton) {
            return {

                setList: function (list) {
                    this.list = list;
                },

                setOptions: function(options) {
                    this.options = options;
                },

                attr: Attr,

                icon: Icon,

                has: function (key) {
                    return (this.form[key] && this.form[key] !== null && this.form[key] !== undefined) ? true : false;
                },

                hide: function () {
                    $('#lookup-modal').modal('hide');
                },

                buildHTML: function(list, options) {
                    this.setList(list);
                    return this.build(options);
                },

                inject: function (list, options) {
                    // options.mode = one of edit, select or lookup
                    //
                    // Modes edit and select will inject the list as html into element #htmlTemplate.
                    // 'lookup' mode injects the list html into #lookup-modal-body.
                    //
                    // For options.mode == 'lookup', include the following:
                    //
                    //     hdr: <lookup dialog header>
                    //
                    // Inject into a custom element using options.id: <element id attribute value>
                    var element;

                    if (options.id) {
                        element = angular.element(document.getElementById(options.id));
                    } else {
                        element = angular.element(document.getElementById('htmlTemplate'));
                    }

                    this.setOptions(options);
                    this.setList(list);
                    element.html(this.build(options)); // Inject the html

                    if (options.prepend) {
                        element.prepend(options.prepend);
                    }

                    if (options.append) {
                        element.append(options.append);
                    }

                    if (options.scope) {
                        this.scope = options.scope;
                    } else {
                        this.scope = element.scope();
                    }

                    this.scope.list = list;
                    this.scope.mode = options.mode;

                    // respond to changes to the edit indicator from
                    // the stateChangeStart event in app.js
                    this.scope.$on("EditIndicatorChange", function(e, list, id) {
                        e.targetScope.listBeingEdited = list;
                        e.targetScope.rowBeingEdited = id;
                    });

                    this.scope.$on("RemoveIndicator", function(e) {
                        delete e.targetScope.listBeingEdited;
                        delete e.targetScope.rowBeingEdited;
                    });

                    this.scope.isHiddenByOptions = function(options) {

                        // If neither ngHide nor ngShow are specified we
                        // know it.s not hidden by options
                        //
                        if (!options.ngHide && !options.ngShow) {
                            return false;
                        }

                        // If ngHide option is passed && evals to true
                        // it's hidden
                        if (options.ngHide && this.scope.$eval(options.ngHide)) {
                            return true;
                        }

                        // If ngShow option is passed && evals to false
                        // it's hidden
                        if (options.ngShow && !this.scope.$eval(options.ngShow)) {
                            return true;
                        }

                        // Otherwise, it's not hidden
                        return false;
                    }.bind(this);

                    this.scope.hiddenOnCurrentPage = function(actionPages) {
                        var base = $location.path().replace(/^\//, '').split('/')[0];

                        if (!actionPages) {
                            return false;
                        } else if (actionPages.indexOf(base) > -1) {
                            return false;
                        } else {
                            return true;
                        }

                    };

                    this.scope.hiddenInCurrentMode = function(actionMode) {
                        if (options.mode === actionMode || actionMode === 'all') {
                            return false;
                        }
                    };

                    if (list.multiSelect) {
                        var cleanupSelectionChanged =
                            this.scope.$on('multiSelectList.selectionChanged', function(e, selection) {
                                this.scope.selectedItems = selection.selectedItems;

                                // Track the selected state of each item
                                // for changing the row class based on the
                                // selection
                                //
                                selection.selectedItems.forEach(function(item) {
                                    item.isSelected = true;
                                });

                                selection.deselectedItems.forEach(function(item) {
                                    item.isSelected = false;
                                });
                            }.bind(this));

                        this.scope.$on('$destroy', function() {
                            cleanupSelectionChanged();
                        });

                    }

                    $compile(element)(this.scope);

                    // Reset the scope to prevent displaying old data from our last visit to this list
                    //this.scope[list.name] = null;
                    this.scope[list.iterator] = [];

                    // Remove any lingering tooltip and popover <div> elements
                    $('.tooltip').each(function() {
                        $(this).remove();
                    });

                    $('.popover').each(function() {
                        // remove lingering popover <div>. Seems to be a bug in TB3 RC1
                        $(this).remove();
                    });

                    try {
                        $('#help-modal').empty().dialog('destroy');
                    } catch (e) {
                        //ignore any errors should the dialog not be initialized
                    }

                    /*if (options.mode === 'lookup') {
                        // options should include {hdr: <dialog header>, action: <function...> }
                        this.scope.formModalActionDisabled = false;
                        this.scope.lookupHeader = options.hdr;
                        $('#lookup-modal').modal({
                            backdrop: 'static',
                            keyboard: true
                        });
                        $('#lookup-modal').unbind('hidden.bs.modal');
                        $(document).bind('keydown', function (e) {
                            if (e.keyCode === 27) {
                                $('#lookup-modal').modal('hide');
                            }
                        });
                    }*/

                    return this.scope;
                },

                build: function (options) {
                    //
                    // Generate HTML. Do NOT call this function directly. Called by inject(). Returns an HTML
                    // string to be injected into the current view.
                    //
                    var html = '',
                        list = this.list,
                        base, action, fld, cnt, field_action, fAction, itm;

                        if (options.mode !== 'lookup') {
                          if(options.title !== false){
                              html += "<div class=\"List-header\">";
                              html += "<div class=\"List-title\">";

                              if (list.listTitle) {

                                  html += "<div class=\"List-titleText\">" + list.listTitle + "</div>";
                                  // We want to show the list title badge by default and only hide it when the list config specifically passes a false flag
                                  list.listTitleBadge = (typeof list.listTitleBadge === 'boolean' && list.listTitleBadge === false) ? false : true;
                                  if(list.listTitleBadge) {
                                      html += "<span class=\"badge List-titleBadge\">{{(" + list.iterator + "_total_rows | number:0)}}</span>";
                                  }

                              }

                              html += "</div>";
                              if(options.cancelButton === true) {
                                  html += "<div class=\"Form-exitHolder\">";
                                  html += "<button class=\"Form-exit\" ng-click=\"formCancel()\">";
                                  html += "<i class=\"fa fa-times-circle\"></i>";
                                  html += "</button></div>\n";
                              }
                              html += "<div class=\"List-actionHolder\">";
                              html += "<div class=\"List-actions\">";
                              html += "<div ng-include=\"'" +
                                  templateUrl('shared/list-generator/list-actions') +
                                  "'\">\n";

                              for (action in list.actions) {
                                  list.actions[action] = _.defaults(list.actions[action], { dataPlacement: "top" });
                              }

                              html += "</div>";
                              if(list.toolbarAuxAction) {
                                  html += "<div class=\"List-auxAction\">";
                                  html += list.toolbarAuxAction;
                                  html += "</div>";
                              }
                              html += "\n</div>";
                              html += "</div>";
                              html += "</div>";
                          }
                        }


                    if (options.mode === 'edit' && list.editInstructions) {
                        html += "<div class=\"alert alert-info alert-block\">\n";
                        html += "<button type=\"button\" class=\"close\" data-dismiss=\"alert\"><i class=\"fa fa-times-circle\"></i></button>\n";
                        html += "<strong>Hint: </strong>" + list.editInstructions + "\n";
                        html += "</div>\n";
                    }

                    if (options.instructions) {
                        html += "<div class=\"instructions alert alert-info\">" + options.instructions + "</div>\n";
                    }
                    else if (list.instructions) {
                        html += "<div class=\"instructions alert alert-info\">" + list.instructions + "</div>\n";
                    }

                    if (options.mode !== 'lookup' && (list.well === undefined || list.well)) {
                        html += "<div class=\"List-well\">\n";
                    }

                    html += (list.searchRowActions) ? "<div class='row'><div class=\"col-lg-8 col-md-8 col-sm-8 col-xs-12\">" : "";
                    if (options.showSearch=== undefined || options.showSearch === true) {
                        var tagSearch = getSearchHtml
                            .inject(getSearchHtml.getList(list),
                                getSearchHtml.getEndpoint(list),
                                list.name,
                                list.iterator);
                        html += `
<div
    ng-hide=\"${list.iterator}Loading == false &&
        ${list.iterator}_active_search == false &&
        ${list.iterator}_total_rows <1\">
    ${tagSearch}
</div>
                        `;
                    }
                    if(list.searchRowActions) {
                        html += "</div><div class='col-lg-4 col-md-4 col-sm-4 col-xs-12'>";

                        var actionButtons = "";
                        Object.keys(list.searchRowActions || {})
                            .forEach(act => {
                                actionButtons += ActionButton(list.searchRowActions[act]);
                            });
                        html += `
                            <div class=\"list-actions\">
                                ${actionButtons}
                            </div>
                        `;
                        html += "</div></div>";
                    }

                    if (options.showSearch=== undefined || options.showSearch === true) {
                        // Message for when a search returns no results.  This should only get shown after a search is executed with no results.
                        html += "<div class=\"row\" ng-show=\"" + list.iterator + "Loading == false && " + list.iterator + "_active_search == true && " + list.name + ".length == 0\">\n";
                        html += "<div class=\"col-lg-12 List-searchNoResults\">No records matched your search.</div>\n";
                        html += "</div>\n";
                    }

                    // Show the "no items" box when loading is done and the user isn't actively searching and there are no results
                    html += "<div class=\"List-noItems\" ng-show=\"" + list.iterator + "Loading == false && " + list.iterator + "_active_search == false && " + list.iterator + "_total_rows < 1\">";
                    html += (list.emptyListText) ? list.emptyListText : "PLEASE ADD ITEMS TO THIS LIST";
                    html += "</div>";

                    // Add a title and optionally a close button (used on Inventory->Groups)
                    if (options.mode !== 'lookup' && list.showTitle) {
                        html += "<div class=\"form-title\">";
                        html += (options.mode === 'edit' || options.mode === 'summary') ? list.editTitle : list.addTitle;
                        html += "</div>\n";
                    }

                    // table header row
                    html += "<div class=\"list-table-container\" ng-show=\"" + list.iterator + "Loading == true || (" + list.iterator + "Loading == false && " + list.name + ".length > 0)\"";
                    html += (list.awCustomScroll) ? " aw-custom-scroll " : "";
                    html += ">\n";

                    function buildTable() {
                        var extraClasses = list['class'];
                        var multiSelect = list.multiSelect ? 'multi-select-list' : null;
                        var multiSelectExtended = list.multiSelectExtended ? 'true' : 'false';

                        if (options.mode === 'summary') {
                            extraClasses += ' table-summary';
                        }

                        return $('<table>')
                                    .attr('id', list.name + '_table')
                                    .addClass('List-table')
                                    .addClass(extraClasses)
                                    .attr('multi-select-list', multiSelect)
                                    .attr('is-extended', multiSelectExtended);

                    }

                    var table = buildTable();
                    var innerTable = '';

                    if (!options.skipTableHead) {
                        innerTable += this.buildHeader(options);
                    }

                    // table body
                    innerTable += "<tbody>\n";
                    innerTable += "<tr ng-class=\"[" + list.iterator;
                    innerTable += (options.mode === 'lookup' || options.mode === 'select') ? ".success_class" : ".active_class";

                    if (list.multiSelect) {
                        innerTable += ", " + list.iterator + ".isSelected ? 'is-selected-row' : ''";
                    }
                    innerTable += ", rowBeingEdited === '{{ " + list.iterator + ".id }}' && listBeingEdited === '" + list.name + "' ? 'List-tableRow--selected' : ''";
                    innerTable += "]\" ";
                    innerTable += "id=\"{{ " + list.iterator + ".id }}\" ";
                    innerTable += "class=\"List-tableRow " + list.iterator + "_class\" ";
                    innerTable += "ng-class-odd=\"'List-tableRow--oddRow'\" ";
                    innerTable += "ng-class-even=\"'List-tableRow--evenRow'\" ";
                    innerTable += "ng-repeat=\"" + list.iterator + " in " + list.name;
                    innerTable += (list.trackBy) ? " track by " + list.trackBy : " track by $index";
                    innerTable += (list.orderBy) ? " | orderBy:'" + list.orderBy + "'" : "";
                    innerTable += (list.filterBy) ? " | filter: " + list.filterBy : "";
                    innerTable += "\">\n";

                    if (list.index) {
                        innerTable += "<td class=\"index-column hidden-xs List-tableCell\">{{ $index + ((" + list.iterator + "_page - 1) * " + list.iterator + "_page_size) + 1 }}.</td>\n";
                    }

                    if (list.multiSelect) {
                        innerTable += '<td class="col-xs-1 select-column List- List-staticColumn--smallStatus"><select-list-item item=\"' + list.iterator + '\"></select-list-item></td>';
                    }

                    // Change layout if a lookup list, place radio buttons before labels
                    if (options.mode === 'lookup') {
                      if(options.input_type==="radio"){ //added by JT so that lookup forms can be either radio inputs or check box inputs
                          innerTable += "<td class=\"List-tableCell\"><input type=\"radio\" ng-model=\"" + list.iterator + ".checked\" name=\"check_" + list.iterator + "_{{" +
                          list.iterator + ".id }}\" ng-click=\"toggle_" + list.iterator + "(" + list.iterator + ".id, true)\" ng-value=\"1\" " +
                          "ng-false-value=\"0\" id=\"check_" + list.iterator + "_{{" + list.iterator + ".id}}\" /></td>";
                      }
                      else { // its assumed that options.input_type = checkbox
                          innerTable += "<td class=\"List-tableCell select-column List-staticColumn--smallStatus\"><input type=\"checkbox\" ng-model=\"" + list.iterator + ".checked\" name=\"check_{{" +
                          list.iterator + ".id }}\" ng-click=\"toggle_" + list.iterator + "(" + list.iterator + ".id, true)\" ng-true-value=\"1\" " +
                          "ng-false-value=\"0\" id=\"check_" + list.iterator + "_{{" + list.iterator + ".id}}\" /></td>";
                      }
                    }

                    cnt = 2;
                    base = (list.base) ? list.base : list.name;
                    base = base.replace(/^\//, '');
                    for (fld in list.fields) {
                        cnt++;
                        if ((list.fields[fld].searchOnly === undefined || list.fields[fld].searchOnly === false) &&
                            !(options.mode === 'lookup' && list.fields[fld].excludeModal === true)) {
                            innerTable += Column({
                                list: list,
                                fld: fld,
                                options: options,
                                base: base
                            });
                        }
                    }

                    if (options.mode === 'select') {
                        if(options.input_type==="radio"){ //added by JT so that lookup forms can be either radio inputs or check box inputs
                            innerTable += "<td class=\"List-tableCell\"><input type=\"radio\" ng-model=\"" + list.iterator + ".checked\" name=\"check_{{" +
                            list.iterator + ".id }}\" ng-click=\"toggle_" + list.iterator + "(" + list.iterator + ".id, true)\" ng-value=\"1\" " +
                            "ng-false-value=\"0\" id=\"check_{{" + list.iterator + ".id}}\" /></td>";
                        }
                        else { // its assumed that options.input_type = checkbox
                            innerTable += "<td class=\"List-tableCell\"><input type=\"checkbox\" ng-model=\"" + list.iterator + ".checked\" name=\"check_{{" +
                            list.iterator + ".id }}\" ng-click=\"toggle_" + list.iterator + "(" + list.iterator + ".id, true)\" ng-true-value=\"1\" " +
                            "ng-false-value=\"0\" id=\"check_{{" + list.iterator + ".id}}\" /></td>";
                        }
                    } else if ((options.mode === 'edit' || options.mode === 'summary') && list.fieldActions) {

                        // Row level actions

                        innerTable += "<td class=\"List-actionButtonCell List-tableCell\">";

                        for (field_action in list.fieldActions) {
                            if (field_action !== 'columnClass') {
                                if (list.fieldActions[field_action].type && list.fieldActions[field_action].type === 'DropDown') {
                                    innerTable += DropDown({
                                        list: list,
                                        fld: field_action,
                                        options: options,
                                        base: base,
                                        type: 'fieldActions',
                                        td: false
                                    });
                                } else {
                                    fAction = list.fieldActions[field_action];
                                    innerTable += "<button id=\"";
                                    innerTable += (fAction.id) ? fAction.id : field_action + "-action";
                                    innerTable += "\" ";
                                    innerTable += (fAction.href) ? "href=\"" + fAction.href + "\" " : "";
                                    innerTable += (fAction.ngHref) ? "ng-href=\"" + fAction.ngHref + "\" " : "";
                                    innerTable += "class=\"List-actionButton ";
                                    innerTable += (field_action === 'delete') ? "List-actionButton--delete" : "";
                                    innerTable += (field_action === 'cancel') ? "cancel red-txt" : "";
                                    innerTable += "\" ";
                                    // debugger;
                                    // rowBeingEdited === '{{ " + list.iterator + ".id }}' && listBeingEdited === '" + list.name + "' ? 'List-tableRow--selected' : ''";
                                    innerTable += (field_action === 'edit') ? "ng-class=\"[rowBeingEdited === '{{ " + list.iterator + ".id }}' && listBeingEdited === '" + list.name + "' ? 'List-editButton--selected' : '']\"" : "";
                                    innerTable += (fAction.awPopOver) ? "aw-pop-over=\"" + fAction.awPopOver + "\" " : "";
                                    innerTable += (fAction.dataPlacement) ? Attr(fAction, 'dataPlacement') : "";
                                    innerTable += (fAction.dataTitle) ? Attr(fAction, 'dataTitle') : "";
                                    for (itm in fAction) {
                                        if (itm !== 'ngHref' && itm !== 'href' && itm !== 'label' && itm !== 'icon' && itm !== 'class' &&
                                            itm !== 'iconClass' && itm !== "dataPlacement" && itm !== "awPopOver" &&
                                            itm !== "dataTitle") {
                                            innerTable += Attr(fAction, itm);
                                        }
                                    }
                                    innerTable += ">";
                                    if (fAction.iconClass) {
                                        innerTable += "<i class=\"" + fAction.iconClass + "\"></i>";
                                    } else {
                                        innerTable += SelectIcon({
                                            action: field_action
                                        });
                                    }
                                    //html += (fAction.label) ? "<span class=\"list-action-label\"> " + list.fieldActions[field_action].label +
                                    //    "</span>" : "";
                                    innerTable += "</button>";
                                }
                            }
                        }
                        innerTable += "</td>\n";
                    }

                    innerTable += "</tr>\n";

                    // Message for loading
                    innerTable += "<tr class=\"loading-info\" ng-show=\"" + list.iterator + "Loading == true\">\n";
                    innerTable += "<td colspan=\"" + cnt + "\" class=\"List-tableCell\"><div class=\"loading-info\">Loading...</div></td>\n";
                    innerTable += "</tr>\n";

                    // End List
                    innerTable += "</tbody>\n";

                    table.html(innerTable);
                    html += table.prop('outerHTML');

                    html += "</div><!-- table container -->\n";

                    if (options.mode === 'select' && (options.selectButton === undefined || options.selectButton)) {
                        html += "<div class=\"navigation-buttons\">\n";
                        html += " <button class=\"btn btn-sm btn-primary pull-right\" id=\"select_btn\" aw-tool-tip=\"Complete your selection\" " +
                            "ng-click=\"finishSelection()\" ng-disabled=\"disableSelectBtn\"><i class=\"fa fa-check\"></i> Select</button>\n";
                        html += "</div>\n";
                    }

                    if (options.mode !== 'lookup' && (list.well === undefined || list.well === true)) {
                        html += "</div>\n"; //well
                    }

                    if (options.mode === 'lookup' || (options.id && options.id === "form-modal-body")) {
                        html += PaginateWidget({
                            set: list.name,
                            iterator: list.iterator
                        });
                    } else {
                        html += PaginateWidget({
                            set: list.name,
                            iterator: list.iterator
                        });
                    }

                    return html;
                },

                buildHeader: function(options) {
                    var list = this.list,
                        fld, html;

                    function buildSelectAll() {
                        return $('<th>')
                                .addClass('col-xs-1 select-column List-tableHeader List-staticColumn--smallStatus')
                                .append(
                                    $('<select-all>')
                                        .attr('selections-empty', 'selectedItems.length === 0')
                                        .attr('items-length', list.name + '.length')
                                        .attr('label', ''));
                    }

                    if (options === undefined) {
                        options = this.options;
                    }

                    html = "<thead>\n";
                    html += "<tr class=\"List-tableHeaderRow\">\n";
                    if (list.index) {
                        html += "<th class=\"col-lg-1 col-md-1 col-sm-2 hidden-xs List-tableHeader\">#</th>\n";
                    }

                    if (list.multiSelect) {
                        html += buildSelectAll().prop('outerHTML');
                    }
                    else if (options.mode === 'lookup') {
                        html += "<th class=\"List-tableHeader  select-column List-staticColumn--smallStatus\"></th>";
                    }
                    for (fld in list.fields) {
                        if ((list.fields[fld].searchOnly === undefined || list.fields[fld].searchOnly === false) &&
                            !(options.mode === 'lookup' && list.fields[fld].excludeModal === true)) {
                            html += "<th class=\"List-tableHeader list-header";
                            if (options.mode === 'lookup' && list.fields[fld].modalColumnClass) {
                                html += " " + list.fields[fld].modalColumnClass;
                            }
                            else if (list.fields[fld].columnClass) {
                                html += " " + list.fields[fld].columnClass;
                            }
                            html += "\" id=\"" + list.iterator + "-" + fld + "-header\"";
                            html += (list.fields[fld].columnShow) ? " ng-show=\"" + list.fields[fld].columnShow + "\" " : "";
                            html += (list.fields[fld].nosort === undefined || list.fields[fld].nosort !== true) ? " ng-click=\"sort('" + list.iterator + "','" + fld + "')\"" : "";
                            html += ">";
                            html += list.fields[fld].label;
                            if (list.fields[fld].nosort === undefined || list.fields[fld].nosort !== true) {
                                html += "<i class=\"List-tableHeaderSort fa ";
                                if (list.fields[fld].key) {
                                    if (list.fields[fld].desc) {
                                        html += "fa-sort-down";
                                    } else {
                                        html += "fa-sort-up";
                                    }
                                } else {
                                    html += "fa-sort";
                                }
                                html += "\"></i></a>";
                            }
                            html += "</th>\n";
                        }
                    }
                    if (options.mode === 'select') {
                        html += "<th class=\"List-tableHeader col-lg-1 col-md-1 col-sm-2 col-xs-2\">Select</th>";
                    } else if (options.mode === 'edit' && list.fieldActions) {
                        html += "<th class=\"List-tableHeader List-tableHeader--actions actions-column";
                        html += (list.fieldActions && list.fieldActions.columnClass) ? " " + list.fieldActions.columnClass : "";
                        html += "\">";
                        html += (list.fieldActions.label === undefined || list.fieldActions.label) ? "Actions" : "";
                        html += "</th>\n";
                    }
                    html += "</tr>\n";
                    html += "</thead>\n";
                    return html;
                }
            };
        }];
