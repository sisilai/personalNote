//收银点结算的动作
define(function (require, exports, module) {
    var utils = require("mframework/static/package").utils;
    var featureDataI = require("./checkout-dataI.js");
    var ticketDao = require("m-dao/static/package").ticketDao;

    function initModel(model, callback) {
        model.failTicket = [];
    }

    function initControllers($scope) {
        //现金、或者充值卡、或者计次卡....
        $scope.normalCommit = function (billInfo, callback) {
            var serviceBill = billInfo.serviceBill;

            async.series([_fillId, _checkout], function (error) {
                if (error) {
                    callback(error);
                    return;
                }

                _checkoutSuccess();
                callback(null);
            });

            function _fillId(callback) {
                featureDataI.fillIdCode(billInfo, callback);
            }

            function _checkout(callback) {
                featureDataI.checkout(billInfo, callback);
            }

            function _checkoutSuccess() {
                _sendMsg();
                _printTicket();

                function _printTicket() {
                    printConsumeTicket(billInfo, function (error) {
                        if (error) {
                            utils.log("m-pos fragment-checkoutCommit.js commitWithMoney.printConsumeTicket", error);
                        }
                    });
                }

                function _sendMsg() {
                    if (!featureConf.canSendMsg || _.isEmpty($scope.msgSwitch)) {
                        return;
                    }

                    var isRechargeConsumeMsgOpen = ($scope.msgSwitch.consumeMsgSwitch == 1);
                    var isRecordConsumeMsgOpen = ($scope.msgSwitch.recordConsumeMsgSwitch == 1);
                    var isQuarterConsumeMsgOpen = ($scope.msgSwitch.quarterConsumeMsgSwitch == 1);


                    if (!isRechargeConsumeMsgOpen && !isRechargeConsumeMsgOpen && !isQuarterConsumeMsgOpen) {
                        return;
                    }

                    var msgList = [];
                    var billBalanceList = billInfo.billBalanceList;

                    if ($scope.isSingleCardMember() && !$scope.isTempMember()) {
                        _buildSingleCardMsg();
                    }

                    if ($scope.isMultiCardMember() && !$scope.isTempMember()) {
                        _buildMultiCardMsg();
                    }

                    _.each(msgList, function (item) {
                        $scope.sendMsg(item);
                    });


                    function _countSingleRecordBalance() {
                        var recordBalanceTimes = 0;

                        var serviceIdGroup = $scope.memberSelected.cards[0].serviceIdGroup;
                        var groupAdded = [];
                        _.each(billBalanceList, function (item) {
                            var group = serviceIdGroup[item.keyName];
                            if (!_.contains(groupAdded, group)) {
                                recordBalanceTimes += Number(item.value);
                                groupAdded.push(group);
                            }
                        });

                        return recordBalanceTimes;
                    }

                    function _buildSingleCardMsg() {
                        var msg = {};

                        msg.projectList = serviceBill.comment;
                        if (msg.projectList.length >= 60) {
                            msg.projectList = msg.projectList.substring(0, 55) + "...";
                        }
                        msg.phoneNumber = $scope.memberSelected.phoneMobile;
                        msg.enterpriseName = $scope.storeInfo.name;

                        if ($scope.isSingleRechargeCardMember()) {
                            if (!isRechargeConsumeMsgOpen) {
                                return;
                            }

                            msg.template_id = "template_12";
                            msg.totalMoney = parseFloat(serviceBill.befDisMoney).toFixed(1);
                            msg.afterDiscountMoney = parseFloat(serviceBill.amount).toFixed(1);
                            msg.balance = parseFloat(billBalanceList[0].value).toFixed(1);
                        }

                        if ($scope.isSingleRecordCardMember()) {
                            if (!isRecordConsumeMsgOpen) {
                                return;
                            }

                            msg.template_id = "template_9";
                            msg.costTimes = serviceBill.def_int1.toFixed(0);
                            var recordBalanceTimes = _countSingleRecordBalance();
                            msg.balance = parseFloat(recordBalanceTimes).toFixed(0);
                        }

                        if ($scope.isSingleQuarterCardMember()) {
                            if (!isQuarterConsumeMsgOpen) {
                                return;
                            }
                            msg.template_id = "template_15";
                            msg.costTimes = serviceBill.def_int3.toFixed(0);
                        }

                        msgList.push(msg);
                    }

                    function _buildMultiCardMsg() {
                        var cardPayItemList = _.filter($scope.buyProductRecords, function (item) {
                            return !_.isEmpty(_.find(item.payCardList, function (one) {
                                return !_.isEmpty(item.payCard) && one.payInfo.payType !== 'presentService';
                            }));
                        });

                        var cardPayGroup = {};
                        _.each($scope.buyProductRecords, function (item) {
                            _.each(item.payCardList, function (one) {
                                if (one.payInfo.payType === 'presentService') {
                                    return;
                                }

                                if (_.isEmpty(cardPayGroup[one.payCard.id])) {
                                    cardPayGroup[one.payCard.id] = [];
                                }

                                cardPayGroup[one.payCard.id].push(item);
                            });
                        });

                        _.each(cardPayGroup, function (value, key) {
                            var msgItem = {};
                            msgItem.phoneNumber = $scope.memberSelected.phoneMobile;
                            msgItem.enterpriseName = $scope.storeInfo.name;

                            var serviceNames = _.pluck(value, "name").join("，");
                            if (serviceNames.length >= 60) {
                                serviceNames = serviceNames.substring(0, 55) + "...";
                            }
                            msgItem.projectList = serviceNames;

                            var payCard = _.find($scope.memberSelected.cards, function (item) {
                                return item.id === key;
                            });

                            if ($scope.isRechargeCard(payCard)) {
                                if (!isRechargeConsumeMsgOpen) {
                                    return;
                                }

                                var totalMoney = 0, aftDiscountMoney = 0;
                                _.each(value, function (item) {
                                    totalMoney += item.money;

                                    var pay = _.find(item.payCardList, function (one) {
                                        return one.payCard.id === key;
                                    });

                                    if (!_.isEmpty(pay)) {
                                        aftDiscountMoney += pay.payInfo.cardPayMoney;
                                    }
                                });

                                msgItem.template_id = "template_12";
                                msgItem.totalMoney = parseFloat(totalMoney).toFixed(1);
                                msgItem.afterDiscountMoney = parseFloat(aftDiscountMoney).toFixed(1);

                                var balance = _.find(billBalanceList, function (item) {
                                    return item.memberCardId === key;
                                });

                                msgItem.balance = parseFloat(balance.value).toFixed(1);
                                msgList.push(msgItem);
                            }
                            else if ($scope.isRecordCard(payCard)) {
                                if (!isRecordConsumeMsgOpen) {
                                    return;
                                }

                                msgItem.template_id = "template_9";
                                var recordBalanceList = [];
                                _.each(billBalanceList, function (item) {
                                    if (item.memberCardId === key) {
                                        recordBalanceList.push(item);
                                    }
                                });

                                var totalTimes = 0;

                                var serviceIdGroup = payCard.serviceIdGroup;
                                var groupAdded = [];
                                _.each(recordBalanceList, function (item) {
                                    var group = serviceIdGroup[item.keyName];

                                    if (!_.contains(groupAdded, group)) {
                                        totalTimes += Number(item.value);
                                        groupAdded.push(group);
                                    }
                                });

                                msgItem.costTimes = serviceBill.def_int1.toFixed(0);
                                msgItem.balance = parseFloat(totalTimes).toFixed(0);
                                msgList.push(msgItem);
                            }
                            else if ($scope.isQuarterCard(payCard)) {
                                if (!isQuarterConsumeMsgOpen) {
                                    return;
                                }

                                msgItem.template_id = "template_15";
                                msgItem.costTimes = serviceBill.def_int3.toFixed(0);
                                msgList.push(msgItem);
                            }
                        });
                    }
                }
            }
        };

        //重新打印失败小票
        $scope.reprintCommit = function () {
            _printFailTicket(function (error) {
                if (error) {
                    utils.showGlobalMsg($.i18n.t("checkout.print_error"));
                    return;
                }
                utils.showGlobalSuccessMsg($.i18n.t("checkout.print_success"));
                $scope.modalDialogClose();
                $scope.emptyFailTicket();
            });

            //尝试重新打印失败小票
            function _printFailTicket(callback) {
                if (_.isEmpty($scope.failTicket)) {
                    callback(null);
                    return;
                }

                async.each($scope.failTicket, function (item, callback) {
                    utils.printTicket(item, function (error) {
                        if (error) {
                            callback(error);
                            return;
                        }
                        callback(null);
                    });
                }, function (error) {
                    callback(error);
                });
            }
        };

        //取消重新尝试
        $scope.cancelReprint = function () {
            $scope.modalDialogClose();
            $scope.emptyFailTicket();
        };

        //失败小票清空
        $scope.emptyFailTicket = function () {
            $scope.failTicket = [];
        };

        //新增失败小票
        $scope.addFailTicket = function (ticket) {
            $scope.failTicket.push(ticket);
        };

        //重新打印小票初始化
        $scope.reprintInit = function () {
            if (_.isEmpty($scope.failTicket)) {
                return;
            }

            utils.openFancyBox("#m-pos-checkout-reprint");
        };

        //打印小票
        function printConsumeTicket(billInfo, callback) {
            var ticketTemplate = _buildTicket();

            ticketDao.addTicket2Local(billInfo.serviceBill.id, ticketTemplate, function () {
            });

            //不打印收银小票
            if ($scope.ticketSwitch.checkoutTicketSwitch == 0) {
                callback(null);
                return;
            }

            $scope.emptyFailTicket();
            utils.printTicket(ticketTemplate, function (error) {
                if (error) {
                    $scope.addFailTicket(ticketTemplate);
                    callback(error);
                    return;
                }
                callback(null);
            });


            function _buildTicket() {
                var serviceBill = billInfo.serviceBill;
                var billItem = billInfo.projectList;
                var cardPaymentList = billInfo.cardPaymentList;
                var billBalanceList = billInfo.billBalanceList;

                var afterDiscountMoney = _buildAfterDiscountMoney();

                var ticketTemplate = {};

                ticketTemplate.ticket_type = 2;
                ticketTemplate.header = _buildTicketHead();
                ticketTemplate.body = _buildTicketConsumeItem();
                ticketTemplate.payment = _buildTotalAndPayment();
                ticketTemplate.preferentialMoney = "￥" + Number(serviceBill.befDisMoney - afterDiscountMoney + serviceBill.reduceMoney).toFixed(1);
                ticketTemplate.balanceList = _buildBalance();

                if ($scope.isSingleRechargeCardMember() || $scope.isMultiCardMember()) {
                    ticketTemplate.currentScore = Number(serviceBill.presentScore).toFixed(0);
                    ticketTemplate.totalScore = Number(serviceBill.currentScore).toFixed(0);
                }

                ticketTemplate.footer = {
                    address: $scope.storeInfo.address,
                    phone: $scope.storeInfo.phone
                };

                return ticketTemplate;

                function _buildTicketHead() {
                    var header = {};
                    header.store_name = $scope.storeInfo.name;
                    header.consume_no = serviceBill.billNo;
                    header.date = new Date().Format("yyyy-MM-dd hh:mm:ss");
                    if (serviceBill.memberNo) {
                        header.member_no = serviceBill.memberNo;
                    }
                    return header;
                }

                function _buildTicketConsumeItem() {
                    var consumeItem = [];
                    _.each(billItem, function (item) {
                        consumeItem.push({
                            name: item.project_name,
                            amount: item.saleNum,
                            sum: "￥" + Number(item.unitPrice * item.saleNum).toFixed(1)
                        });
                    });
                    return consumeItem;
                }

                function _buildTotalAndPayment() {
                    var paymentBody = {};

                    paymentBody.subTotal = "￥" + Number(serviceBill.befDisMoney).toFixed(1);
                    paymentBody.afterDiscountMoney = "￥" + Number(afterDiscountMoney).toFixed(1);
                    paymentBody.reduceMoney = "￥" + Number(serviceBill.reduceMoney).toFixed(1);
                    paymentBody.cardPayList = _preparePayList();

                    if (serviceBill.pay_cash) {
                        paymentBody.cashPay = "￥" + Number($scope.payStatus.cashPay).toFixed(1);
                        paymentBody.change = "￥" + Number($scope.payStatus.cashChange).toFixed(1);
                    }

                    if (serviceBill.pay_bankAccount_money) {
                        paymentBody.bankPay = "￥" + Number(serviceBill.pay_bankAccount_money).toFixed(1);
                    }


                    return paymentBody;

                    function _preparePayList() {
                        var cardPayList = [];

                        _.each(cardPaymentList, function (payment) {
                            var payWayDesc, payValue;
                            if (payment.keyName === "recharge") {
                                payWayDesc = payment.def_str1 + "扣卡";
                                payValue = "￥" + Number(payment.value).toFixed(1);
                            }
                            else if (payment.keyName === "record" || payment.keyName === "quarter" || payment.keyName === "present") {
                                payWayDesc = payment.def_str1 + "扣次";
                                payValue = Number(payment.value).toFixed(0) + "次";
                            }
                            else if (payment.keyName === "coupon") {
                                payWayDesc = payment.def_str1;
                                payValue = "￥" + Number(payment.value).toFixed(1);
                            }

                            cardPayList.push({
                                payWayDesc: payWayDesc,
                                payValue: payValue
                            })
                        });

                        return cardPayList;
                    }
                }

                function _buildAfterDiscountMoney() {
                    var afterDiscountMoney = 0;

                    if (!$scope.isMemberSelected() || $scope.isNoCardMember() || $scope.isSingleCardMember()) {
                        var noDiscountMoney = 0;
                        _.each($scope.buyProductRecords, function (item) {
                            if (item.noDiscount) {
                                noDiscountMoney += item.money;
                            }
                        });

                        //散客或者无卡单卡会员
                        afterDiscountMoney = (serviceBill.befDisMoney - noDiscountMoney) * serviceBill.discount / 10 + noDiscountMoney;
                    }
                    else {
                        //多卡会员
                        _.each($scope.buyProductRecords, function (item) {
                            if (_.isEmpty(item.payCardList)) {
                                afterDiscountMoney += item.money;
                                return;
                            }

                            _.each(item.payCardList, function (one) {
                                if (one.payInfo.payType === 'rechargeCard') {
                                    afterDiscountMoney += one.payInfo.cardPayMoney;
                                }
                                else if (one.payInfo.payType === 'recordCard') {
                                    afterDiscountMoney += one.payInfo.times2Money;
                                }
                            });
                        });

                        afterDiscountMoney += serviceBill.pay_cash + serviceBill.pay_bankAccount_money + serviceBill.reduceMoney;
                    }
                    return afterDiscountMoney;
                }

                function _buildBalance() {
                    var balanceList = [];

                    _.each(cardPaymentList, function (payment) {
                        var balance = {};
                        var oldTimes = 0;

                        var cardBalance = _.find(billBalanceList, function (balance) {
                            return payment.memberCardId === balance.memberCardId;
                        });

                        if (_.isEmpty(cardBalance)) {
                            return;
                        }

                        if (cardBalance.groupName === "rechargeBalanceSnapshot") {
                            //充值卡余额、从流水余额快照中取
                            balance.remainDesc = payment.def_str1 + "余额";
                            balance.remain = "￥" + Number(cardBalance.value).toFixed(1);
                        }
                        else if (cardBalance.groupName === "billMemBalance") {
                            var memberCard = _.find($scope.memberSelected.cards, function (card) {
                                return payment.memberCardId === card.id;
                            });

                            if (memberCard.cateType === "quarter") {
                                return;
                            }

                            oldTimes = memberCard.balance;

                            balance.remainDesc = payment.def_str1 + "余次";
                            balance.remain = Number(oldTimes - payment.value).toFixed(0) + "次";
                        }
                        else {
                            var presentS = _.find($scope.memberSelected.presents, function (present) {
                                return payment.memberCardId === present.sequenceId;
                            });

                            if (_.isEmpty(presentS)) {
                                return;
                            }

                            oldTimes = presentS.balance;

                            balance.remainDesc = payment.def_str1 + "余次";
                            balance.remain = Number(oldTimes - payment.value).toFixed(0) + "次";
                        }

                        balanceList.push(balance);
                    });

                    return balanceList;
                }
            }
        }
    }

    exports.initModel = initModel;
    exports.initControllers = initControllers;
});