//收银提成选择模块
define(function (require, exports) {

    var utils = require("mframework/static/package").utils; 			//全局公共函数
    var featureDataI = require("./checkout-dataI.js");
    var numKeyboard = require("mframework/static/package").numKeyboard;
    var memberDao = require("m-dao/static/package").memberDao;
    var ticketDao = require("m-dao/static/package").ticketDao;

    function initModel(model) {
        model.recordCardRecTimes = [1, 2];
    }

    function initControllers($scope) {
        //关闭会员选择框、
        $scope.closeMemberSelDia = function () {
            $.fancybox.close();
        };

        //选择会员
        $scope.selectMember = function (member) {
            $scope.view.memberSelected = member;
        };

        //多卡会员选择消费卡
        $scope.showCardSelectDia = function () {
            utils.openFancyBox("#m-pos-member-card-select");

            $scope.payStatus.billDiscount = featureConf.defaultDiscount;
            $scope.payStatus.billReduce = 0;

            _stopAnimationPlay();
            $scope.multiCardAutoMatch();
            _selectFistItem();
            _sortPayCard();

            $scope.calculateAmount();

            function _selectFistItem() {
                if ($scope.buyProductRecords.length > 0) {
                    $scope.selectPayItem($scope.buyProductRecords[0]);
                }
            }

            function _stopAnimationPlay() {
                var cashPay = $("#m-pos-member-card-select .y_dialog_header .y_step_status>li:nth-child(3)").show();
                if ($scope.incomeStatus.multiCardOverMoney == 0) {
                    $("#m-pos-member-card-select .y_dialog_header .y_step_status").removeClass("pos_multi_card_step_change");
                    cashPay.hide();
                }
            }

            function _sortPayCard() {
                var payCardList = [];
                var payCardIdList = [];

                _.each($scope.buyProductRecords, function (item) {
                    if (_.isEmpty(item.payCardList)) {
                        return;
                    }

                    _.each(item.payCardList, function (one) {
                        if (!_.contains(["rechargeCard", "recordCard", "quarterCard"], one.payInfo.payType)) {
                            return;
                        }

                        if (_.contains(payCardIdList, one.payCard.id)) {
                            return;
                        }

                        payCardIdList.push(one.payCard.id);

                        var payCard = _.find($scope.memberSelected.cards, function (card) {
                            return card.id === one.payCard.id;
                        });

                        if (_.isEmpty(payCard)) {
                            return;
                        }

                        if (one.payCard.cateType === "recharge") {
                            payCardList.splice(0, 0, payCard);
                            return;
                        }

                        payCardList.push(payCard);
                    });
                });

                var noPayCardList = _.filter($scope.memberSelected.cards, function (card) {
                    return !_.contains(payCardIdList, card.id);
                });

                $scope.memberSelected.cards = payCardList.concat(noPayCardList);
            }
        };

        $scope.multiCardAutoMatch = function () {
            if (!$scope.isMultiCardMember()) {
                return;
            }

            _matchPresent();
            _matchQuarterCard();
            _matchRecordCard();
            _matchRechargeCard();
            _clearTips();

            function _matchPresent() {
                var noPayItem = _.filter($scope.buyProductRecords, function (item) {
                    return _.isEmpty(item.payCard);
                });

                _.each(noPayItem, function (item) {
                    $scope.selectPayItem(item);
                    //先根据项目上关联的赠送服务匹配支付
                    var present = _.find($scope.memberSelected.presents || [], function (present) {
                        return present.sequenceId == item.relatedCardId;
                    });
                    if (present) {
                        $scope.selectPayPresent(present, true);
                    }
                    // 项目已经与关联的赠送服务匹配了
                    if (!_.isEmpty(item.payCardList)) {
                        return;
                    }
                    _.each($scope.memberSelected.presents, function (present) {
                        $scope.selectPayPresent(present, true);
                    });
                });
            }

            function _matchQuarterCard() {
                var noPayItem = _.filter($scope.buyProductRecords, function (item) {
                    return _.isEmpty(item.payCardList);
                });

                var quarterCard = _.filter($scope.memberSelected.cards, function (card) {
                    return card.cateType === "quarter";
                });

                _.each(noPayItem, function (item) {
                    $scope.selectPayItem(item);
                    _.each(quarterCard, function (card) {
                        $scope.selectPayCard(card, true);
                    });
                });
            }

            function _matchRecordCard() {
                var noPayItem = _.filter($scope.buyProductRecords, function (item) {
                    return _.isEmpty(item.payCardList);
                });

                var recordCard = _.filter($scope.memberSelected.cards, function (card) {
                    return card.cateType === "record";
                });

                _.each(noPayItem, function (item) {
                    $scope.selectPayItem(item);

                    _.each(recordCard, function (card) {
                        $scope.selectPayCard(card, true);
                    });
                });
            }

            function _matchRechargeCard() {
                var noPayItem = _.filter($scope.buyProductRecords, function (item) {
                    return _.isEmpty(item.payCardList);
                });

                var rechargeCard = _.filter($scope.memberSelected.cards, function (card) {
                    return card.cateType === "recharge";
                });

                _.each(noPayItem, function (item) {
                    $scope.selectPayItem(item);

                    _.each(rechargeCard, function (card) {
                        $scope.selectPayCard(card, true);
                    });
                });
            }

            function _clearTips() {
                $("#select-card-error").hide();
                $("#card_balance_short").hide();
            }
        };

        $scope.closeCardSelectDia = function () {
            $.fancybox.close();
        };

        $scope.selectPayCardNextStep = function () {
            $scope.view.dialogHrefStack.push("#m-pos-member-card-select");
            if (Math.abs($scope.incomeStatus.multiCardOverMoney) > 0.000001) {
                var hasCashItem = _.find($scope.buyProductRecords, function (item) {
                    return $scope.isProductCannotPayByCard(item);
                });

                if (_.isEmpty(hasCashItem) && !window.featureConf.memberCanUseCashAccess) {
                    utils.showGlobalMsg("支付金额不足，请给会员卡充值");
                    return;
                }

                $scope.showCheckoutDia();
                $scope.payStatusInputFocus("cashPay");
            }
            else {
                $scope.showBonusSelDia();
            }
        };

        //选择准备支付的项目
        $scope.selectPayItem = function (item) {
            //准备支付的项目
            $scope.view.preparePayItem = item;

            $scope.digestScope();
        };

        $scope.removeCurrentSelItemCardPay = function (card) {
            $scope.removeItemPayInfo($scope.view.preparePayItem, card);

            $scope.calculateAmount();
        };

        $scope.multiCardRecharge = function (card) {
            $scope.view.recharging = true;
            $scope.view.frontDiaHref = "#m-pos-member-card-select";
            $scope.view.rechargingCard = card || $scope.view.preparePayCard;

            resetCardRecharge();
            openCardRechargeDia();
        };

        $scope.singleCardRecharge = function (card) {
            $scope.view.recharging = true;
            $scope.view.frontDiaHref = "#m-pos-checkout-popup";
            $scope.view.rechargingCard = card;

            resetCardRecharge();
            openCardRechargeDia();
        };


        $scope.onlyCardRecharge = function (card) {
            $scope.view.recharging = true;
            $scope.view.frontDiaHref = "";
            $scope.view.rechargingCard = card || $scope.view.preparePayCard;
            resetCardRecharge();
            openCardRechargeDia();
        };

        $scope.expireCardSelect = function (card) {
            $scope.view.frontDiaHref = "";
            initExpireCardRecharge();
            utils.openFancyBox("#m-pos-recharge-expireCard");
            $scope.digestScope();

            function initExpireCardRecharge() {
                var price = $scope.cateId2CardCate[card.cateId].baseInfo_minMoney;
                var discount = calDiscount();
                $scope.expireCardRecharge = {
                    balance: price,
                    discount: discount,
                    payMethod: "cash",
                    bonusEmpList: [],
                    rechargeTimes: 0, // 年卡续卡次数
                    card: card
                }
            }

            function calDiscount() {
                var count = 0;
                _.each($scope.memberSelected.expireCardsRepeat, function (item) {
                    if (item.cateId == card.cateId && item.cardNo == card.cardNo) {
                        count = count + 1;
                    }
                });
                var discount = 10 - 2 * count;
                return discount > 2 ? discount : 2;
            }
        };

        $scope.expireCardRechargeCommit = function () {
            if ($scope.expireCardRechargeCommit.doing || !checkDiscount()) {
                return;
            }

            $scope.expireCardRechargeCommit.doing = true;
            setTimeout(function () {
                $scope.expireCardRechargeCommit.doing = false;
            }, 5000);

            var cardCate = _.clone($scope.cateId2CardCate[$scope.expireCardRecharge.card.cateId]);
            var payAmount = cardCate.baseInfo_minMoney * $scope.expireCardRecharge.discount / 10;
            cardCate.baseInfo_minMoney = payAmount;
            cardCate.cardNo = $scope.expireCardRecharge.card.cardNo;
            cardCate.relatedCardId = cardCate.id;
            cardCate.isExtension = true;
            if ($scope.expireCardRecharge.card.isValid) {
                cardCate.dateTime = $scope.expireCardRecharge.card.validTime;
            }
            $scope.selectProduct(cardCate);

            function checkDiscount() {
                var rechargeErr = $(".pos-expireCardRecharge-error");
                var legal = $scope.expireCardRecharge.discount != null && utils.checkNum($scope.expireCardRecharge.discount, 0, 10);
                if (!legal) {
                    rechargeErr.show();
                }
                return legal;
            }
        };

        $scope.switchRechargePayMethod = function (payMethod) {
            $scope.cardRecharge.payMethod = payMethod;
        };

        $scope.isEmpInList = function (bonusEmpList, employee) {
            var empExist = false;
            var findEmp = _.find(bonusEmpList, function (item) {
                return item.id === employee.id;
            });
            if (findEmp) {
                empExist = true;
            }
            return empExist;
        };

        $scope.selectRechargeEmpBonus = function (employee) {
            if ($scope.isEmpInList($scope.cardRecharge.bonusEmpList, employee)) {
                //反选员工
                _.each($scope.cardRecharge.bonusEmpList, function (item, index) {
                    if (item.id === employee.id) {
                        $scope.cardRecharge.bonusEmpList.splice(index, 1);
                    }
                });
            }
            else {
                //选择员工
                $scope.cardRecharge.bonusEmpList.push(employee);
                $scope.cardRecharge.tempBonusEmpList.push(employee);
            }
        };

        $scope.selectRecordRechargeTimes = function (rechargeTimes) {
            $scope.cardRecharge.rechargeMultiple = rechargeTimes;
        };

        function resetCardRecharge() {
            var cardCateList = $scope.rechargeCateList.concat($scope.recordCateList);

            var rechargingCardCate = _.find(cardCateList, function (cate) {
                return cate.id === $scope.view.rechargingCard.cateId;
            });

            $scope.cardRecharge = {
                rechargeMoney: "",
                presentMoney: "",
                payMethod: "cash",
                bonusEmpList: [],
                tempBonusEmpList: [],

                rechargeMultiple: 1,//计次卡充值倍数
                rechargingCardCate: rechargingCardCate || {}
            }
        }

        function openCardRechargeDia() {
            $(".error").hide();
            if ($scope.isRecordCard($scope.view.rechargingCard)) {
                utils.openFancyBox("#m-pos-recharge-recordCard");
            }
            else {
                utils.openFancyBox("#m-pos-recharge-rechargeCard");
            }
            $scope.digestScope();
        }

        $scope.closeCardRechargeDia = function () {
            utils.openFancyBox($scope.view.frontDiaHref);
            setTimeout(function () {
                $scope.view.recharging = false;
                $scope.digestScope();
            }, 1000);
        };

        $scope.checkPosRecharge = function () {
            if (_.isEmpty($scope.cardRecharge.bonusEmpList)) {
                utils.showGlobalMsg('请选择充值员工');
                return;
            }

            //计次卡充值不需要验证
            if ($scope.isRecordCard($scope.view.rechargingCard)) {
                return true;
            }

            $(".error").hide();

            var rechargeCheck = checkRechargeMoney();
            var presentCheck = checkPresentMoney();

            return rechargeCheck && presentCheck;

            function checkRechargeMoney() {
                var rechargeErr = $(".pos-recharge-error");
                var legal = utils.checkNum($scope.cardRecharge.rechargeMoney, 0.000001, 10000000);
                if (legal) {
                    $scope.cardRecharge.rechargeMoney = utils.toDecimalDigit($scope.cardRecharge.rechargeMoney);
                }
                else {
                    rechargeErr.show();
                }
                return legal;
            }

            function checkPresentMoney() {
                var rechargeErr = $(".pos-recharge-present-error");
                var legal = utils.checkNum($scope.cardRecharge.presentMoney, 0, 10000000);
                if (legal) {
                    $scope.cardRecharge.presentMoney = utils.toDecimalDigit($scope.cardRecharge.presentMoney);
                }
                else {
                    rechargeErr.show();
                }
                return legal;
            }
        };

        $scope.$watch("cardRecharge.rechargeMoney", function (newValue) {
            if (_.isEmpty($scope.cardRecharge)) {
                return;
            }

            if (!newValue) {
                $scope.cardRecharge.presentMoney = 0;
                return;
            }

            var rechargingCardCate = $scope.cardRecharge.rechargingCardCate;

            var ratio = rechargingCardCate.baseInfo_minMoney / (rechargingCardCate.baseInfo_minMoney + rechargingCardCate.activeCardPresentMoney);

            if (_.isNaN(ratio)) {
                $scope.cardRecharge.presentMoney = 0;
                return;
            }
            var presentMoney = $scope.cardRecharge.rechargeMoney / ratio - $scope.cardRecharge.rechargeMoney;
            $scope.cardRecharge.presentMoney = utils.toDecimalDigit(presentMoney);
        });

        $scope.cardRechargeCommit = function () {
            if ($scope.cardRechargeCommit.doing || !$scope.checkPosRecharge()) {
                return;
            }

            $scope.cardRechargeCommit.doing = true;
            setTimeout(function () {
                $scope.cardRechargeCommit.doing = false;
            }, 5000);

            var rechargeModel = $scope.cardRecharge;
            var rechargingMember = $scope.memberSelected;
            var rechargingCard = $scope.view.rechargingCard;
            var isRechargeCard = $scope.isRechargeCard(rechargingCard);

            var rechargeInfo = _prepareModel();

            utils.showWaitTips("#m-pos-recharge-rechargeCard", 24, "正在提交", "dialog");
            async.series([_doRecharge, _freshMemberInfo], function (error) {
                utils.hideWaitTips("#m-pos-recharge-rechargeCard");

                $scope.cardRechargeCommit.doing = false;
                $scope.view.recharging = false;

                if (error) {
                    utils.showGlobalMsg(error.errorMsg || "充值失败");
                    return;
                }

                _sendMsg();
                _printTicket();
                utils.showGlobalSuccessMsg("充值成功");

                utils.openFancyBox($scope.view.frontDiaHref);
                $scope.calculateAmount();
                $scope.digestScope();
            });


            function _doRecharge(callback) {
                memberDao.updateMemberCard(rechargeInfo, callback);
            }

            function _freshMemberInfo(callback) {
                $scope.queryAndSelectedMember(rechargingMember.id, function (error) {
                    if (error) {
                        callback(error);
                        return;
                    }

                    $scope.removeAllItemPayInfo();
                    $scope.multiCardAutoMatch();
                    callback(null);
                });
            }

            function _prepareModel() {
                var now = new Date();
                var nowMilli = now.getTime();

                var member = {};
                var memberCard = {};
                var rechargeBill = {};
                var recordBalanceList = [];
                var bonusRecords = [];

                _prepareMember();
                _prepareMemberCard();
                _prepareRechargeBill();
                _prepareRecordBalance();
                _prepareBonusList();

                return {
                    member: member,
                    memberCard: memberCard,
                    rechargeBill: rechargeBill,
                    recordBalanceList: recordBalanceList,
                    bonusRecords: bonusRecords
                };

                function _prepareMember() {
                    member.id = rechargingMember.id;
                    member.modify_date = nowMilli;

                    // 生日充值 积分双倍
                    var multiple = $scope.memberSelected.usedPrivilegeFlag ? 2 : 1;

                    if (isRechargeCard && rechargingCard.rechargePresentScore) {
                        member.presentScore = Math.abs((rechargeModel.rechargeMoney / rechargingCard.rechargePresentScore) || 0);
                        member.presentScore *= multiple;
                    }
                    else {
                        member.presentScore = 0;
                    }

                    member.currentScore = $scope.memberSelected.currentScore + member.presentScore;
                }

                function _prepareMemberCard() {
                    memberCard.id = rechargingCard.id;
                    if (isRechargeCard) {
                        memberCard.cateType = "recharge";
                        memberCard.rechargeMoney = rechargeModel.rechargeMoney;
                        memberCard.presentMoney = rechargeModel.presentMoney || 0;
                    }
                    else {
                        memberCard.cateType = "record";
                        memberCard.rechargeMoney = rechargeModel.rechargingCardCate.baseInfo_minMoney * rechargeModel.rechargeMultiple;
                        memberCard.presentMoney = 0;
                    }
                    memberCard.modify_date = nowMilli;
                }

                function _prepareRechargeBill() {
                    rechargeBill.type = 1;//充值
                    rechargeBill.amount = memberCard.rechargeMoney;
                    rechargeBill.dateTime = nowMilli;
                    rechargeBill.day = now.getDate();
                    rechargeBill.weekDay = now.getDay();
                    rechargeBill.month = now.getMonth() + 1;
                    rechargeBill.memberNo = rechargingMember.memberNo;
                    rechargeBill.member_id = rechargingMember.id;
                    rechargeBill.member_name = rechargingMember.name;
                    rechargeBill.memberCard_id = rechargingCard.id;
                    rechargeBill.memberCardCate_id = rechargingCard.cateId;
                    rechargeBill.memberCard_name = rechargingCard.cardNo;
                    rechargeBill.create_date = nowMilli;
                    rechargeBill.enterprise_id = YILOS.ENTERPRISEID;
                    rechargeBill.comment = rechargingCard.cardName + $.i18n.t("member.member_recharge");//备注为某某卡充值
                    rechargeBill.member_currentBalance = utils.toDecimalDigit(rechargingCard.balance + memberCard.presentMoney + memberCard.rechargeMoney);
                    rechargeBill.def_str1 = rechargingCard.cardName;
                    rechargeBill.storeNameSnapshot = $scope.storeInfo.name || "";

                    if (!isRechargeCard) {
                        rechargeBill.member_currentBalance = utils.toDecimalDigit(rechargingCard.balance * rechargingCard.recordAvgPrice + memberCard.rechargeMoney);
                    }

                    if (rechargeModel.payMethod === "cash") {
                        rechargeBill.pay_cash = memberCard.rechargeMoney;
                    }
                    else {
                        rechargeBill.pay_bankAccount_money = memberCard.rechargeMoney;
                    }

                    rechargeBill.presentMoney = memberCard.presentMoney || 0;
                    rechargeBill.presentScore = member.presentScore;
                    rechargeBill.currentScore = rechargingMember.currentScore + member.presentScore;
                    rechargeBill.usedPrivilege = $scope.memberSelected.usedPrivilegeFlag;

                    // 记录第一个服务人
                    var firstBonusEmp = _.find($scope.cardRecharge.tempBonusEmpList || [], function (temp) {
                        var bonusEmp = _.find($scope.cardRecharge.bonusEmpList || [], function (emp) {
                            return temp.id == emp.id;
                        });
                        return bonusEmp ? true : false;
                    });
                    rechargeBill.employee_id = firstBonusEmp ? firstBonusEmp.id || null : null;
                    rechargeBill.employee_name = firstBonusEmp ? firstBonusEmp.name || null : null;
                }

                function _prepareRecordBalance() {
                    if (isRechargeCard) {
                        return;
                    }

                    var currentRemaining = rechargingCard.recordBalance;

                    var rechargeService = rechargeModel.rechargingCardCate.cateServiceGrouped;

                    _.each(currentRemaining, function (remain) {
                        var rechargeGroup = _.find(rechargeService, function (oneGroup) {
                            return oneGroup.bind_group === remain.bind_group
                        });

                        if (_.isEmpty(rechargeGroup)) {
                            return;
                        }

                        var rechargeTimes = rechargeGroup.times * rechargeModel.rechargeMultiple;

                        _.each(remain.services, function (oneService) {
                            oneService.times += rechargeTimes;
                            oneService.modify_date = nowMilli;

                            recordBalanceList.push(_.clone(oneService));
                        });
                    });
                }

                function _prepareBonusList() {
                    var bonusEmpList = rechargeModel.bonusEmpList;
                    var bonusEmpCounts = bonusEmpList.length;

                    _.each(bonusEmpList, function (item, index) {
                        var performance = utils.toDecimalDigit(rechargeBill.amount / bonusEmpCounts);

                        //最后一个员工的特殊处理
                        if (index === bonusEmpCounts - 1) {
                            var amountSpliced = performance * (bonusEmpCounts - 1);
                            performance = utils.toDecimalDigit(rechargeBill.amount - amountSpliced);
                        }

                        var empBonus = {
                            employee_id: item.id,
                            employee_name: item.name,
                            bonusMoney: 0,
                            totalMoney: performance,
                            cashMoney: performance,
                            cardMoney: 0,
                            fixedBonus: 0,
                            type: 4,//充值
                            cardNo: $scope.memberSelected.memberNo,
                            member_name: $scope.memberSelected.name
                        };

                        bonusRecords.push(empBonus);
                    });
                }
            }

            //发送短信
            function _sendMsg() {
                if (!featureConf.canSendMsg) {
                    return;
                }

                var msgContent = null;
                if ($scope.msgSwitch && $scope.msgSwitch.cardRechargeMsgSwitch == 1) {
                    //发送短信内容
                    msgContent = {
                        phoneNumber: rechargingMember.phoneMobile,
                        memberCardNo: rechargingCard.cardNo,
                        memberCardName: rechargingCard.cardName,
                        money: rechargeInfo.memberCard.rechargeMoney.toFixed(1),
                        enterpriseName: $scope.storeInfo.name
                    };

                    if (isRechargeCard) {
                        msgContent.template_id = "template_14";
                        msgContent.presentMoney = rechargeInfo.memberCard.presentMoney.toFixed(1);
                        msgContent.balance = $scope.view.rechargingCard.balance;
                    }
                    else {
                        msgContent.template_id = "template_8";
                        msgContent.projectList = _serviceNames();
                        msgContent.rechargeTimes = _serviceTimes();
                        msgContent.remainingTimes = _remainingTimes();
                    }

                    $scope.sendMsg(msgContent)
                }

                function _serviceNames() {
                    var rechargeServices = $scope.recordServiceInfo[$scope.view.rechargingCard.cardCateId];

                    var serviceNames = _.pluck(rechargeServices, "serviceNames").join("，");

                    if (serviceNames.length > 60) {
                        serviceNames = serviceNames.substring(0, 55);
                    }
                    return serviceNames || "";
                }

                function _serviceTimes() {
                    var rechargeServices = $scope.recordServiceInfo[$scope.view.rechargingCard.cardCateId];

                    var rechargeTimes = 0;

                    _.each(rechargeServices, function (item) {
                        rechargeTimes += item.serviceTimes;
                    });

                    return rechargeTimes * $scope.cardRecharge.rechargeMultiple;
                }

                function _remainingTimes() {
                    var remainingTimes = 0;

                    var grouped = _.groupBy(rechargeInfo.recordBalanceList, "bind_group");

                    _.each(grouped, function (oneGroup) {
                        remainingTimes += Number(oneGroup[0].value);
                    });

                    return remainingTimes;
                }
            }

            //打印小票
            function _printTicket() {
                var rechargeBill = rechargeInfo.rechargeBill;
                var ticket = _buildTicketTemplate();

                ticketDao.addTicket2Local(rechargeBill.id, ticket, function () {
                });

                //开关关闭状态
                if ($scope.ticketSwitch.rechargeTicketSwitch == 0) {
                    return;
                }

                utils.printTicket(ticket, function (error) {
                    if (error) {
                        utils.log("m-pos fragment-member _printTicket", error);
                    }
                });

                function _buildTicketTemplate() {
                    var ticketTemplate = {};

                    ticketTemplate.ticket_type = 1;
                    ticketTemplate.header = {
                        store_name: $scope.storeInfo.name,
                        consume_no: rechargeBill.billNo,
                        date: new Date().Format("yyyy-MM-dd hh:mm:ss"),
                        member_no: rechargeBill.memberNo
                    };

                    ticketTemplate.body = [];
                    ticketTemplate.body.push({
                        name: rechargingCard.cardName + $.i18n.t("member.member_recharge"),
                        amount: "1",
                        sum: $.i18n.t("common.label.currency") + rechargeBill.amount.toFixed(1)
                    });

                    //赠送金额
                    if (rechargeBill.presentMoney) {
                        ticketTemplate.body.push({
                            name: "赠送金额",
                            amount: "",
                            sum: $.i18n.t("common.label.currency") + rechargeBill.presentMoney.toFixed(1)
                        });
                    }

                    ticketTemplate.balanceList = [];

                    if ($scope.isRechargeCard(rechargingCard)) {
                        ticketTemplate.currentScore = Number(rechargeBill.presentScore).toFixed(0);
                        ticketTemplate.totalScore = Number(rechargeBill.currentScore).toFixed(0);

                        ticketTemplate.balanceList.push({
                            remainDesc: rechargingCard.cardName + "余额",
                            remain: "￥" + Number(rechargeBill.member_currentBalance).toFixed(1)
                        });
                    }
                    else {
                        var previousRechargeCard = _.find($scope.memberSelected.cards, function (card) {
                            return card.id === rechargingCard.id;
                        });

                        ticketTemplate.balanceList.push({
                            remainDesc: rechargingCard.cardName + "余次",
                            remain: Number(previousRechargeCard.balance).toFixed(0) + "次"
                        });
                    }

                    ticketTemplate.footer = {
                        address: $scope.storeInfo.address,
                        phone: $scope.storeInfo.phone
                    };

                    return ticketTemplate;
                }
            }
        };

        $scope.getPresentSAvailableInfo = function (service, present) {
            var useAvailable = false;
            var typeDetail = "不在赠送服务范围内";

            var usedService = _.find(present.services, function (item) {
                return item.id === service.id;
            });

            if (!_.isEmpty(usedService)) {
                var payTimes = 0;

                if (usedService.isValid) {
                    var usedTimes = 0;
                    //计算在其他项目上支付的次数
                    _.each($scope.buyProductRecords, function (item) {
                        _.each(item.payCardList, function (one) {
                            if (one.payCard.sequenceId === present.sequenceId && item.id === usedService.id) {
                                usedTimes += one.payInfo.cardPayTimes || 0;
                            }
                        });
                    });

                    payTimes = $scope.itemUnpaidRemainingTimes(service);

                    if (window.featureConf.itemOnlyPayByOneCard) {
                        useAvailable = ((usedService.times - usedTimes) >= service.saleNum);
                    }
                    else {
                        useAvailable = (usedService.times != 0);

                        if (payTimes > usedService.times) {
                            payTimes = usedService.times;
                        }
                    }

                    typeDetail = "赠送服务余次不足";
                }
                else {
                    typeDetail = "赠送服务(" + usedService.names + ")已失效";
                }
            }

            return {
                useAvailable: useAvailable,
                typeDetail: typeDetail,
                usedService: usedService,
                payTimes: payTimes
            };
        };

        function _showSelectCardError(msg) {
            if ($scope.view.tempFlag) {
                clearTimeout($scope.view.tempFlag);
            }

            $("#m-pos-member-card-select .multi_card_tips").hide();

            var errorMsg = $("#select-card-error").text(msg).show();

            $scope.view.tempFlag = setTimeout(function () {
                errorMsg.hide();
            }, 2000);
        }

        $scope.selectPayPresent = function (present, isAuto) {
            var preparePayItem = $scope.view.preparePayItem;
            if (isAuto && !_.isEmpty(preparePayItem) && !_.isEmpty(preparePayItem.payCardList)) {
                return;
            }
            var presentAvailableInfo = $scope.getPresentSAvailableInfo(preparePayItem, present);

            if (!presentAvailableInfo.useAvailable) {
                _showSelectCardError(presentAvailableInfo.typeDetail);
                return;
            }

            var presentExist = !_.isEmpty(_.find(preparePayItem.payCardList, function (item) {
                return !_.isEmpty(item.payInfo.present) && item.payInfo.present.sequenceId === present.sequenceId;
            }));
            if (presentExist) {
                preparePayItem.payCardList = _.filter(preparePayItem.payCardList, function (item) {
                    return _.isEmpty(item.payInfo.present) || item.payInfo.present.sequenceId !== present.sequenceId;
                });
                return;
            }

            var usedService = presentAvailableInfo.usedService;

            var payInfo = {};
            payInfo.present = present;
            payInfo.cardName = "赠送服务";
            payInfo.payType = "presentService";
            payInfo.cardPayTimes = presentAvailableInfo.payTimes;
            payInfo.times2Money = 0;

            preparePayItem.payCardList = (preparePayItem.payCardList || []).concat({
                payCard: _.extend({cardName: "赠送服务"}, usedService),
                payInfo: payInfo
            });

            $scope.calculateAmount();
        };

        //为支付项目选择某张卡
        $scope.selectPayCard = function (preparePayCard, isAutoMatch) {
            $scope.view.preparePayCard = preparePayCard;

            var preparePayItem = $scope.view.preparePayItem;
            var cardPayMoney = 0, cardPayTimes = 0, payInfo = {};

            payInfo.cardName = preparePayCard.cardName;

            if (_isDuplicatePay()) {
                $scope.removeCurrentSelItemCardPay(preparePayCard);
                $scope.itemReselectPay(preparePayItem);
                return;
            }

            if (!_isValidOrNotInRang()) {
                return;
            }

            // 自动匹配时 项目已被完全支付 不再用其他支付
            if (isAutoMatch && $scope.itemUnpaidRemainingMoney(preparePayItem) < 0.1) {
                return;
            }

            if (window.featureConf.itemOnlyPayByOneCard) {
                $scope.removeItemPayInfo(preparePayItem);
            }

            if ($scope.isRechargeCard(preparePayCard)) {
                if (!_payByRechargeCard()) {
                    return;
                }
            }
            else if ($scope.isRecordCard(preparePayCard)) {
                if (!_payByRecordCard()) {
                    return;
                }
            }
            else if ($scope.isQuarterCard(preparePayCard)) {
                if (!_payByQuarterCard()) {
                    return;
                }
            }

            preparePayItem.payCardList = (preparePayItem.payCardList || []).concat({
                payCard: preparePayCard,
                payInfo: payInfo
            });

            $scope.calculateAmount();

            function _isValidOrNotInRang() {
                if ($scope.isProductCannotPayByCard(preparePayItem) && $scope.isRechargeCard(preparePayCard)) {
                    _showSelectCardError("该项目不能用会员卡支付");
                    return false;
                }

                if (!preparePayCard.isValid) {
                    _showSelectCardError("此卡已失效");
                    return false;
                }
                return true;
            }

            function _payByRechargeCard() {
                var approvePayMoney = preparePayCard.balance;//可支付的会员卡余额

                //减去该卡在其他项目上支付的金额
                _.each($scope.buyProductRecords, function (item) {
                    if (!$scope.isCompleteSameItem(item, preparePayItem)) {
                        return;
                    }

                    approvePayMoney -= $scope.cardTotalPayWithoutItem(preparePayCard.id, item);
                });

                if ($scope.isAdvancedDisType(preparePayCard)) {
                    var discount = preparePayCard.discountInfo[preparePayItem.cate_id];

                    if (!discount && discount !== 0) {
                        discount = 10;
                    }
                    payInfo.discount = discount;
                }
                else {
                    payInfo.discount = preparePayCard.discountInfo;
                }

                if (preparePayItem.noDiscount) {
                    payInfo.discount = 10;
                }

                var payByMoneyItem = $scope.payByMoneyItemList();
                var itemId2CouponPay = $scope.buildItemId2CouponPay(payByMoneyItem.concat(preparePayItem));

                var itemUnpaidMoney = $scope.itemUnpaidRemainingMoney(preparePayItem);

                var shouldPayMoney = (itemUnpaidMoney - (itemId2CouponPay[preparePayItem.id] || 0)) * payInfo.discount / 10;
                var payMoney = shouldPayMoney;

                //判断充值卡卡是否足够支付
                if (shouldPayMoney > approvePayMoney) {
                    if (window.featureConf.itemOnlyPayByOneCard || Math.abs(approvePayMoney) < 0.000001) {
                        _showRechargeTips();
                        return false;
                    }
                    payMoney = approvePayMoney;
                }

                cardPayMoney = payMoney;
                payInfo.payType = "rechargeCard";
                payInfo.cardPayMoney = cardPayMoney;
                return true;
            }

            function _payByRecordCard() {
                if (isAutoMatch && preparePayItem.relatedCardId && preparePayItem.relatedCardId !== preparePayCard.id) {
                    return false;
                }

                //可支付的次数
                var approvePayTimes = JSON.parse(JSON.stringify(preparePayCard.recordBalance));

                //减去在其他项目上支付的次数
                _.each($scope.buyProductRecords, function (item) {
                    if ($scope.isCompleteSameItem(item, preparePayItem)) {
                        return;
                    }

                    _.each(item.payCardList, function (one) {
                        if (one.payCard.id !== preparePayCard.id) {
                            return;
                        }

                        var group = $scope.recordServiceGroup(one.payCard, item.id);

                        _.each(approvePayTimes, function (oneGroup) {
                            if (oneGroup.bind_group === group) {
                                oneGroup.times -= one.payInfo.cardPayTimes;
                            }
                        });
                    });
                });

                if (!$scope.isRecordContainsService(preparePayCard, preparePayItem.id)) {
                    _showNotInRange();
                    return false;
                }

                var remainingTimes = $scope.recordServiceRemainingTimes(approvePayTimes, preparePayItem.id);
                var itemUnpaidTimes = $scope.itemUnpaidRemainingTimes(preparePayItem);

                if (remainingTimes < itemUnpaidTimes) {
                    if (window.featureConf.itemOnlyPayByOneCard || remainingTimes < 1) {
                        _showRechargeTips();
                        return false;
                    }

                    cardPayTimes = remainingTimes;
                }
                else {
                    cardPayTimes = itemUnpaidTimes;
                }

                payInfo.payType = "recordCard";
                payInfo.cardPayTimes = cardPayTimes;
                payInfo.times2Money = cardPayTimes * preparePayCard.recordAvgPrice;
                return true;
            }

            function _payByQuarterCard() {
                if (isAutoMatch && preparePayItem.relatedCardId && preparePayItem.relatedCardId !== preparePayCard.id) {
                    return false;
                }
                if (!$scope.isQuarterContainsService(preparePayCard, preparePayItem.id)) {
                    _showNotInRange();
                    return false;
                }

                //window.featureConf.quarterUseHourInterval = "24";
                //  馨米兰需求，避免店内恶意消费，季卡和年卡一天最多只能用一次
                if (!_.isEmpty(preparePayCard.paymentRecords) && !_.isEmpty(window.featureConf.quarterUseHourInterval)) {//季卡、年卡支付记录
                    var nowMill = new Date().getTime();
                    var lastPay = _.max(preparePayCard.paymentRecords, function (item) {
                        return item.dateTime;
                    });
                    var tempDate = new Date(lastPay.dateTime);
                    var tempTime = new Date(tempDate.getFullYear(), tempDate.getMonth(), tempDate.getDate() + 1).getTime();
                    if (nowMill < tempTime) {
                        _showSelectCardError("季卡年卡一天只能使用一次");
                        return false;
                    }
                }

                payInfo.payType = "quarterCard";
                payInfo.cardPayTimes = $scope.itemUnpaidRemainingTimes(preparePayItem);
                payInfo.activeTimes = _remainingActiveTimes();
                payInfo.times2Money = (payInfo.activeTimes * preparePayCard.timesAvgPrice);

                return true;

                function _remainingActiveTimes() {
                    var payTimes = 0;

                    _.each($scope.buyProductRecords, function (item) {
                        _.each(item.payCardList, function (one) {
                            if (one.payCard.id !== preparePayCard.id) {
                                return;
                            }

                            payTimes += one.payInfo.activeTimes;
                        });
                    });

                    var remaining = (preparePayCard.timesLimit - preparePayCard.balance - payTimes);

                    if (remaining < 0) {
                        remaining = 0;
                    }

                    if (payInfo.cardPayTimes < remaining) {
                        return payInfo.cardPayTimes;
                    }

                    return remaining;
                }
            }

            function _isDuplicatePay() {
                if (_.isEmpty(preparePayItem.payCardList)) {
                    return false;
                }

                return !_.isEmpty(_.find(preparePayItem.payCardList, function (item) {
                    return item.payCard.id === preparePayCard.id;
                }));
            }

            function _showNotInRange() {
                _showSelectCardError("此卡不支持所选项目支付");
            }

            function _showRechargeTips() {
                if (_showRechargeTips.preTips) {
                    clearTimeout(_showRechargeTips.preTips);
                }

                $("#m-pos-member-card-select .multi_card_tips").hide();
                var msg = $("#card_balance_short").show();

                _showRechargeTips.preTips = setTimeout(function () {
                    msg.hide();
                }, 2000);
            }
        };

        //是否是高级折扣类型、涉及到计算规则不一样
        $scope.isAdvancedDisType = function (memberCard) {
            return $scope.isRechargeCard(memberCard) && memberCard.discountType === "advanced";
        };

        $scope.filterMemberIrrelevance = function () {
            _filterCards();
            _filterUsedCoupon();
            _filterPresent();

            function _filterCards() {
                //过滤冻结的卡，并用模型存储展示在页面上
                $scope.memberSelected.freezeCards = _.filter($scope.memberSelected.cards, function (card) {
                    var freezeCards = (card.cateType === "quarter" && card.status == 2);
                    return freezeCards;
                });

                // 过滤已过期年卡
                $scope.memberSelected.expireCardsRepeat = _.filter($scope.memberSelected.cards, function (card) {
                    var quarterHasExpired = (card.cateType === "quarter" && card.type === "year" && !card.isValid);
                    return quarterHasExpired;
                });
                // 过滤次数为0的次卡、过期的年卡季卡
                $scope.memberSelected.cards = _.filter($scope.memberSelected.cards, function (card) {
                    var recordBalanceShort = (card.cateType === "record" && card.balance <= 0);
                    var quarterHasExpired = (card.cateType === "quarter" && !card.isValid);
                    var freezeCards = (card.cateType === "quarter" && card.status == 2);

                    return !(recordBalanceShort || quarterHasExpired || freezeCards);
                });

                // 同种类型过期年卡只显示一个
                var repeatCates = [];
                $scope.memberSelected.expireCards = [];
                _.sortBy($scope.memberSelected.expireCardsRepeat, function (tmp) {
                    return -(tmp.validTime);
                });
                _.each($scope.memberSelected.expireCardsRepeat, function (card) {
                    if (repeatCates.indexOf(card.cateId + card.cardNo) < 0) {
                        // 如果有同种的年卡未过期，则不显示过期年卡
                        var temp = _.find($scope.memberSelected.cards, function (item) {
                            return item.cateId == card.cateId && item.cardNo == card.cardNo;
                        });
                        if (!temp) {
                            repeatCates.push(card.cateId + card.cardNo);
                            $scope.memberSelected.expireCards.push(card);
                        }
                    }
                });
                // 即将过期的卡也允许续卡
                var nowTime = new Date().getTime();
                _.each($scope.memberSelected.cards, function (card) {
                    if (card.cateType === "quarter" && card.type === "year" && card.isValid && card.validTime - nowTime <= 60 * 24 * 3600000) {
                        if (repeatCates.indexOf(card.cateId + card.cardNo) < 0) {
                            // 如果有同种的年卡未过期，则不显示过期年卡
                            var temp = _.find($scope.memberSelected.cards, function (item) {
                                return item.cateId == card.cateId && item.cardNo == card.cardNo && item.id != card.id;
                            });
                            if (!temp) {
                                repeatCates.push(card.cateId + card.cardNo);
                                $scope.memberSelected.expireCards.push(card);
                            }
                        }
                    }
                })
            }

            function _filterUsedCoupon() {
                // 过滤已用的现金券
                $scope.memberSelected.coupons = _.filter($scope.memberSelected.coupons, function (coupon) {
                    return coupon.useFlag !== "used";
                });
            }

            function _filterPresent() {
                $scope.memberSelected.presents = _.filter($scope.memberSelected.presents, function (present) {
                    return present.balance > 0;
                });
            }
        };

        $scope.markMemberSomeFlag = function () {
            if (_.isEmpty($scope.memberSelected)) {
                return;
            }

            var memberSelected = $scope.memberSelected;

            var flag = {
                isSingleCard: memberSelected.cards.length === 1,
                isNoCard: memberSelected.cards.length === 0,
                isMultiCard: memberSelected.cards.length > 1,
                hasPresentService: memberSelected.presents.length > 0,
                hasCoupon: memberSelected.coupons.length > 0,
                hasDeposit: memberSelected.deposits.length > 0
            };

            _.extend($scope.memberSelected, flag);
        };

        $scope.handleMemberRechargeCard = function () {
            if (!$scope.isMemberSelected()) {
                return;
            }

            var rechargeCards = _.filter($scope.memberSelected.cards, function (card) {
                return card.cateType === "recharge";
            });

            var totalBalance = 0;
            var discountOfOneCard = 10;

            _.each(rechargeCards, function (card) {
                totalBalance += card.balance;
                discountOfOneCard = card.discounts;
            });

            $scope.memberSelected.rechargeCards = rechargeCards;
            $scope.memberSelected.discountOfOneCard = discountOfOneCard;
            $scope.memberSelected.totalBalance = totalBalance;
        };

        $scope.queryAndSelectedMember = function (memberId, callback) {
            callback = callback || function () {
                };

            memberDao.queryMemberById(memberId, function (error, result) {
                if (error) {
                    callback(error);
                    return;
                }

                _keepMemberSomeOldAttr(result);

                $scope.memberSelected = result;

                $scope.filterMemberIrrelevance();
                $scope.markMemberSomeFlag();
                $scope.handleMemberRechargeCard();
                $scope.choiceMemberRelItem();

                $scope.calculateAmount();
                $scope.digestScope();

                callback(null);
            });

            function _keepMemberSomeOldAttr(newResult) {
                if (!$scope.isMemberSelected() || $scope.memberSelected.id !== newResult.id) {
                    return;
                }

                _keepPrivilegeUsed();
                _keepItemPayCardReferenceRight();

                // 保持生日特权继续使用
                function _keepPrivilegeUsed() {
                    if (!$scope.memberSelected.usedPrivilegeFlag) {
                        return;
                    }

                    _.each(newResult.cards, function (card) {
                        if (card.cateType !== 'recharge') {
                            return;
                        }

                        card.originalDiscountType = card.discountType;
                        card.originalDiscountInfo = card.discountInfo;
                        card.originalDiscounts = card.discounts;

                        card.discountType = "standard";
                        card.discountInfo = window.featureConf.defaultDiscount / 2;
                        card.discounts = window.featureConf.defaultDiscount / 2;
                    });

                    newResult.usedPrivilegeFlag = true;
                }

                function _keepItemPayCardReferenceRight() {
                    if (!$scope.isMultiCardMember()) {
                        return;
                    }

                    _.each($scope.buyProductRecords, function (item) {
                        if (_.isEmpty(item.payCardList)) {
                            return;
                        }

                        var payCard = _.isEmpty(_.find(item.payCardList, function (one) {
                            return _.contains(['rechargeCard', 'recordCard', 'quarterCard'], one.payInfo.payType);
                        }));
                        if (_.isEmpty(payCard)) {
                            return;
                        }

                        var needDeleteRef = [];
                        _.each(item.payCardList, function (one) {
                            var newCardReference = _.find(newResult.cards, function (card) {
                                return one.payCard.id === card.id;
                            });

                            if (_.isEmpty(newCardReference)) {
                                needDeleteRef.push(one);
                                return;
                            }

                            one.payCard = newCardReference;
                        });

                        _.each(needDeleteRef, function (oneRef) {
                            item.payCardList = _.without(item.payCardList, oneRef);
                        });
                    });
                }
            }
        };

        //选择会员确定按钮
        $scope.selMemberConfirm = function (callback) {
            callback = _.isFunction(callback) ? callback : (function () {
            });

            if (_.isEmpty($scope.view.memberSelected)) {
                $scope.showDialogError("#m-pos-member-popup", $.i18n.t("member.please_choose_a_member"));
                return;
            }

            _resetMemberStatus();

            var memberId = $scope.view.memberSelected.id;

            utils.showWaitTips("#pos-member-search-list", 24, "正在加载会员详情", "dialog");
            $scope.queryAndSelectedMember(memberId, function (error) {
                utils.hideWaitTips("#pos-member-search-list");

                if (error) {
                    utils.log("m-pos fragment-member.js selMemberConfirm._handMemberCard", error);
                    $scope.showDialogError("#m-pos-member-popup", error.errorMsg || "会员信息查询失败");
                    callback(error);
                    return;
                }

                $scope.modalDialogClose();
                $scope.multiCardAutoMatch();

                $scope.digestScope();
                callback(null);
            });

            function _resetMemberStatus() {
                $scope.payStatus.billDiscount = featureConf.defaultDiscount;//清除上一张会员卡留下来的折扣
                $scope.payStatus.cardPay = 0;
                $scope.payStatus.couponPayList = [];//清除上一个会员的现金券
                $scope.removeAllItemPayInfo();
            }
        };

        $scope.isProductCannotPayByCard = function (product) {
            return product.cannotUseCard;
        };

        $scope.existCannotPayByCardProduct = function () {
            var existProduct = _.find($scope.buyProductRecords, function (pro) {
                return $scope.isProductCannotPayByCard(pro);
            });

            return !_.isEmpty(existProduct);
        };

        //是否选中会员
        $scope.isMemberSelected = function () {
            return !_.isEmpty($scope.memberSelected);
        };

        $scope.isTempMember = function () {
            return $scope.isMemberSelected() && $scope.memberSelected.tempFlag;
        };

        $scope.isNoCardMember = function () {
            return $scope.isMemberSelected() && $scope.memberSelected.isNoCard && !$scope.memberSelected.hasPresentService;
        };

        //是否是单卡会员
        $scope.isSingleCardMember = function () {
            return $scope.isMemberSelected() && $scope.memberSelected.isSingleCard && !$scope.existCannotPayByCardProduct() && !$scope.memberSelected.hasPresentService;
        };

        $scope.isMultiCardMember = function () {
            //会员消费不能使用会员卡支付的项目，按照多卡流程的方式收银
            return $scope.isMemberSelected()
                && ($scope.memberSelected.isMultiCard || ($scope.existCannotPayByCardProduct() && !$scope.isNoCardMember()) || $scope.memberSelected.hasPresentService);
        };

        //是否是计次卡
        $scope.isRecordCard = function (memberCard) {
            return (!_.isEmpty(memberCard) && memberCard.cateType === "record");
        };

        //是否是充值卡
        $scope.isRechargeCard = function (memberCard) {
            return (!_.isEmpty(memberCard) && memberCard.cateType === "recharge");
        };

        //年/季卡
        $scope.isQuarterCard = function (memberCard) {
            return (!_.isEmpty(memberCard) && memberCard.cateType === "quarter");
        };

        //单充值卡会员
        $scope.isSingleRechargeCardMember = function () {
            return $scope.isMemberSelected() && $scope.isSingleCardMember() && $scope.memberSelected.cards[0].cateType === "recharge";
        };

        //单计次卡会员
        $scope.isSingleRecordCardMember = function () {
            return $scope.isMemberSelected() && $scope.isSingleCardMember() && $scope.memberSelected.cards[0].cateType === "record"
        };

        //单年卡会员
        $scope.isSingleQuarterCardMember = function () {
            return $scope.isMemberSelected() && $scope.isSingleCardMember() && $scope.memberSelected.cards[0].cateType === "quarter"
        };

        $scope.needToConfirmPassword = function () {
            return $scope.isMemberSelected() && !_.isEmpty($scope.memberSelected.password);
        };

        $scope.isEmpty = function (obj) {
            return _.isEmpty(obj);
        };

        //查询会员
        $scope.searchMember = function (keyword) {
            if ($scope.searchMember.doing) {
                return;
            }
            $scope.searchMember.doing = true;

            utils.showWaitTips("#pos-member-search-list", 24, "正在搜索", "none");
            memberDao.searchMember(keyword, function (error, result) {
                utils.hideWaitTips("#pos-member-search-list");

                if (error) {
                    $scope.searchMember.doing = false;
                    $scope.showDialogError("#m-pos-member-popup", $.i18n.t("checkout.error_2"));//"会员信息查询失败，请稍后再试"
                    utils.log("m-pos checkout.js searchMember.featureDataI.searchMember", error);
                    return;
                }

                $scope.searchMember.doing = false;
                $scope.memberList = result;

                if (!_.isEmpty($scope.memberList)) {
                    $scope.selectMember($scope.memberList[0]);
                }

                $scope.digestScope();
            });
        };

        //监听会员查询输入
        $scope.$watch("memberSearch", function (newVal) {
            var charLen = newVal.length;
            var chineseCount = escape(newVal).split("%u").length - 1;
            var englishCount = 0;

            if (charLen >= 4) {
                _.each(newVal, function (item) {
                    var charCode = item.charCodeAt(0);

                    if ((charCode >= 65 && charCode <= 90) || (charCode >= 97 && charCode <= 122)) {
                        englishCount++;
                    }
                });
            }

            if (chineseCount > 0 || charLen >= 4 || englishCount >= 4) {
                //$scope.newVal用于延迟处理查询、防止在连续输入时查询开销过大
                if ($scope.view.previousSearch) {
                    clearTimeout($scope.view.previousSearch);
                }

                $scope.view.previousSearch = setTimeout(function () {
                    $scope.searchMember(newVal);
                }, 800);
            }
        }, false);

        $scope.memberSearchInput = function (key) {
            $scope.memberSearch = numKeyboard.clickKey(key);
        };

        //使用系统键盘输入会员搜索条件
        $scope.inputSearchSysKey = function () {
            numKeyboard.resetBoard();
        };

        $scope.clearMemberSearch = function () {
            $scope.memberSearch = "";
            numKeyboard.resetBoard();
        };

        $scope.modifyItemDiscount = function (item, pay) {
            $scope.flipToEdit();
            $scope.view.preparePayItem = item;
            $scope.modifyItemDiscount.modifyPay = pay;

            $scope.multiCardCurrentEditItem = {
                discount: pay.payInfo.discount || (pay.payInfo.discount === 0 ? 0 : 10),
                reduceMoney: pay.payInfo.reduceMoney || 0,
                name: item.name
            };
        };

        $scope.discountReduceModifyCommit = function () {
            if (!validateDisReduce()) {
                return;
            }

            var preparePayItem = $scope.view.preparePayItem;
            var preparePayCard = $scope.modifyItemDiscount.modifyPay.payCard;
            var payInfo = $scope.modifyItemDiscount.modifyPay.payInfo;

            //减去该卡在其他项目上支付的金额
            var approvePayMoney = preparePayCard.balance - $scope.cardTotalPayWithoutItem(preparePayCard.id, preparePayItem);//可支付的会员卡余额

            var discount = $scope.multiCardCurrentEditItem.discount || ($scope.multiCardCurrentEditItem.discount === 0 ? 0 : 10);

            if (preparePayItem.noDiscount) {
                discount = 10;
            }

            var reduceMoney = $scope.multiCardCurrentEditItem.reduceMoney || 0;

            var remaining = $scope.itemUnpaidRemainingMoneyWithoutOnePay(preparePayItem);
            var shouldPayMoney = (remaining * discount / 10) - reduceMoney;

            var payMoney = shouldPayMoney;
            //判断充值卡卡是否足够支付
            if (shouldPayMoney > approvePayMoney) {
                if (window.featureConf.itemOnlyPayByOneCard) {
                    var msg = $("#card_balance_short").show();
                    setTimeout(function () {
                        msg.hide();
                    }, 2000);
                    return;
                }

                payMoney = approvePayMoney;
            }

            //减免输入过大
            if (payMoney < 0) {
                payMoney = 0;
            }

            payInfo.discount = discount;
            payInfo.reduceMoney = reduceMoney;
            payInfo.cardPayMoney = utils.toDecimalDigit(payMoney);
            $scope.calculateAmount();
            $scope.digestScope();
            $scope.flipToCardList();


            function validateDisReduce() {
                $("#m-pos-member-card-select .error").hide();

                var disValidate = utils.checkNum($scope.multiCardCurrentEditItem.discount, 0, 10);

                if (!disValidate) {
                    $("#m-pos-member-card-select .multi-discount-error").show();
                }

                var reduceValidate = utils.checkNum($scope.multiCardCurrentEditItem.reduceMoney, 0, 100000);

                if (!reduceValidate) {
                    $("#m-pos-member-card-select .multi-reduce-error").show();
                }

                return disValidate && reduceValidate;
            }
        };

        // 计次服务剩余次数
        $scope.recordServiceRemainingTimes = function (recordBalance, serviceId) {
            var remainingTimes = 0;

            _.each(recordBalance, function (oneGroup) {
                var belongThisGroup = _.contains(_.pluck(oneGroup.services, "id"), serviceId);

                if (belongThisGroup) {
                    remainingTimes = oneGroup.times || 0;
                }
            });

            return remainingTimes;
        };

        $scope.quarterCardId2ActiveTimes = function () {
            var quarterCardId2ActiveTimes = {};

            var quarterCardList = _.filter($scope.memberSelected.cards, function (card) {
                return card.cateType === "quarter";
            });

            _.each(quarterCardList, function (card) {
                quarterCardId2ActiveTimes[card.id] = card.timesLimit - card.balance;
            });

            return utils.deepClone(quarterCardId2ActiveTimes);
        };

        // 计次服务属于哪一组，－1表示没有找到相应组
        $scope.recordServiceGroup = function (recordCard, serviceId) {
            var group = -1;

            _.each(recordCard.recordBalance, function (oneGroup) {
                var belongThisGroup = _.contains(_.pluck(oneGroup.services, "id"), serviceId);

                if (belongThisGroup) {
                    group = oneGroup.bind_group;
                }
            });

            return group;
        };

        $scope.isRecordContainsService = function (recordCard, serviceId) {
            var allContainsIds = [];

            _.each(recordCard.recordBalance, function (balance) {
                allContainsIds = allContainsIds.concat(_.pluck(balance.services, "id"));
            });

            return _.contains(allContainsIds, serviceId);
        };

        $scope.getRecordContainsServiceBalance = function (recordCard, serviceId) {
            var result = null;

            _.each(recordCard.recordBalance, function (balance) {
                if (_.contains(_.pluck(balance.services, "id"), serviceId)) {
                    result = balance;
                }
            });

            return result;
        };

        $scope.isQuarterContainsService = function (quarterCard, serviceId) {
            var allContainsIds = [];

            _.each(quarterCard.quarterUsed, function (used) {
                allContainsIds = allContainsIds.concat(_.pluck(used.services, "id"));
            });

            return _.contains(allContainsIds, serviceId);
        };

        $scope.quarterServicePerformance = function (quarterCard, serviceId) {
            var performance = 0;

            if (_.isEmpty(quarterCard.serviceId2Bonus)) {
                return 0;
            }

            var bonusInfo = quarterCard.serviceId2Bonus[serviceId];

            if (bonusInfo && bonusInfo.bonusMode === "performance") {
                performance = bonusInfo.bonusValue || 0;
            }

            return performance;
        };

        $scope.flipToEdit = function () {
            $("#m-pos-member-card-select #front").removeClass("normal").addClass("flipped");
            $("#m-pos-member-card-select #back").removeClass("flipped").addClass("normal");
        };

        $scope.flipToCardList = function () {
            $("#m-pos-member-card-select #back").removeClass("normal").addClass("flipped");
            $("#m-pos-member-card-select #front").removeClass("flipped").addClass("normal");
        };

        $scope.birthdayPrivilege = function () {
            if ($scope.memberSelected.usedPrivilegeFlag) {
                _unusedPrivilege();
            }
            else {
                _usedPrivilege();
            }

            $scope.memberSelected.usedPrivilegeFlag = !$scope.memberSelected.usedPrivilegeFlag;

            function _usedPrivilege() {
                _.each($scope.memberSelected.cards, function (card) {
                    if (card.cateType !== 'recharge') {
                        return;
                    }

                    card.originalDiscountType = card.discountType;
                    card.originalDiscountInfo = card.discountInfo;
                    card.originalDiscounts = card.discounts;

                    card.discountType = "standard";
                    card.discountInfo = window.featureConf.defaultDiscount / 2;
                    card.discounts = window.featureConf.defaultDiscount / 2;
                });
            }

            function _unusedPrivilege() {
                _.each($scope.memberSelected.cards, function (card) {
                    if (card.cateType !== 'recharge') {
                        return;
                    }

                    card.discountType = card.originalDiscountType;
                    card.discountInfo = card.originalDiscountInfo;
                    card.discounts = card.originalDiscounts;
                });
            }

            $scope.handleMemberRechargeCard();

            $scope.removeAllItemPayInfo();
            $scope.multiCardAutoMatch();

            $scope.calculateAmount();
            $scope.digestScope();
        };

        $scope.onlyCardUpGrade = function (card) {
            var upGradeModel = {};

            upGradeModel.id = card.id;
            upGradeModel.cardCate = _.find($scope.rechargeCateList, function (item) {
                return item.id === card.cateId;
            });
            upGradeModel.oldCardCate = upGradeModel.cardCate;
            $scope.view.upGradeModel = upGradeModel;

            utils.openFancyBox("#m-pos-card-up-grade");
        };

        $scope.selectMemberCate = function (cardCate) {
            $scope.view.upGradeModel.cardCate = cardCate;
        };

        $scope.upGradeCardCommit = function () {
            var upgradeModel = $scope.view.upGradeModel;

            var model = _prepareModel();

            utils.showWaitTips("#m-pos-card-up-grade", 24, "正在提交", "dialog");
            async.series([_upgrade, _refreshMember], function (error) {
                utils.hideWaitTips("#m-pos-card-up-grade");

                if (error) {
                    utils.showGlobalMsg(error.errorMsg || "会员卡升级失败，请稍后再试");
                    return;
                }

                utils.showGlobalSuccessMsg("会员卡升级成功");
            });

            function _upgrade(callback) {
                memberDao.updateMemberCard(model, callback);
            }

            function _refreshMember(callback) {
                $scope.queryAndSelectedMember($scope.memberSelected.id, function (error) {
                    if (error) {
                        callback(error);
                        return;
                    }

                    $scope.removeAllItemPayInfo();
                    $scope.multiCardAutoMatch();
                    callback(null);
                });
            }

            function _prepareModel() {
                var memberCard = {};
                memberCard.id = upgradeModel.id;
                memberCard.cateType = "recharge";
                memberCard.memberCardCategoryId = upgradeModel.cardCate.id;
                memberCard.memberCardCategoryName = upgradeModel.cardCate.name;

                var upgradeBill = {};
                upgradeBill.amount = 0;
                upgradeBill.member_id = $scope.memberSelected.id;
                upgradeBill.member_name = $scope.memberSelected.name;
                upgradeBill.storeNameSnapshot = $scope.storeInfo.name || "";
                upgradeBill.type = 11; //积分消费
                upgradeBill.comment = upgradeModel.oldCardCate.name + "升级至" + upgradeModel.cardCate.name;
                upgradeBill.memberCard_id = memberCard.id;

                return {
                    upgradeCardBill: upgradeBill,
                    memberCard: memberCard
                }
            }
        };
    }

    exports.initModel = initModel;
    exports.initControllers = initControllers;
});