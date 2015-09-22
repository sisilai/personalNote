//挂单相关逻辑
define(function (require, exports, module) {
    var utils = require("mframework/static/package").utils;

    function initModel(model) {

    }

    function initControllers($scope) {
        // 构造开卡需要的模型
        $scope.buildNewCardModel = function (serviceBillInfo) {
            var paymentDetailList = serviceBillInfo.paymentDetailList;
            var empBonusList = serviceBillInfo.empBonusList;

            var newCardModelList = [];

            var memberSelected = $scope.memberSelected;

            var cardItemList = _.filter($scope.buyProductRecords, function (item) {
                return item.itemType === "card";
            });

            if (!$scope.isMemberSelected() || _.isEmpty(cardItemList)) {
                return newCardModelList;
            }

            _.each(cardItemList, function (item) {
                _.times(item.saleNum, function () {
                    newCardModelList.push(_buildOneNewCardModel(item));
                });
            });

            return newCardModelList;

            function _buildOneNewCardModel(cardItem) {
                var cardCate = $scope.cateId2CardCate[cardItem.id];

                var recharging = cardCate.baseInfo_type === "recharge";
                var isRecord = cardCate.baseInfo_type === "record";
                var isQuarter = (cardCate.baseInfo_type === "quarter");// 是否在保存年卡/季卡
                var newCardMoney = cardCate.baseInfo_minMoney || 0;
                if (cardItem.baseInfo_minMoney != undefined) {
                    newCardMoney = cardItem.baseInfo_minMoney;
                }

                var member = {};
                var memberCard = {};
                var rechargeBill = {};
                var cardBalanceList = [];
                var billBalanceList = [];
                var bonusRecords = [];
                var quarterPresentBill = {};
                var quarterRefPresents = [];
                var quarterPresents = [];

                _prepareMemberScore();
                _prepareMemberCard();
                _prepareRechargeBill();
                _prepareBalanceList();
                _prepareEmpBonus();
                _prepareQuarterPresents();

                return {
                    member: member,
                    memberCard: memberCard,
                    rechargeBill: rechargeBill,
                    cardBalanceList: cardBalanceList,
                    billBalanceList: billBalanceList,
                    bonusRecords: bonusRecords,
                    quarterPresentBill: quarterPresentBill,
                    quarterRefPresents: quarterRefPresents,
                    quarterPresents: quarterPresents
                };

                function _prepareMemberScore() {
                    member.id = memberSelected.id;
                    member.currentScore = memberSelected.currentScore || 0;

                    var activeCardPresentScore = cardCate.activeCardPresentScore || 0;
                    if (activeCardPresentScore === 0) {
                        return;
                    }

                    var newCardPresentScore = Math.abs((newCardMoney / activeCardPresentScore) || 0);

                    member.currentScore += newCardPresentScore;
                }

                function _prepareMemberCard() {
                    memberCard.valid = cardCate.cardValid;
                    if (cardItem.cardNo) {
                        memberCard.cardNo = cardItem.cardNo;
                    }
                    else {
                        memberCard.cardNo = "";
                    }
                    memberCard.memberId = memberSelected.id;
                    memberCard.cateType = cardCate.baseInfo_type;
                    memberCard.cardName = cardCate.name;
                    memberCard.cateId = cardCate.id;
                    memberCard.noPrefix = cardCate.cardNoGenRule_cardNoPrefix || "";

                    _calculateMoney();// 计算余额，赠送金额
                    _rechargeCardPay(); // 买卡时被卡支付的金额信息

                    function _calculateMoney() {
                        if (recharging) {
                            memberCard.presentMoney = utils.toDecimalDigit(cardCate.activeCardPresentMoney) || 0;
                            memberCard.balance = newCardMoney + memberCard.presentMoney;
                        }
                        else if (isRecord) {
                            memberCard.presentMoney = 0;
                            memberCard.balance = newCardMoney;
                            memberCard.recordAvgPrice = (newCardMoney / cardCate.totalTimes) || 0;
                            memberCard.timesLimit = cardCate.totalTimes;
                        }
                        else {
                            memberCard.presentMoney = 0;
                            memberCard.balance = newCardMoney;
                            memberCard.timesLimit = cardCate.timesLimit;
                            memberCard.timesAvgPrice = utils.toDecimalDigit(newCardMoney / memberCard.timesLimit);
                        }
                    }

                    function _rechargeCardPay() {
                        var cardPay = {};

                        var payment = _.find(paymentDetailList, function (item) {
                            return item.service_id === cardCate.id;
                        });

                        cardPay.cardId = payment.memberCard_id;
                        cardPay.payMoney = payment.card_pay_money;

                        memberCard.cardPayInfo = cardPay;
                    }
                }

                function _prepareRechargeBill() {
                    rechargeBill.member_id = memberSelected.id;
                    rechargeBill.memberNo = memberSelected.memberNo;
                    rechargeBill.type = 2;// 开卡
                    rechargeBill.amount = utils.toDecimalDigit(newCardMoney);
                    rechargeBill.memberCard_name = memberCard.cardNo;
                    rechargeBill.member_name = memberSelected.name;
                    rechargeBill.member_currentBalance = memberCard.balance;
                    rechargeBill.comment = memberCard.cardName + $.i18n.t("member.member_open_card");
                    rechargeBill.def_str1 = memberCard.cardName;
                    rechargeBill.storeNameSnapshot = $scope.storeInfo.name || "";

                    var payment = _.find(paymentDetailList, function (item) {
                        return item.service_id === cardCate.id;
                    });

                    rechargeBill.pay_bankAccount_money = utils.toDecimalDigit(payment.pay_bank / cardItem.saleNum);
                    rechargeBill.pay_cash = utils.toDecimalDigit(payment.pay_cash / cardItem.saleNum);

                    if (recharging) {
                        rechargeBill.presentMoney = memberCard.presentMoney;
                        rechargeBill.currentScore = member.currentScore;

                        var activeCardPresentScore = cardCate.activeCardPresentScore || 0;
                        if (activeCardPresentScore === 0) {
                            rechargeBill.presentScore = 0;
                            return;
                        }
                        rechargeBill.presentScore = Math.abs((newCardMoney / activeCardPresentScore) || 0);
                    }
                }

                function _prepareBalanceList() {
                    // 充值卡不关联服务
                    if (recharging) {
                        return;
                    }

                    if (isRecord) {
                        _buildRecordBalance();
                    }
                    else {
                        _buildQuarterUsed();
                    }

                    function _buildRecordBalance() {
                        _.each(cardCate.cateServiceGrouped, function (item) {
                            _.each(item.services, function (oneService) {
                                var times = item.times;

                                cardBalanceList.push({
                                    groupName: "recordCardBalance",
                                    keyName: oneService.serviceId,
                                    value: times,
                                    bind_group: item.bind_group
                                });

                                billBalanceList.push({
                                    groupName: "billMemBalance",
                                    keyName: oneService.serviceId,
                                    value: times,
                                    bind_group: item.bind_group
                                });
                            });
                        });
                    }

                    function _buildQuarterUsed() {
                        _.each(cardCate.cateServiceGrouped, function (item) {
                            _.each(item.services, function (oneService) {
                                cardBalanceList.push({
                                    groupName: "quarterCardUsed",
                                    keyName: oneService.serviceId,
                                    value: 0,
                                    bind_group: item.bind_group
                                });
                            });
                        });
                    }
                }

                function _prepareEmpBonus() {
                    var empBonus = _.find(empBonusList, function (bonus) {
                        return bonus.project_id === cardItem.id;
                    });

                    if (_.isEmpty(empBonus)) {
                        return;
                    }

                    empBonus.type = 8; //开卡

                    bonusRecords.push(_.extend({}, empBonus));

                    empBonus.totalMoney = 0;
                    empBonus.cashMoney = 0;
                    empBonus.cardMoney = 0;

                    //将开卡流水中的employee_id和employee_name设置第一提成人
                    rechargeBill.employee_id = empBonus.employee_id || null;
                    rechargeBill.employee_name = empBonus.employee_name || null;
                }

                function _prepareQuarterPresents() {
                    if (isQuarter && !_.isEmpty(cardItem.presentServices)) {
                        //quarterPresentBill = {}, quarterRefPresents = [], quarterPresents = [];
                        _.each(cardItem.presentServices || [], function (item, index) {
                            quarterPresents.push({
                                serviceId: item.serviceId,
                                serviceName: item.serviceName,
                                value: item.times,
                                bind_group: index,
                                bonusMode: item.bonusMode,
                                bonusValue: item.bonusValue,
                                periodOfValidity: item.valid,
                                memberId: member.id
                                //create_date: nowMilli,
                                //dateTime: nowMilli
                            });
                            quarterRefPresents.push({
                                //memberCard_id:item.quarter_id,
                                //present_id: item.serviceId,
                                serviceId: item.serviceId
                                //date_time: nowMilli,
                                //create_date: nowMilli
                            });
                        });
                        quarterPresentBill.member_id = member.id;
                        quarterPresentBill.memberNo = memberSelected.memberNo;
                        quarterPresentBill.type = 7;//送服务
                        quarterPresentBill.amount = 0;
                        //quarterPresentBill.dateTime = nowMilli;
                        //quarterPresentBill.day = now.getDate();
                        //qurterPresentBill.weekDay = now.getDay();
                        //quarterPresentBill.month = now.getMonth() + 1;
                        quarterPresentBill.member_name = memberSelected.name;
                        //quarterPresentBill.create_date = nowMilli;
                        quarterPresentBill.pay_bankAccount_money = 0;
                        quarterPresentBill.pay_cash = 0;
                        quarterPresentBill.storeNameSnapshot = $scope.storeInfo.name || "";
                        var commentTemp = [];
                        _.each(quarterPresents, function (item) {
                            commentTemp.push(item.serviceName + " " + item.value + "次");
                        });
                        quarterPresentBill.comment = memberCard.cardName + "开卡赠送：" + commentTemp.join("，");
                    }
                }
            }
        };
    }

    exports.initModel = initModel;
    exports.initControllers = initControllers;
});
