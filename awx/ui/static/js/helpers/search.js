/*********************************************
 *  Copyright (c) 2013 AnsibleWorks, Inc.
 *
 *  SearchHelper
 *
 *  All the parts for controlling the search widget on 
 *  related collections.
 *
 *  SearchInit({
 *      scope:       <scope>,
 *      set:         <model name (i.e. organizations) used in ng-repeat>
 *      url:         <default api url used to load data>
 *      list:        <list object used by ListGenerator>
 *      });   
 *
 */

angular.module('SearchHelper', ['RestServices', 'Utilities', 'RefreshHelper'])  
    .factory('SearchInit', ['Alert', 'Rest', 'Refresh', '$location', 'GetBasePath', 'Empty', '$timeout',
    function(Alert, Rest, Refresh, $location, GetBasePath, Empty, $timeout) {
    return function(params) {
        
        var scope = params.scope;
        var set = params.set;
        var defaultUrl = params.url;
        var list = params.list; 
        var iterator = (params.iterator) ? params.iterator : list.iterator;
        var sort_order; 
         
        if (scope.searchTimer) {
            $timeout.cancel(scope.searchTimer);
        }
        
        function setDefaults(widget) {
            // Set default values
            var modifier = (widget == undefined || widget == 1) ? '' : widget;
            scope[iterator + 'SearchField' + modifier] = '';
            scope[iterator + 'SearchFieldLabel' + modifier] = '';
            for (fld in list.fields) {
                if (list.fields[fld].searchWidget == undefined && widget == 1 || 
                    list.fields[fld].searchWidget == widget) {
                    if (list.fields[fld].key) {
                       if (list.fields[fld].sourceModel) {
                          var fka = list.fields[fld].sourceModel + '__' + list.fields[fld].sourceField;
                          sort_order = (list.fields[fld].desc) ? '-' + fka : fka;
                       }
                       else {
                          sort_order = (list.fields[fld].desc) ? '-' + fld : fld; 
                       }
                       if (list.fields[fld].searchable == undefined || list.fields[fld].searchable == true) {
                          scope[iterator + 'SearchField' + modifier] = fld;
                          scope[iterator + 'SearchFieldLabel' + modifier] = list.fields[fld].label;
                       }
                       break;
                    }
                }
            }

            if (Empty(scope[iterator + 'SearchField' + modifier])) {
               // A field marked as key may not be 'searchable'. Find the first searchable field.
               for (fld in list.fields) {
                   if (list.fields[fld].searchWidget == undefined && widget == 1 || 
                       list.fields[fld].searchWidget == widget) {
                       if (list.fields[fld].searchable == undefined || list.fields[fld].searchable == true) { 
                          scope[iterator + 'SearchField' + modifier] = fld;
                          scope[iterator + 'SearchFieldLabel' + modifier] = list.fields[fld].label;
                          break;
                       }
                   }
               }
            }

            scope[iterator + 'SearchType' + modifier] = 'icontains';
            scope[iterator + 'SearchTypeLabel' + modifier] = 'Contains';
            scope[iterator + 'SearchParams' + modifier] = '';
            scope[iterator + 'SearchValue' + modifier] = '';
            scope[iterator + 'SelectShow' + modifier] = false;   // show/hide the Select
            scope[iterator + 'HideSearchType' + modifier] = false;
            scope[iterator + 'InputDisable' + modifier] = false;
            scope[iterator + 'ExtraParms' + modifier] = '';
            
            scope[iterator + 'SearchPlaceholder' + modifier] = 
                (list.fields[scope[iterator + 'SearchField' + modifier]] &&
                    list.fields[scope[iterator + 'SearchField' + modifier]].searchPlaceholder) ?
                    list.fields[scope[iterator + 'SearchField' + modifier]].searchPlaceholder : 'Search';
            
            scope[iterator + 'InputDisable' + modifier] = 
                (list.fields[scope[iterator + 'SearchField' + modifier]] &&
                    list.fields[scope[iterator + 'SearchField' + modifier]].searchObject == 'all') ? true : false;

            var f = scope[iterator + 'SearchField' + modifier];
            if (list.fields[f]) {
                if ( list.fields[f].searchType && (list.fields[f].searchType == 'boolean' 
                     || list.fields[f].searchType == 'select') ) {
                    scope[iterator + 'SelectShow' + modifier] = true;
                    scope[iterator + 'SearchSelectOpts' + modifier] = list.fields[f].searchOptions;
                }
                if (list.fields[f].searchType && list.fields[f].searchType == 'int') {
                    scope[iterator + 'HideSearchType' + modifier] = true;   
                }
                if (list.fields[f].searchType && list.fields[f].searchType == 'gtzero') {
                    scope[iterator + 'InputHide' + modifier] = true;
                }
            }
            }

        for (var i=1; i <= 3; i++) {
            var modifier = (i == 1) ? '' : i;
            if ( $('#search-widget-container' + modifier) ) {
                setDefaults(i);
            }
        }
       
        // Functions to handle search widget changes
        scope.setSearchField = function(iterator, fld, label, widget) {
           
           var modifier = (widget == undefined || widget == 1) ? '' : widget;
           scope[iterator + 'SearchFieldLabel' + modifier] = label;
           scope[iterator + 'SearchField' + modifier] = fld;
           scope[iterator + 'SearchValue' + modifier] = '';
           scope[iterator + 'SelectShow' + modifier] = false;
           scope[iterator + 'HideSearchType' + modifier] = false;
           scope[iterator + 'InputHide' + modifier] = false;
           scope[iterator + 'SearchType' + modifier] = 'icontains';
           scope[iterator + 'SearchPlaceholder' + modifier] = (list.fields[fld].searchPlaceholder) ? list.fields[fld].searchPlaceholder : 'Search';
           scope[iterator + 'InputDisable' + modifier] = (list.fields[fld].searchObject == 'all') ? true : false;
           
           if (list.fields[fld].searchType && list.fields[fld].searchType == 'gtzero') {
              scope[iterator + "InputDisable" + modifier] = true;
           }
           else if (list.fields[fld].searchSingleValue){
              // Query a specific attribute for one specific value
              // searchSingleValue: true
              // searchType: 'boolean|int|etc.'
              // searchValue: < value to match for boolean use 'true'|'false' >
              scope[iterator + 'InputDisable' + modifier] = true;
              scope[iterator + "SearchValue" + modifier] = list.fields[fld].searchValue;
              // For boolean type, SearchValue must be an object
              if (list.fields[fld].searchType == 'boolean' && list.fields[fld].searchValue == 'true') {
                 scope[iterator + "SearchSelectValue" + modifier] = { value: 1 }; 
              }
              else if (list.fields[fld].searchType == 'boolean' && list.fields[fld].searchValue == 'false') {
                 scope[iterator + "SearchSelectValue" + modifier] = { value: 0 };
              }
              else {
                 scope[iterator + "SearchSelectValue" + modifier] = { value: list.fields[fld].searchValue };
              }
           }
           else if (list.fields[fld].searchType == 'in') {
              scope[iterator + "SearchType" + modifier] = 'in';
              scope[iterator + "SearchValue" + modifier] = list.fields[fld].searchValue;
              scope[iterator + "InputDisable" + modifier] = true;
           }
           else if (list.fields[fld].searchType && (list.fields[fld].searchType == 'boolean' 
                || list.fields[fld].searchType == 'select' || list.fields[fld].searchType == 'select_or')) {
              scope[iterator + 'SelectShow' + modifier] = true;
              scope[iterator + 'SearchSelectOpts' + modifier] = list.fields[fld].searchOptions;
           }
           else if (list.fields[fld].searchType && list.fields[fld].searchType == 'int') {
              scope[iterator + 'HideSearchType' + modifier] = true;   
           }
           else if (list.fields[fld].searchType && list.fields[fld].searchType == 'isnull') {
              scope[iterator + 'SearchType' + modifier] = 'isnull';
              scope[iterator + 'InputDisable' + modifier] = true;
              scope[iterator + 'SearchValue' + modifier] = 'true';
           }
           scope.search(iterator);
           }

        scope.resetSearch = function(iterator, widget) {
           // Respdond to click of reset button
           setDefaults(widget);
           // Force removal of search keys from the URL
           window.location = '/#' + $location.path();
           scope.search(iterator);
           }

        //scope.setSearchType = function(iterator, type, label) {
        //   scope[iterator + 'SearchTypeLabel'] = label; 
        //   scope[iterator + 'SearchType'] = type;
        //   scope.search(iterator);
        //   }


        if (scope.removeDoSearch) {
            scope.removeDoSearch();
        }
        scope.removeDoSearch = scope.$on('doSearch', function(e, iterator, page, load, spin) {
            //
            // Execute the search
            //
            scope[iterator + 'SearchSpin'] = (spin == undefined || spin == true) ? true : false;
            scope[iterator + 'Loading'] = (load == undefined || load == true) ? true : false;
            var url = defaultUrl;

            //finalize and execute the query
            scope[iterator + 'Page'] = (page) ? parseInt(page) - 1 : 0;
            if (/\/$/.test(url)) {
                url += '?' + scope[iterator + 'SearchParams'];
            }
            else {
                url += '&' + scope[iterator + 'SearchParams'];
            }
            url = url.replace(/\&\&/,'&');
            url += (scope[iterator + 'PageSize']) ? '&page_size=' + scope[iterator + 'PageSize'] : "";
            if (page) {
                url += '&page=' + page;
            }
            if (scope[iterator + 'ExtraParms']) {
                url += scope[iterator + 'ExtraParms'];
            }
            Refresh({ scope: scope, set: set, iterator: iterator, url: url });
            });

        
        if (scope.removePrepareSearch) {
            scope.removePrepareSearch();
        }
        scope.removePrepareSearch = scope.$on('prepareSearch', function(e, iterator, page, load, spin) {
            //
            // Start build the search key/value pairs. This will process the first search widget, if the
            // selected field is an object type (used on activity stream).
            //
            scope[iterator + 'HoldInput'] = true;
            scope[iterator + 'SearchParams'] = '';
            if (list.fields[scope[iterator + 'SearchField']].searchObject &&
                 list.fields[scope[iterator + 'SearchField']].searchObject !== 'all') { 
                //This is specifically for activity stream. We need to identify which type of object is being searched
                //and then provide a list of PK values corresponding to the list of objects the user is interested in.
                var objs = list.fields[scope[iterator + 'SearchField']].searchObject;
                var o = (objs == 'inventories') ? 'inventory' : objs.replace(/s$/,'');
                scope[iterator + 'SearchParams'] = 'or__object1=' + o + '&or__object2=' + o;
                if (scope[iterator + 'SearchValue']) {
                   var objUrl = GetBasePath('base') + objs + '/?name__icontains=' + scope[iterator + 'SearchValue'];
                   Rest.setUrl(objUrl);
                   Rest.get()
                       .success( function(data, status, headers, config) {
                           var list='';
                           for (var i=0; i < data.results.length; i++) {
                               list += "," + data.results[i].id;
                           }
                           list = list.replace(/^\,/,'');
                           if (!Empty(list)) {
                               scope[iterator + 'SearchParams'] += '&or__object1_id__in=' + list + '&or__object2_id__in=' + list;
                           }
                           //scope[iterator + 'SearchParams'] += (sort_order) ? '&order_by=' + escape(sort_order) : "";
                           scope.$emit('prepareSearch2', iterator, page, load, spin, 2);
                           })
                       .error( function(data, status, headers, config) {
                            ProcessErrors(scope, data, status, null,
                                { hdr: 'Error!', msg: 'Retrieving list of ' + obj + ' where name contains: ' + scope[iterator + 'SearchValue'] +
                                ' GET returned status: ' + status });
                           });
                }
                else {
                    scope.$emit('prepareSearch2', iterator, page, load, spin, 2);  
                }
            }
            else {
                scope.$emit('prepareSearch2', iterator, page, load, spin, 1);
            }
            });
        
        if (scope.removePrepareSearch2) {
            scope.removePrepareSearch2();
        }
        scope.removePrepareSearch2 = scope.$on('prepareSearch2', function(e, iterator, page, load, spin, startingWidget) {  
            // Continue building the search by examining the remaining search widgets. If we're looking at activity_stream,
            // there's more than one.
            for (var i=startingWidget; i <= 3; i++) {
                var modifier = (i == 1) ? '' : i;
                scope[iterator + 'HoldInput' + modifier] = true; 
                if ( $('#search-widget-container' + modifier) ) {
                    // if the search widget exists, add its parameters to the query
                    if ( (!scope[iterator + 'SelectShow' + modifier] && !Empty(scope[iterator + 'SearchValue' + modifier])) ||
                           (scope[iterator + 'SelectShow' + modifier] && scope[iterator + 'SearchSelectValue' + modifier]) || 
                           (list.fields[scope[iterator + 'SearchField' + modifier]] && 
                            list.fields[scope[iterator + 'SearchField' + modifier]].searchType == 'gtzero') ) {
                        if (list.fields[scope[iterator + 'SearchField' + modifier]].searchField) {
                            scope[iterator + 'SearchParams'] = list.fields[scope[iterator + 'SearchField' + modifier]].searchField + '__'; 
                        }
                        else if (list.fields[scope[iterator + 'SearchField' + modifier]].sourceModel) {
                            // handle fields whose source is a related model e.g. inventories.organization
                            scope[iterator + 'SearchParams'] = list.fields[scope[iterator + 'SearchField' + modifier]].sourceModel + '__' + 
                            list.fields[scope[iterator + 'SearchField' + modifier]].sourceField + '__';
                        }
                        else if ( (list.fields[scope[iterator + 'SearchField' + modifier]].searchType == 'select') && 
                                  (scope[iterator + 'SearchSelectValue' + modifier].value == '' || 
                                      scope[iterator + 'SearchSelectValue' + modifier].value == null) ) {
                            scope[iterator + 'SearchParams'] = scope[iterator + 'SearchField' + modifier];
                        }
                        else {
                            scope[iterator + 'SearchParams'] = scope[iterator + 'SearchField' + modifier] + '__'; 
                        }
                        
                        if ( list.fields[scope[iterator + 'SearchField' + modifier]].searchType && 
                             (list.fields[scope[iterator + 'SearchField' + modifier]].searchType == 'int' || 
                              list.fields[scope[iterator + 'SearchField' + modifier]].searchType == 'boolean' ) ) {
                            scope[iterator + 'SearchParams'] += 'int=';  
                        }
                        else if ( list.fields[scope[iterator + 'SearchField' + modifier]].searchType && 
                                  list.fields[scope[iterator + 'SearchField' + modifier]].searchType == 'gtzero' ) {
                            scope[iterator + 'SearchParams'] += 'gt=0'; 
                        }
                        else if ( (list.fields[scope[iterator + 'SearchField' + modifier]].searchType == 'select') && 
                                  (scope[iterator + 'SearchSelectValue' + modifier].value == '' || 
                                      scope[iterator + 'SearchSelectValue' + modifier].value == null) ) {
                            scope[iterator + 'SearchParams'] += 'iexact=';
                        }
                        else if ( (list.fields[scope[iterator + 'SearchField' + modifier]].searchType && 
                                  (list.fields[scope[iterator + 'SearchField' + modifier]].searchType == 'or')) ) {
                            scope[iterator + 'SearchParams'] = ''; //start over
                            var val = scope[iterator + 'SearchValue' + modifier];
                            for (var k=0; k < list.fields[scope[iterator + 'SearchField' + modifier]].searchFields.length; k++) {
                                scope[iterator + 'SearchParams'] += '&or__' +
                                    list.fields[scope[iterator + 'SearchField' + modifier]].searchFields[k] +
                                    '__icontains=' + escape(val); 
                            }
                            scope[iterator + 'SearchParams'].replace(/^\&/,'');     
                        }
                        else {
                            scope[iterator + 'SearchParams'] += scope[iterator + 'SearchType' + modifier] + '='; 
                        }             
                        
                        if ( list.fields[scope[iterator + 'SearchField' + modifier]].searchType && 
                             (list.fields[scope[iterator + 'SearchField' + modifier]].searchType == 'boolean' 
                                 || list.fields[scope[iterator + 'SearchField' + modifier]].searchType == 'select') ) { 
                            scope[iterator + 'SearchParams'] += scope[iterator + 'SearchSelectValue' + modifier].value;
                        }
                        else {
                            if ( (!list.fields[scope[iterator + 'SearchField' + modifier]].searchType) ||
                                (list.fields[scope[iterator + 'SearchField' + modifier]].searchType && 
                                    list.fields[scope[iterator + 'SearchField' + modifier]].searchType !== 'or') ) {
                                scope[iterator + 'SearchParams'] += escape(scope[iterator + 'SearchValue' + modifier]);
                            }
                        }
                    }
                }
            }

            if ( (iterator == 'inventory' && scope.inventoryFailureFilter) ||
                (iterator == 'host' && scope.hostFailureFilter) ) {
                //Things that bypass the search widget. Should go back and add a second widget possibly on
                //inventory pages and eliminate this
                scope[iterator + 'SearchParams'] += '&has_active_failures=true';
            }
            
            if (sort_order) {
                scope[iterator + 'SearchParams'] += (scope[iterator + 'SearchParams']) ? '&' : '';
                scope[iterator + 'SearchParams'] += 'order_by=' + escape(sort_order);
            }

            scope.$emit('doSearch', iterator, page, load, spin);
        });

        scope.startSearch = function(iterator) {
           //Called on each keydown event for seachValue field. Using a timer
           //to prevent executing a search until user is finished typing. 
           if (scope.searchTimer) {
               $timeout.cancel(scope.searchTimer);
           }
           scope.searchTimer = $timeout(
               function() {
                   scope.$emit('prepareSearch', iterator);
                   } 
               , 1000);
           }

        scope.search = function(iterator, page, load, spin) {
           // Called to initiate a searh. 
           // Page is optional. Added to accomodate back function on Job Events detail. 
           // Spin optional -set to false if spin not desired.
           // Load optional -set to false if loading message not desired
           scope.$emit('prepareSearch', iterator, page, load, spin); 
           }

        
        scope.sort = function(fld) {
            // reset sort icons back to 'icon-sort' on all columns
            // except the one clicked
            $('.list-header').each(function(index) {
                if ($(this).attr('id') != fld + '-header') {
                   var icon = $(this).find('i');
                   icon.attr('class','icon-sort');
                }
                });
 
            // Toggle the icon for the clicked column
            // and set the sort direction  
            var icon = $('#' + fld + '-header i');
            var direction = '';
            if (icon.hasClass('icon-sort')) {
               icon.removeClass('icon-sort');
               icon.addClass('icon-sort-up');
            }
            else if (icon.hasClass('icon-sort-up')) {
               icon.removeClass('icon-sort-up');
               icon.addClass('icon-sort-down');
               direction = '-';
            }
            else if (icon.hasClass('icon-sort-down')) {
               icon.removeClass('icon-sort-down');
               icon.addClass('icon-sort-up');
            }

            // Set the sorder order value and call the API to refresh the list with the new order
            if (list.fields[fld].searchField) {
               sort_order = direction + list.fields[fld].searchField;
            }
            else if (list.fields[fld].sortField) {
               sort_order = direction + list.fields[fld].sortField;
            }
            else {
               if (list.fields[fld].sourceModel) {
                  sort_order = direction + list.fields[fld].sourceModel + '__' + list.fields[fld].sourceField;
               }
               else {
                  sort_order = direction + fld; 
               }
            }
            scope.search(list.iterator);
            }

        }
        }]);
