//挂单相关逻辑
define(function (require, exports, module) {
    var utils = require("mframework/static/package").utils;
    var featureDataI = require("./checkout-dataI.js");

    function initModel(model) {
        model.pend_pendBill = {};
        model.pend_pendList = [];//挂单列表
        model.pend_pendShowList = [];
        model.pend_pendHiddenList = [];
    }

    function initControllers($scope) {
        //挂单确认
        $scope.pend_pendingOrderCommit = function () {
            if ($scope.pend_pendingOrderCommit.doing) {
                return;
            }
            $scope.pend_pendingOrderCommit.doing = true;

            var pendBill = {};
            var itemList = [];
            var oldBill = {};

            _prepareModel();

            var pendModel = {
                pendBill: pendBill,
                itemList: itemList,
                oldBill: oldBill
            };

            featureDataI.pendOrder(pendModel, function (error) {
                if (error) {
                    utils.showGlobalMsg(error.errorMsg || "挂单失败，请稍后再试");
                    utils.log("m-pos checkout.js pend_pendingOrderCommit.featureDataI.deletePend", error);
                    $scope.pend_pendingOrderCommit.doing = false;
                    return;
                }

                _refreshModel();
                $scope.clearOrder();

                setTimeout(function () {
                    $scope.initOrFreshOrderListIScroll(false);
                    $scope.digestScope();
                }, 100);

                $scope.pend_pendingOrderCommit.doing = false;
                utils.showGlobalSuccessMsg($.i18n.t("checkout.pend_success"));

                function _refreshModel() {
                    _.each($scope.pend_pendList, function (item, index) {
                        if (item.id === oldBill.id) {
                            $scope.pend_pendList.splice(index, 1);
                        }
                    });
                    $scope.pend_pendBill = {};
                    $scope.pend_pendList.splice(0, 0, pendBill);

                    $scope.pend_countPendShow();
                }
            });

            function _prepareModel() {
                var nowMilli = new Date().getTime();

                _prepareBill();
                _prepareItemList();
                _prepareOldBill();

                function _prepareBill() {
                    pendBill.amount = $scope.incomeStatus.paidMoney;
                    pendBill.dateTime = nowMilli;
                    pendBill.create_date = nowMilli;
                    pendBill.member_id = $scope.memberSelected.id || "";
                    pendBill.member_name = $scope.memberSelected.name || "";
                }

                function _prepareItemList() {
                    _.each($scope.buyProductRecords, function (item) {
                        var service = {};

                        service.project_id = item.id;
                        service.unitPrice = item.unitPrice;
                        service.saleNum = item.saleNum;
                        service.employee_id = item.serviceEmployee.id;
                        service.create_date = nowMilli;
                        itemList.push(service);
                    });

                    pendBill.itemList = itemList;
                }

                function _prepareOldBill() {
                    if (_.isEmpty($scope.pend_pendBill)) {
                        return;
                    }

                    oldBill.id = $scope.pend_pendBill.id;
                }
            }
        };

        $scope.pend_showPendEmployeeSelect = function () {
            $scope.view.dialogHrefStack = [];
            $scope.view.inPendProgress = true;

            if (_.isEmpty($scope.buyProductRecords)) {
                utils.showGlobalMsg("请选择服务人及消费项目");
                return;
            }

            $scope.pend_pendingOrderCommit();
        };

        $scope.pend_showEvaluationDialog = function () {
            _emptyMark();

            $scope.view.dialogHrefStack.push("#m-pos-checkout-pend-dialog");
            utils.openFancyBox("#m-pos-evaluation");
            $scope.digestScope();

            function _emptyMark() {
                $scope.view.evaluationList = [2, 4, 6, 8, 10];
                $scope.view.evaluation = 4;
                $scope.view.confirmPassword = "";
            }
        };

        //恢复单
        $scope.pend_resumePendingOrder = function (pendOrder) {
            $("#m-pos-hide-pend").hide();
            if ($scope.pend_resumePendingOrder.doing == true) {
                return;
            }
            $scope.pend_resumePendingOrder.doing = true;
            utils.showWaitTips("#m-pos-checkout-area", 24, "", "normal");
            $scope.clearOrder();

            setTimeout(function () {
                $scope.initOrFreshOrderListIScroll(true);
            }, 100);

            //填充pend_pendBill模型在结算时区分
            $scope.pend_pendBill = _.extend($scope.pend_pendBill, pendOrder);

            _resumeMemberInfo(function (error) {
                if (error) {
                    $scope.pend_resumePendingOrder.doing = false;
                    utils.hideWaitTips("#m-pos-checkout-area");
                    return;
                }

                _resumeItemList();
                $scope.digestScope();
                $scope.pend_resumePendingOrder.doing = false;
                utils.hideWaitTips("#m-pos-checkout-area");
            });

            function _resumeItemList() {
                $scope.buyProductRecords = [];

                var itemList = $scope.pend_pendBill.itemList;

                var itemListGroupByEmp = _.groupBy(itemList, function (item) {
                    return item.employee_id;
                });

                _.each(itemListGroupByEmp, function (itemList, employeeId) {
                    var serviceEmp = _.find($scope.employeeList, function (employee) {
                        return employee.id === employeeId;
                    });

                    if (_.isEmpty(serviceEmp) && _.isEmpty($scope.employeeList)) {
                        return;
                    }

                    if (_.isEmpty(serviceEmp)) {
                        serviceEmp = $scope.employeeList[0];
                    }

                    $scope.view.currentServiceEmpSelectedTemp = serviceEmp;
                    $scope.view.currentServiceEmpSelected = serviceEmp;

                    _.each(itemList, function (item) {
                        if (_.isEmpty($scope.productList[item.project_id])) {
                            var card = _.find($scope.allCardList, function (card) {
                                return card.id === item.project_id;
                            });

                            if (!_.isEmpty(card)) {
                                $scope.selectProduct(card);
                            }
                            return;
                        }
                        var product = _.clone($scope.productList[item.project_id]);
                        product.prices_salesPrice = item.unitPrice;
                        $scope.selectProduct(product, item.saleNum);
                    });
                });
            }

            function _resumeMemberInfo(callback) {
                if (!pendOrder.member_id) {
                    callback(null);
                    return;
                }

                $scope.view.memberSelected = {id: pendOrder.member_id};
                $scope.selMemberConfirm(callback);
            }
        };

        //切换隐藏的挂单项
        $scope.pend_showHiddenPend = function () {
            $("#m-pos-hide-pend").toggle();
        };

        //计算挂单的显示与隐藏
        $scope.pend_countPendShow = function () {
            //通过顶部宽度计算出大概显示多少项
            var count = 3;

            $scope.pend_pendShowList = $scope.pend_pendList.slice(0, count);
            if (count < $scope.pend_pendList.length) {
                $("#m-pos-more-pend").show();
                $scope.pend_pendHiddenList = $scope.pend_pendList.slice(count);
            }
            else {
                $("#m-pos-more-pend").hide();
                $("#m-pos-hide-pend").hide();
            }
            $scope.digestScope();
        };

        $scope.clearPendBill = function () {
            $scope.pend_pendBill = {};
        };
    }

    exports.initModel = initModel;
    exports.initControllers = initControllers;
});
