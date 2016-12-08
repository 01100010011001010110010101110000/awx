/*************************************************
 * Copyright (c) 2016 Ansible, Inc.
 *
 * All Rights Reserved
 *************************************************/

export default ['$scope', 'WorkflowService', 'generateList', 'TemplateList', 'ProjectList',
    'GetBasePath', 'Wait', 'TemplatesService', '$state',
    'ProcessErrors', 'InventorySourcesList', 'CreateSelect2', 'WorkflowMakerForm',
    'GenerateForm', 'InventoryList', 'CredentialList', '$q',
    function($scope, WorkflowService, GenerateList, TemplateList, ProjectList,
        GetBasePath, Wait, TemplatesService, $state,
        ProcessErrors, InventorySourcesList, CreateSelect2, WorkflowMakerForm,
        GenerateForm, InventoryList, CredentialList, $q) {

        let form = WorkflowMakerForm();

        $scope.workflowMakerFormConfig = {
            nodeMode: "idle",
            activeTab: "jobs",
            formIsValid: false
        };

        $scope.job_type_options = [{
            label: "Run",
            value: "run"
        }, {
            label: "Check",
            value: "check"
        }];

        $scope.edgeFlags = {
             conflict: false,
             typeRestriction: null,
             showTypeOptions: false
         };

        function init() {
            $scope.treeDataMaster = angular.copy($scope.treeData.data);
            $scope.showManualControls = false;
            $scope.$broadcast("refreshWorkflowChart");
        }

        function resetNodeForm() {
            $scope.workflowMakerFormConfig.nodeMode = "idle";
            $scope.edgeFlags.showTypeOptions = false;
            delete $scope.selectedTemplate;
            delete $scope.workflow_job_templates;
            delete $scope.workflow_projects;
            delete $scope.workflow_inventory_sources;
            delete $scope.placeholderNode;
            delete $scope.betweenTwoNodes;
            $scope.nodeBeingEdited = null;
            $scope.edgeFlags.typeRestriction = null;
            $scope.workflowMakerFormConfig.activeTab = "jobs";
        }

        $scope.lookUpInventory = function(){
            $state.go('.inventory');
        };

        $scope.lookUpCredential = function(){
            $state.go('.credential');
        };

        $scope.closeWorkflowMaker = function() {
            // Revert the data to the master which was created when the dialog was opened
            $scope.treeData.data = angular.copy($scope.treeDataMaster);
            $scope.closeDialog();
        };

        $scope.saveWorkflowMaker = function() {
            $scope.closeDialog();
        };

        /* ADD NODE FUNCTIONS */

        $scope.startAddNode = function(parent, betweenTwoNodes) {

            if ($scope.placeholderNode || $scope.nodeBeingEdited) {
                $scope.cancelNodeForm();
            }

            $scope.workflowMakerFormConfig.nodeMode = "add";
            $scope.addParent = parent;
            $scope.betweenTwoNodes = betweenTwoNodes;

            $scope.placeholderNode = WorkflowService.addPlaceholderNode({
                parent: parent,
                betweenTwoNodes: betweenTwoNodes,
                tree: $scope.treeData.data,
                id: $scope.treeData.nextIndex
            });

            $scope.treeData.nextIndex++;

            let siblingConnectionTypes = WorkflowService.getSiblingConnectionTypes({
                tree: $scope.treeData.data,
                parentId: betweenTwoNodes ? parent.source.id : parent.id,
                childId: $scope.placeholderNode.id
            });

            // Set the default to success
            let edgeType = "success";

            if (parent && ((betweenTwoNodes && parent.source.isStartNode) || (!betweenTwoNodes && parent.isStartNode))) {
                // We don't want to give the user the option to select
                // a type as this node will always be executed
                edgeType = "always";
                $scope.edgeFlags.showTypeOptions = false;
            } else {
                if ((_.includes(siblingConnectionTypes, "success") || _.includes(siblingConnectionTypes, "failure")) && _.includes(siblingConnectionTypes, "always")) {
                    // This is a conflicted scenario but we'll just let the user keep building - they will have to remediate before saving
                    $scope.edgeFlags.typeRestriction = null;
                } else if (_.includes(siblingConnectionTypes, "success") || _.includes(siblingConnectionTypes, "failure")) {
                    $scope.edgeFlags.typeRestriction = "successFailure";
                    edgeType = "success";
                } else if (_.includes(siblingConnectionTypes, "always")) {
                    $scope.edgeFlags.typeRestriction = "always";
                    edgeType = "always";
                } else {
                    $scope.edgeFlags.typeRestriction = null;
                }

                $scope.edgeFlags.showTypeOptions = true;
            }

            // Reset the edgeConflict flag
            resetEdgeConflict();

            $scope.$broadcast("setEdgeType", edgeType);
            $scope.$broadcast("refreshWorkflowChart");

        };

        $scope.confirmNodeForm = function(formValues) {
            if ($scope.workflowMakerFormConfig.nodeMode === "add") {
                if ($scope.selectedTemplate && formValues.edgeType) {

                    $scope.placeholderNode.unifiedJobTemplate = $scope.selectedTemplate;
                    $scope.placeholderNode.edgeType = formValues.edgeType;
                    if ($scope.placeholderNode.unifiedJobTemplate.type === 'job_template') {
                        $scope.placeholderNode.promptValues = {
                            credential: {
                                id: formValues.credential,
                                name: formValues.credential_name
                            },
                            inventory: {
                                id: formValues.inventory,
                                name: formValues.inventory_name
                            },
                            limit: formValues.limit,
                            job_type: formValues.job_type && formValues.job_type.value ? formValues.job_type.value : null,
                            job_tags: formValues.job_tags,
                            skip_tags: formValues.skip_tags
                        };
                    }
                    $scope.placeholderNode.canEdit = true;

                    delete $scope.placeholderNode.placeholder;

                    resetNodeForm();

                    // Increment the total node counter
                    $scope.treeData.data.totalNodes++;

                }
            } else if ($scope.workflowMakerFormConfig.nodeMode === "edit") {
                if ($scope.selectedTemplate && formValues.edgeType) {
                    $scope.nodeBeingEdited.unifiedJobTemplate = $scope.selectedTemplate;
                    $scope.nodeBeingEdited.edgeType = formValues.edgeType;

                    if ($scope.nodeBeingEdited.unifiedJobTemplate.type === 'job_template') {
                        $scope.nodeBeingEdited.promptValues = {
                            credential: {
                                id: formValues.credential,
                                name: formValues.credential_name
                            },
                            inventory: {
                                id: formValues.inventory,
                                name: formValues.inventory_name
                            },
                            limit: formValues.limit,
                            job_type: formValues.job_type && formValues.job_type.value ? formValues.job_type.value : null,
                            job_tags: formValues.job_tags,
                            skip_tags: formValues.skip_tags
                        };
                    }

                    $scope.nodeBeingEdited.isActiveEdit = false;

                    $scope.nodeBeingEdited.edited = true;

                    resetNodeForm();
                }
            }

            // Reset the edgeConflict flag
            resetEdgeConflict();

            $scope.$broadcast("refreshWorkflowChart");
        };

        $scope.cancelNodeForm = function() {
            if ($scope.workflowMakerFormConfig.nodeMode === "add") {
                // Remove the placeholder node from the tree
                WorkflowService.removeNodeFromTree({
                    tree: $scope.treeData.data,
                    nodeToBeDeleted: $scope.placeholderNode
                });
            } else if ($scope.workflowMakerFormConfig.nodeMode === "edit") {
                $scope.nodeBeingEdited.isActiveEdit = false;
            }

            // Reset the edgeConflict flag
            resetEdgeConflict();

            // Reset the form
            resetNodeForm();

            $scope.$broadcast("refreshWorkflowChart");
        };

        /* EDIT NODE FUNCTIONS */

        $scope.startEditNode = function(nodeToEdit) {

            if (!$scope.nodeBeingEdited || ($scope.nodeBeingEdited && $scope.nodeBeingEdited.id !== nodeToEdit.id)) {
                if ($scope.placeholderNode || $scope.nodeBeingEdited) {
                    $scope.cancelNodeForm();

                    // Refresh this object as the parent has changed
                    nodeToEdit = WorkflowService.searchTree({
                        element: $scope.treeData.data,
                        matchingId: nodeToEdit.id
                    });
                }

                $scope.workflowMakerFormConfig.nodeMode = "edit";

                let parent = WorkflowService.searchTree({
                    element: $scope.treeData.data,
                    matchingId: nodeToEdit.parent.id
                });

                $scope.nodeBeingEdited = WorkflowService.searchTree({
                    element: parent,
                    matchingId: nodeToEdit.id
                });

                $scope.nodeBeingEdited.isActiveEdit = true;

                let finishConfiguringEdit = function() {

                    let formValues = {};

                    if($scope.nodeBeingEdited.unifiedJobTemplate){
                        // build any prompt values
                        if ($scope.nodeBeingEdited.unifiedJobTemplate.ask_credential_on_launch) {
                            if ($scope.nodeBeingEdited.promptValues && $scope.nodeBeingEdited.promptValues.credential) {
                                formValues.credential_name = $scope.nodeBeingEdited.promptValues.credential.name;
                                formValues.credential = $scope.nodeBeingEdited.promptValues.credential.id;
                            } else if ($scope.nodeBeingEdited.unifiedJobTemplate.summary_fields.credential) {
                                formValues.credential_name = $scope.nodeBeingEdited.unifiedJobTemplate.summary_fields.credential.name ? $scope.nodeBeingEdited.unifiedJobTemplate.summary_fields.credential.name : null;
                                formValues.credential = $scope.nodeBeingEdited.unifiedJobTemplate.summary_fields.credential.id ? $scope.nodeBeingEdited.unifiedJobTemplate.summary_fields.credential.id : null;
                            } else {
                                formValues.credential_name = null;
                                formValues.credential = null;
                            }
                        }

                        if ($scope.nodeBeingEdited.unifiedJobTemplate.ask_inventory_on_launch) {
                            if ($scope.nodeBeingEdited.promptValues && $scope.nodeBeingEdited.promptValues.inventory) {
                                formValues.inventory_name = $scope.nodeBeingEdited.promptValues.inventory.name;
                                formValues.inventory = $scope.nodeBeingEdited.promptValues.inventory.id;
                            } else if ($scope.nodeBeingEdited.unifiedJobTemplate.summary_fields.inventory) {
                                formValues.inventory_name = $scope.nodeBeingEdited.unifiedJobTemplate.summary_fields.inventory.name ? $scope.nodeBeingEdited.unifiedJobTemplate.summary_fields.inventory.name : null;
                                formValues.inventory = $scope.nodeBeingEdited.unifiedJobTemplate.summary_fields.inventory.id ? $scope.nodeBeingEdited.unifiedJobTemplate.summary_fields.inventory.id : null;
                            } else {
                                formValues.inventory_name = null;
                                formValues.inventory = null;
                            }
                        }

                        if ($scope.nodeBeingEdited.unifiedJobTemplate.ask_job_type_on_launch) {
                            if ($scope.nodeBeingEdited.promptValues && $scope.nodeBeingEdited.promptValues.job_type) {
                                formValues.job_type = {
                                    value: $scope.nodeBeingEdited.promptValues.job_type
                                };
                            } else if ($scope.nodeBeingEdited.originalNodeObj.job_type) {
                                formValues.job_type = {
                                    value: $scope.nodeBeingEdited.originalNodeObj.job_type
                                };
                            } else if ($scope.nodeBeingEdited.unifiedJobTemplate.job_type) {
                                formValues.job_type = {
                                    value: $scope.nodeBeingEdited.unifiedJobTemplate.job_type
                                };
                            } else {
                                formValues.job_type = {
                                    value: null
                                };
                            }

                        }

                        if ($scope.nodeBeingEdited.unifiedJobTemplate.ask_limit_on_launch) {
                            if ($scope.nodeBeingEdited.promptValues && typeof $scope.nodeBeingEdited.promptValues.limit === 'string') {
                                formValues.limit = $scope.nodeBeingEdited.promptValues.limit;
                            } else if (typeof $scope.nodeBeingEdited.originalNodeObj.limit === 'string') {
                                formValues.limit = $scope.nodeBeingEdited.originalNodeObj.limit;
                            } else if (typeof $scope.nodeBeingEdited.unifiedJobTemplate.limit === 'string') {
                                formValues.limit = $scope.nodeBeingEdited.unifiedJobTemplate.limit;
                            } else {
                                formValues.limit = null;
                            }
                        }
                        if ($scope.nodeBeingEdited.unifiedJobTemplate.ask_skip_tags_on_launch) {
                            if ($scope.nodeBeingEdited.promptValues && typeof $scope.nodeBeingEdited.promptValues.skip_tags === 'string') {
                                formValues.skip_tags = $scope.nodeBeingEdited.promptValues.skip_tags;
                            } else if (typeof $scope.nodeBeingEdited.originalNodeObj.skip_tags === 'string') {
                                formValues.skip_tags = $scope.nodeBeingEdited.originalNodeObj.skip_tags;
                            } else if (typeof $scope.nodeBeingEdited.unifiedJobTemplate.skip_tags === 'string') {
                                formValues.skip_tags = $scope.nodeBeingEdited.unifiedJobTemplate.skip_tags;
                            } else {
                                formValues.skip_tags = null;
                            }
                        }
                        if ($scope.nodeBeingEdited.unifiedJobTemplate.ask_tags_on_launch) {
                            if ($scope.nodeBeingEdited.promptValues && typeof $scope.nodeBeingEdited.promptValues.job_tags === 'string') {
                                formValues.job_tags = $scope.nodeBeingEdited.promptValues.job_tags;
                            } else if (typeof $scope.nodeBeingEdited.originalNodeObj.job_tags === 'string') {
                                formValues.job_tags = $scope.nodeBeingEdited.originalNodeObj.job_tags;
                            } else if (typeof $scope.nodeBeingEdited.unifiedJobTemplate.job_tags === 'string') {
                                formValues.job_tags = $scope.nodeBeingEdited.unifiedJobTemplate.job_tags;
                            } else {
                                formValues.job_tags = null;
                            }
                        }

                        if ($scope.nodeBeingEdited.unifiedJobTemplate.type === "job_template") {
                            $scope.workflowMakerFormConfig.activeTab = "jobs";
                        }

                        $scope.selectedTemplate = $scope.nodeBeingEdited.unifiedJobTemplate;

                        switch ($scope.nodeBeingEdited.unifiedJobTemplate.type) {
                            case "job_template":
                                $scope.workflowMakerFormConfig.activeTab = "jobs";
                                break;
                            case "project":
                                $scope.workflowMakerFormConfig.activeTab = "project_sync";
                                break;
                            case "inventory_source":
                                $scope.workflowMakerFormConfig.activeTab = "inventory_sync";
                                break;
                        }
                    }

                    let siblingConnectionTypes = WorkflowService.getSiblingConnectionTypes({
                         tree: $scope.treeData.data,
                         parentId: parent.id,
                         childId: nodeToEdit.id
                     });

                     if (parent && parent.isStartNode) {
                         // We don't want to give the user the option to select
                         // a type as this node will always be executed
                         $scope.edgeFlags.showTypeOptions = false;
                     } else {
                         if ((_.includes(siblingConnectionTypes, "success") || _.includes(siblingConnectionTypes, "failure")) && _.includes(siblingConnectionTypes, "always")) {
                             // This is a conflicted scenario but we'll just let the user keep building - they will have to remediate before saving
                             $scope.edgeFlags.typeRestriction = null;
                         } else if (_.includes(siblingConnectionTypes, "success") || _.includes(siblingConnectionTypes, "failure") && (nodeToEdit.edgeType === "success" || nodeToEdit.edgeType === "failure")) {
                             $scope.edgeFlags.typeRestriction = "successFailure";
                         } else if (_.includes(siblingConnectionTypes, "always") && nodeToEdit.edgeType === "always") {
                             $scope.edgeFlags.typeRestriction = "always";
                         } else {
                             $scope.edgeFlags.typeRestriction = null;
                         }

                         $scope.edgeFlags.showTypeOptions = true;
                     }

                    $scope.$broadcast('setEdgeType', $scope.nodeBeingEdited.edgeType);

                    $scope.$broadcast('templateSelected', {
                        presetValues: formValues,
                        activeTab: $scope.workflowMakerFormConfig.activeTab
                    });

                    $scope.$broadcast("refreshWorkflowChart");
                };

                // Determine whether or not we need to go out and GET this nodes unified job template
                // in order to determine whether or not prompt fields are needed

                if (!$scope.nodeBeingEdited.isNew && !$scope.nodeBeingEdited.edited && $scope.nodeBeingEdited.unifiedJobTemplate && $scope.nodeBeingEdited.unifiedJobTemplate.unified_job_type && $scope.nodeBeingEdited.unifiedJobTemplate.unified_job_type === 'job') {
                    // This is a node that we got back from the api with an incomplete
                    // unified job template so we're going to pull down the whole object

                    TemplatesService.getUnifiedJobTemplate($scope.nodeBeingEdited.unifiedJobTemplate.id)
                        .then(function(data) {

                            $scope.nodeBeingEdited.unifiedJobTemplate = _.clone(data.data.results[0]);

                            let defers = [];
                            let retrievingCredential = false;
                            let retrievingInventory = false;

                            if ($scope.nodeBeingEdited.unifiedJobTemplate.ask_credential_on_launch && $scope.nodeBeingEdited.originalNodeObj.credential) {
                                defers.push(TemplatesService.getCredential($scope.nodeBeingEdited.originalNodeObj.credential));
                                retrievingCredential = true;
                            }

                            if ($scope.nodeBeingEdited.unifiedJobTemplate.ask_inventory_on_launch && $scope.nodeBeingEdited.originalNodeObj.inventory) {
                                defers.push(TemplatesService.getInventory($scope.nodeBeingEdited.originalNodeObj.inventory));
                                retrievingInventory = true;
                            }

                            $q.all(defers)
                                .then(function(responses) {
                                    if (retrievingCredential) {
                                        $scope.nodeBeingEdited.promptValues.credential = {
                                            name: responses[0].data.name,
                                            id: responses[0].data.id
                                        };

                                        if (retrievingInventory) {
                                            $scope.nodeBeingEdited.promptValues.inventory = {
                                                name: responses[1].data.name,
                                                id: responses[1].data.id
                                            };
                                        }
                                    } else if (retrievingInventory) {
                                        $scope.nodeBeingEdited.promptValues.inventory = {
                                            name: responses[0].data.name,
                                            id: responses[0].data.id
                                        };
                                    }
                                    finishConfiguringEdit();
                                });


                        }, function(error) {
                            ProcessErrors($scope, error.data, error.status, form, {
                                hdr: 'Error!',
                                msg: 'Failed to get unified job template. GET returned ' +
                                    'status: ' + error.status
                            });
                        });
                } else {
                    finishConfiguringEdit();
                }

            }

        };

        /* DELETE NODE FUNCTIONS */

        function resetDeleteNode() {
            $scope.nodeToBeDeleted = null;
            $scope.deleteOverlayVisible = false;
        }

        $scope.startDeleteNode = function(nodeToDelete) {
            $scope.nodeToBeDeleted = nodeToDelete;
            $scope.deleteOverlayVisible = true;
        };

        $scope.cancelDeleteNode = function() {
            resetDeleteNode();
        };

        $scope.confirmDeleteNode = function() {
            if ($scope.nodeToBeDeleted) {

                // TODO: turn this into a promise so that we can handle errors

                WorkflowService.removeNodeFromTree({
                    tree: $scope.treeData.data,
                    nodeToBeDeleted: $scope.nodeToBeDeleted
                });

                if ($scope.nodeToBeDeleted.isNew !== true) {
                    $scope.treeData.data.deletedNodes.push($scope.nodeToBeDeleted.nodeId);
                }

                if ($scope.nodeToBeDeleted.isActiveEdit) {
                    resetNodeForm();
                }

                // Reset the edgeConflict flag
                resetEdgeConflict();

                resetDeleteNode();

                $scope.$broadcast("refreshWorkflowChart");

                $scope.treeData.data.totalNodes--;
            }

        };

        $scope.toggleFormTab = function(tab) {
            if ($scope.workflowMakerFormConfig.activeTab !== tab) {
                $scope.workflowMakerFormConfig.activeTab = tab;
            }
        };

        $scope.templateSelected = function(selectedTemplate) {

            $scope.selectedTemplate = angular.copy(selectedTemplate);

            let formValues = {};

            if ($scope.selectedTemplate.ask_credential_on_launch) {
                if ($scope.selectedTemplate.summary_fields.credential) {
                    formValues.credential_name = $scope.selectedTemplate.summary_fields.credential.name ? $scope.selectedTemplate.summary_fields.credential.name : null;
                    formValues.credential = $scope.selectedTemplate.summary_fields.credential.id ? $scope.selectedTemplate.summary_fields.credential.id : null;
                } else {
                    formValues.credential_name = null;
                    formValues.credential = null;
                }
            }

            if ($scope.selectedTemplate.ask_inventory_on_launch) {
                if ($scope.selectedTemplate.summary_fields.inventory) {
                    formValues.inventory_name = $scope.selectedTemplate.summary_fields.inventory.name ? $scope.selectedTemplate.summary_fields.inventory.name : null;
                    formValues.inventory = $scope.selectedTemplate.summary_fields.inventory.id ? $scope.selectedTemplate.summary_fields.inventory.id : null;
                } else {
                    formValues.inventory_name = null;
                    formValues.inventory = null;
                }
            }

            if ($scope.selectedTemplate.ask_job_type_on_launch) {
                formValues.job_type = {
                    value: $scope.selectedTemplate.job_type ? $scope.selectedTemplate.job_type : null
                };

                // The default needs to be in place before we can select2-ify the dropdown
                CreateSelect2({
                    element: '#workflow_maker_job_type',
                    multiple: false
                });
            }

            if ($scope.selectedTemplate.ask_limit_on_launch) {
                formValues.limit = $scope.selectedTemplate.limit ? $scope.selectedTemplate.limit : null;
            }

            if ($scope.selectedTemplate.ask_skip_tags_on_launch) {
                formValues.skip_tags = $scope.selectedTemplate.skip_tags ? $scope.selectedTemplate.skip_tags : null;
            }

            if ($scope.selectedTemplate.ask_tags_on_launch) {
                formValues.job_tags = $scope.selectedTemplate.job_tags ? $scope.selectedTemplate.job_tags : null;
            }

            // Communicate down the scope chain to our children that a template has been selected.  This
            // will handle populating the form properly as well as clearing out any previously selected
            // templates in different lists
            $scope.$broadcast('templateSelected', {
                presetValues: formValues,
                activeTab: $scope.workflowMakerFormConfig.activeTab
            });
        };

        function resetEdgeConflict(){
            $scope.edgeFlags.conflict = false;

            WorkflowService.checkForEdgeConflicts({
                treeData: $scope.treeData.data,
                edgeFlags: $scope.edgeFlags
            });
        }
        
        $scope.toggleManualControls = function() {
            $scope.showManualControls = !$scope.showManualControls;
        };

        $scope.panChart = function(direction) {
            $scope.$broadcast('panWorkflowChart', {
                direction: direction
            });
        };

        $scope.zoomChart = function(zoom) {
            $scope.$broadcast('zoomWorkflowChart', {
                zoom: zoom
            });
        };

        $scope.resetChart = function() {
            $scope.$broadcast('resetWorkflowChart');
        };

        $scope.workflowZoomed = function(zoom) {
            $scope.$broadcast('workflowZoomed', {
                zoom: zoom
            });
        };

        init();

    }
];
