define(function (require, exports, module) {
    var utils = require("mframework/static/package").utils;

    function initModel(model) {
    }

    function initControllers($scope) {
        //构造收银单的所有信息
        $scope.buildServiceBillInfo = function () {

            var fault = false;

            var billDetail = [];//用于存中间状态

            var disInfo = utils.toDecimalDigit($scope.payStatus.billDiscount);        //商品折扣信息
            var now = new Date();
            var nowMilli = now.getTime();

            var singleCard = {};
            if ($scope.isSingleCardMember()) {
                singleCard = $scope.memberSelected.cards[0];
            }

            var totalRecordPer = 0, totalQuarterPer = 0;
            var cardId2AdjustMoney = {};

            var projectList = _buildProjectList();
            var serviceBill = _buildServiceBill();

            var paymentDetailList = _buildPaymentDetail();

            var cardPaymentList = _buildPaymentCardSnapshot();
            var consumeCardList = _buildConsumeCard();

            var recordCardBalanceList = _buildRecordCardBalance();
            var quarterCardBalanceList = _buildQuarterCardUsed();
            var presentBalanceList = _buildPresentSBalance();

            var billBalanceList = _buildBillBalanceSnapshot();

            var memberScore = _buildMemberScore();

            var usedCouponList = _buildCouponList();

            var depositInfo = _buildDeposit();
            var depositConsumeList = _buildDepositConsume();

            _rebuildCardReduction();
            _rebuildPaymentInfo();
            _rebuildPaymentDetail();

            return {
                fault: fault,
                serviceBill: serviceBill,
                paymentDetailList: paymentDetailList,
                projectList: projectList,
                recordCardBalanceList: recordCardBalanceList,
                quarterCardBalanceList: quarterCardBalanceList,
                presentBalanceList: presentBalanceList,
                billBalanceList: billBalanceList,
                cardPaymentList: cardPaymentList,
                consumeCardList: consumeCardList,
                memberScore: memberScore,
                usedCouponList: usedCouponList,

                depositList: depositInfo.depositList,
                depositItemList: depositInfo.depositItemList,
                depositConsumeList: depositConsumeList
            };

            function _buildProjectList() {
                var projectList = [];

                if ($scope.isMultiCardMember()) {
                    //多卡支付模式
                    _multiCardSplitBillItem();
                }
                else {
                    //单卡会员、或者散客
                    _normalSplitBillItem();
                }

                //原价提成服务业绩按原价来
                if ($scope.bonusMode === "original") {
                    _.each(projectList, function (item) {
                        item.sumMoney = utils.toDecimalDigit(item.def_int1 * item.saleNum);
                    });
                }

                return projectList;

                function _normalSplitBillItem() {
                    var billProject;
                    var proList = $scope.buyProductRecords;
                    var recordProList = [];
                    var quarterProList = [];

                    //区分计次卡会员计次的产品和非计次产品
                    if ($scope.isSingleRecordCardMember()) {
                        proList = JSON.parse(JSON.stringify($scope.view.overProduct));
                        recordProList = JSON.parse(JSON.stringify($scope.view.recordProduct));
                    }

                    //区分年卡会员计次产品和非计次产品
                    if ($scope.isSingleQuarterCardMember()) {
                        proList = JSON.parse(JSON.stringify($scope.view.overProduct));
                        quarterProList = JSON.parse(JSON.stringify($scope.view.recordProduct));
                    }

                    _splitNormalItemList();
                    _splitReduceMoney(projectList);

                    if ($scope.isSingleRecordCardMember()) {
                        _splitRecordItemList();
                    }

                    if ($scope.isSingleQuarterCardMember()) {
                        _splitQuarterItemList();
                    }

                    function _splitNormalItemList() {
                        var itemId2Coupon = $scope.buildItemId2CouponPay(proList);

                        var itemId2CouponPerformance = $scope.buildItemId2CouponPerformance(proList);

                        _.each(proList, function (item) {
                            billProject = _transBillItem(item);

                            var discount;
                            //高级折扣规则、保持billProject中折扣及金额的正确性
                            if ($scope.isSingleRechargeCardMember() && $scope.isAdvancedDisType(singleCard) && !$scope.view.disChangegManually) {
                                discount = singleCard.discountInfo[item.cate_id];
                                if (!discount && discount !== 0) {
                                    discount = 10;
                                }
                                billProject.discounts = discount;
                            }

                            if (item.noDiscount) {
                                billProject.discounts = 10;
                            }

                            var itemCouponPayBefDis = itemId2Coupon[item.id] || 0;

                            var itemCouponPerformance = itemId2CouponPerformance[item.id] || 0;

                            billProject.sumMoney = utils.toDecimalDigit((item.money - itemCouponPayBefDis) * billProject.discounts / 10 + itemCouponPerformance);

                            //同一个项目，部分使用计次卡，部分使用money
                            _.each(recordProList, function (recordPro, index) {
                                if (recordPro.id === item.id) {
                                    var bonusInfo = singleCard.serviceId2Bonus[item.id] || {};
                                    if (bonusInfo.bonusMode === "performance") {
                                        billProject.sumMoney = utils.toDecimalDigit(billProject.sumMoney + bonusInfo.bonusValue * recordPro.saleNum);
                                        totalRecordPer += bonusInfo.bonusValue * recordPro.saleNum;
                                    }

                                    billProject.saleNum += recordPro.saleNum;
                                    recordProList.splice(index, 1);//移除该项
                                }
                            });

                            projectList.push(billProject);
                            billDetail.push(item.name);
                        });
                    }

                    function _splitRecordItemList() {
                        //只由计次卡支付的项目
                        _.each(recordProList, function (item) {
                            billProject = _transBillItem(item);
                            billProject.sumMoney = 0;

                            var bonusInfo = singleCard.serviceId2Bonus[item.id] || {};
                            if (bonusInfo.bonusMode === "performance") {
                                billProject.sumMoney = utils.toDecimalDigit(bonusInfo.bonusValue * item.saleNum);

                                totalRecordPer += billProject.sumMoney;
                            }

                            projectList.push(billProject);
                            billDetail.push(item.name);
                        });
                    }

                    function _splitQuarterItemList() {
                        var quarterItemId2OtherPay = $scope.buildQuarterItemId2OtherPay(quarterProList);
                        var quarterItemI2CouponPay = {};
                        _.each(quarterItemId2OtherPay, function (value, key) {
                            quarterItemI2CouponPay[key] = value.couponPay || 0;
                        });

                        var quarterItemId2CouponPer = $scope.buildItemId2CouponPerformance(quarterProList, quarterItemI2CouponPay);

                        var remainingActiveTimes = singleCard.timesLimit - singleCard.balance;
                        _.each(quarterProList, function (item) {
                            billProject = _transBillItem(item);
                            var performance = $scope.quarterServicePerformance(singleCard, item.id);

                            var quarterPerformance = performance * item.saleNum;

                            if (remainingActiveTimes <= 0) {
                                quarterPerformance = 0;
                            }
                            else if (remainingActiveTimes < item.saleNum) {
                                quarterPerformance = performance * remainingActiveTimes;
                            }

                            remainingActiveTimes -= item.saleNum;

                            billProject.sumMoney = utils.toDecimalDigit(quarterPerformance
                            + quarterItemId2CouponPer[item.id]
                            + quarterItemId2OtherPay[item.id].cashPay
                            + quarterItemId2OtherPay[item.id].bankPay);

                            totalQuarterPer += billProject.sumMoney;

                            projectList.push(billProject);
                            billDetail.push(item.name);
                        });
                    }
                }

                //多卡支付项目处理
                function _multiCardSplitBillItem() {
                    var proList = $scope.buyProductRecords;
                    var hasUnpaidItem = [];

                    var payByMoneyList = $scope.payByMoneyItemList();

                    var itemId2CouponPerformance = $scope.buildItemId2CouponPerformance(payByMoneyList);
                    var itemId2CouponPay = $scope.buildItemId2CouponPay(payByMoneyList);

                    var payByQuarterList = _.filter($scope.buyProductRecords, function (item) {
                        return !_.isEmpty(_.find(item.payCardList, function (one) {
                            return one.payType === 'quarterCard';
                        }));
                    });

                    var quarterItemId2OtherPay = $scope.buildQuarterItemId2OtherPay(payByQuarterList);
                    var quarterItemI2CouponPay = {};
                    _.each(quarterItemId2OtherPay, function (value, key) {
                        quarterItemI2CouponPay[key] = value.couponPay || 0;
                    });

                    var quarterCardId2ActiveTimes = $scope.quarterCardId2ActiveTimes();

                    _.each(proList, function (item) {
                        var billItem = _transBillItem(item);

                        if (_.isEmpty(item.payCardList)) {
                            var discountTemp = disInfo;

                            if (item.noDiscount) {
                                discountTemp = 10;
                            }

                            var itemCouponPay = itemId2CouponPay[item.id] || 0;
                            var itemCouponPerformance = itemId2CouponPerformance[item.id] || 0;
                            billItem.sumMoney = utils.toDecimalDigit((item.money - itemCouponPay) * discountTemp / 10 + itemCouponPerformance);
                            hasUnpaidItem.push(billItem);
                        }
                        else {
                            // 支付方式中有充值卡时就取该折扣，作为tb_billProject中的discounts
                            var rechargePay = _.find(item.payCardList, function (item) {
                                return item.payInfo.payType === 'recharge';
                            });
                            var onlyDiscount = _.isEmpty(rechargePay) ? 10 : rechargePay.payInfo.discount;
                            //选择了会员卡支付
                            billItem.discounts = onlyDiscount || 10;

                            var total = 0;

                            _.each(item.payCardList, function (one) {
                                if (one.payInfo.payType === 'rechargeCard') {
                                    total += one.payInfo.cardPayMoney;
                                }
                                else if (one.payInfo.payType === 'recordCard') {
                                    var bonusInfo = one.payCard.serviceId2Bonus[item.id] || {};
                                    if (bonusInfo.bonusMode === 'performance') {
                                        total += bonusInfo.bonusValue * one.payInfo.cardPayTimes;
                                        totalRecordPer += bonusInfo.bonusValue * one.payInfo.cardPayTimes;
                                    }
                                }
                                else if (one.payInfo.payType === 'quarterCard') {
                                    var performance = $scope.quarterServicePerformance(one.payCard, item.id);

                                    var remainingActiveTimes = quarterCardId2ActiveTimes[one.payCard.id] || 0;
                                    var activeTimes = one.payInfo.cardPayTimes;

                                    if (remainingActiveTimes <= 0) {
                                        activeTimes = 0;
                                    }
                                    else if (remainingActiveTimes < activeTimes) {
                                        activeTimes = remainingActiveTimes;
                                    }

                                    quarterCardId2ActiveTimes[one.payCard.id] -= activeTimes;

                                    total += utils.toDecimalDigit(performance * activeTimes);
                                    totalQuarterPer += utils.toDecimalDigit(performance * activeTimes);
                                }
                                else if (one.payInfo.payType === 'presentService') {
                                    if (one.payCard.bonusMode === 'performance') {
                                        total += utils.toDecimalDigit(one.payCard.bonusValue * one.payInfo.cardPayTimes);
                                    }
                                }
                            });

                            if (!_.isEmpty(itemId2CouponPerformance)) {
                                total += itemId2CouponPerformance[item.id] || 0;
                            }
                            if (!_.isEmpty(quarterItemId2OtherPay[item.id])) {
                                total += quarterItemId2OtherPay[item.id].cashPay + quarterItemId2OtherPay[item.id].bankPay;
                            }

                            var itemUnpaidMoney = $scope.itemUnpaidRemainingMoney(item);
                            if (Math.abs(itemUnpaidMoney) > 0.1) {
                                var performance = itemUnpaidMoney;
                                if (!item.noDiscount && $scope.payStatus.billDiscount) {
                                    performance = itemUnpaidMoney * ($scope.payStatus.billDiscount || 10) / 10;
                                }
                                total += performance;

                                hasUnpaidItem.push(billItem);
                            }

                            billItem.sumMoney = utils.toDecimalDigit(total);
                        }

                        projectList.push(billItem);
                        billDetail.push(item.name);
                    });

                    _splitReduceMoney(hasUnpaidItem);
                }

                //按比例拆分减免金额
                function _splitReduceMoney(itemList) {
                    //减免金额
                    if ($scope.payStatus.billReduce) {
                        var itemTotalMoney = 0;

                        var reduceTemp = 0, reducedMoney = 0;

                        _.each(itemList, function (item) {
                            itemTotalMoney += $scope.itemUnpaidRemainingMoney(item);
                        });

                        _.each(itemList, function (item, index) {
                            //为保持帐平、在分配减免金额时需要特殊处理、如100平分三分为33.3 33.3 33.4
                            if (index === itemList.length - 1) {
                                item.sumMoney = utils.toDecimalDigit(item.sumMoney - ($scope.payStatus.billReduce - reducedMoney));
                            }
                            else {
                                reduceTemp = utils.toDecimalDigit($scope.payStatus.billReduce * ($scope.itemUnpaidRemainingMoney(item) / itemTotalMoney));
                                reducedMoney += reduceTemp;
                                item.sumMoney = utils.toDecimalDigit(item.sumMoney - reduceTemp);
                            }

                            //减免金额超出应收时
                            if (item.sumMoney < 0) {
                                item.sumMoney = 0;
                            }
                        });
                    }

                    //将应收的四舍五入调整的钱算在第一个项目上
                    if (!_.isEmpty(itemList)) {
                        itemList[0].sumMoney += $scope.view.adjustMoney;
                    }
                }

                //转换消费项目
                function _transBillItem(item) {
                    var originPrice = item.unitPrice;
                    if ($scope.productList[item.id]) {
                        originPrice = $scope.productList[item.id].prices_salesPrice;
                    }

                    var product = _.find($scope.buyProductRecords, function (product) {
                        return product.id === item.id;
                    });

                    if (product.oldPrice || product.oldPrice == 0) {
                        originPrice = product.oldPrice;
                    }

                    // 免费项目对应的业绩
                    var originalPerformance = 0;
                    if (originPrice === 0) {
                        originalPerformance = item.originalPerformance * item.saleNum;
                    }

                    return {
                        project_id: item.id,
                        employee_id: item.serviceEmployee.id,
                        saleNum: item.saleNum,
                        unitPrice: item.unitPrice,
                        discounts: disInfo,
                        sumMoney: utils.toDecimalDigit((item.money * disInfo / 10)),
                        dateTime: now.getTime(),
                        month: now.getMonth() + 1,
                        day: now.getDate(),
                        weekDay: now.getDay(),
                        project_name: item.name,
                        project_cateId: item.cate_id,
                        project_cateName: item.cate_name,
                        create_date: nowMilli,
                        type: item.type,
                        def_int1: originPrice,
                        def_int2: originalPerformance,
                        markId: uuid.v1(),
                        relatedCardId: item.relatedCardId
                    };
                }
            }

            function _buildServiceBill() {
                var serviceBill = {};

                var totalCouponPer = 0;
                _.each($scope.payStatus.couponPayList, function (item) {
                    if (item.bonusMode === "performance") {
                        totalCouponPer += item.bonusValue;
                    }
                });

                serviceBill.amount = utils.toDecimalDigit($scope.incomeStatus.paidMoney + totalCouponPer);//现金券支付100，可能只算50业绩
                serviceBill.pay_coupon = utils.toDecimalDigit($scope.pay.coupon);
                serviceBill.pay_cash = utils.toDecimalDigit($scope.pay.cash);
                serviceBill.pay_prePaidCard = utils.toDecimalDigit($scope.pay.prePaidCard);
                serviceBill.pay_bankAccount_money = utils.toDecimalDigit($scope.pay.bank);
                serviceBill.dateTime = nowMilli;
                serviceBill.discount = disInfo;
                serviceBill.reduceMoney = utils.toDecimalDigit($scope.payStatus.billReduce);
                serviceBill.befDisMoney = utils.toDecimalDigit($scope.incomeStatus.totalMoney);
                serviceBill.create_date = nowMilli;
                serviceBill.description = $scope.checkoutCustomComment || "";
                serviceBill.comment = billDetail.join(",");//消费项目列表
                serviceBill.storeNameSnapshot = $scope.storeInfo.name || "";

                serviceBill.presentScore = $scope.incomeStatus.rechargeCardPresentScore;
                serviceBill.currentScore = ($scope.memberSelected.currentScore || 0) + serviceBill.presentScore;

                //会员消费
                if ($scope.isMemberSelected()) {
                    serviceBill.member_id = $scope.memberSelected.id;
                    serviceBill.member_name = $scope.memberSelected.name;
                    serviceBill.memberNo = $scope.memberSelected.memberNo;
                    serviceBill.usedPrivilege = $scope.memberSelected.usedPrivilegeFlag;
                    if (serviceBill.usedPrivilege) {
                        serviceBill.presentScore *= 2;
                    }
                }

                //单计次卡会员处理
                if ($scope.isSingleRecordCardMember()) {
                    serviceBill.amount = utils.toDecimalDigit(serviceBill.amount + totalRecordPer);//计次卡折算出来的业绩
                    serviceBill.def_int1 = utils.toDecimalDigit($scope.pay.cardTimes);//计次卡消费次数
                }

                //单年卡会员
                if ($scope.isSingleQuarterCardMember()) {
                    serviceBill.amount = utils.toDecimalDigit(serviceBill.amount + totalQuarterPer);//年卡折算出来的金额
                    serviceBill.def_int3 = utils.toDecimalDigit($scope.pay.quarterCardTimes);//年卡消费次数
                }

                //多卡支付会员处理
                if ($scope.isMultiCardMember()) {
                    //将计次卡支付的钱折算成业绩，存入amount
                    var cardPayPer = $scope.pay.prePaidCard - $scope.incomeStatus.recordCard + totalRecordPer + totalQuarterPer;

                    serviceBill.amount = utils.toDecimalDigit(serviceBill.amount + cardPayPer + _calculatePresentPer());
                    serviceBill.def_int1 = $scope.pay.cardTimes;//计次卡消费次数
                    serviceBill.discount = 10;

                    serviceBill.def_int2 = $scope.incomeStatus.presentSPayTimes;//使用赠送服务次数
                    serviceBill.def_int3 = $scope.pay.quarterCardTimes;

                    var payHasReduceMoney = _.filter($scope.buyProductRecords, function (item) {
                        return !_.isEmpty(_.find(item.payCardList, function (one) {
                            return one.payInfo.payType === 'recharge' && one.payInfo.reduceMoney !== 0;
                        }));
                    });

                    if (!_.isEmpty(payHasReduceMoney)) {
                        _.each(payHasReduceMoney, function (item) {
                            var total = 0;
                            _.each(item.payCardList, function (one) {
                                total += one.payInfo.reduceMoney;
                            });

                            serviceBill.reduceMoney += total || 0;
                        });
                        serviceBill.reduceMoney = utils.toDecimalDigit(serviceBill.reduceMoney);
                    }
                }

                //原价提成服务业绩按原价来
                if ($scope.bonusMode === "original") {
                    serviceBill.amount = 0;
                    _.each(projectList, function (item) {
                        serviceBill.amount += item.sumMoney;
                    });
                    serviceBill.amount = utils.toDecimalDigit(serviceBill.amount);
                }

                return serviceBill;

                //计算赠送服务对应的经营业绩
                function _calculatePresentPer() {
                    var totalPerformance = 0;
                    _.each($scope.buyProductRecords, function (item) {
                        _.each(item.payCardList, function (one) {
                            if (one.payInfo.payType === 'presentService' && one.payCard.bonusMode === 'performance') {
                                totalPerformance += one.payCard.bonusValue;
                            }
                        });
                    });

                    return totalPerformance;
                }
            }

            //填充卡支付信息详情快照、
            function _buildPaymentDetail() {
                var paymentDetailList = [];

                if (!$scope.isMemberSelected() || $scope.isNoCardMember()) {
                    _prepareNoCardPaymentDetail();
                }

                if ($scope.isSingleRechargeCardMember()) {
                    _prepareRechargeCardPaymentDetail()
                }

                if ($scope.isSingleRecordCardMember()) {
                    _prepareRecordCardPaymentDetail()
                }

                if ($scope.isSingleQuarterCardMember()) {
                    _prepareQuarterCardPaymentDetail();
                }

                if ($scope.isMultiCardMember()) {
                    _prepareMultiCardPaymentDetail();
                }

                return paymentDetailList;

                function _prepareNoCardPaymentDetail() {
                    var itemIdList = _.pluck($scope.buyProductRecords, "id");
                    var itemList = _.filter(projectList, function (item) {
                        return _.contains(itemIdList, item.project_id);
                    });

                    _spliceCashBankCouponPaymentDetail(itemList);
                }

                function _prepareRechargeCardPaymentDetail() {
                    var cardId = singleCard.id || "";

                    _spliceCashBankCouponPaymentDetail(projectList);

                    var totalItemMoney = 0;
                    _.each(projectList, function (item) {
                        totalItemMoney += item.sumMoney;
                    });

                    var assignedCard = 0;

                    _.each(projectList, function (item, index) {
                        var exitPaymentDetail = _.find(paymentDetailList, function (paymentDetail) {
                            return item.project_id === paymentDetail.service_id && item.markId === paymentDetail.markId;
                        });

                        var payCard = utils.toDecimalDigit((item.sumMoney / totalItemMoney) * serviceBill.pay_prePaidCard);

                        exitPaymentDetail.memberCard_id = cardId;
                        if (projectList.length - 1 !== index) {
                            assignedCard = utils.toDecimalDigit(assignedCard + payCard);
                            exitPaymentDetail.card_pay_money = payCard;
                        }
                        else {
                            exitPaymentDetail.card_pay_money = utils.toDecimalDigit(serviceBill.pay_prePaidCard - assignedCard);
                        }
                    });
                }

                function _prepareRecordCardPaymentDetail() {
                    var recordItemList = $scope.view.recordProduct;//使用计次卡的项目

                    var overItemList = _.filter(projectList, function (project) {
                        var existsInOver = _.find($scope.view.overProduct, function (item) {
                            return _isItemSameWithProject(item, project);
                        });

                        return !_.isEmpty(existsInOver);
                    });

                    _spliceCashBankCouponPaymentDetail(overItemList);

                    var cardId = singleCard.id || "";

                    _.each(recordItemList, function (item) {
                        var existProject = _.find(projectList, function (project) {
                                return _isItemSameWithProject(item, project);
                            }) || {};

                        var paymentDetailExist = _.find(paymentDetailList, function (paymentDetail) {
                            return item.id === paymentDetail.service_id && existProject.markId === paymentDetail.markId;
                        });

                        var times = item.saleNum;
                        var times2Money = utils.toDecimalDigit(item.saleNum * singleCard.recordAvgPrice);

                        if (!_.isEmpty(paymentDetailExist)) {
                            paymentDetailExist.memberCard_id = cardId;
                            paymentDetailExist.card_pay_times = times;
                            paymentDetailExist.times_2_money = times2Money;
                        }
                        else {
                            paymentDetailList.push(_transPaymentDetail(existProject.markId, item.id, 0, 0, 0, cardId, 0, times, times2Money));
                        }
                    });
                }

                function _prepareQuarterCardPaymentDetail() {
                    var recordItemList = $scope.view.recordProduct;//使用计次卡的项目

                    var overItemList = _.filter(projectList, function (project) {
                        var existsInOver = _.find($scope.view.overProduct, function (item) {
                            return _isItemSameWithProject(item, project);
                        });

                        return !_.isEmpty(existsInOver);
                    });
                    _spliceCashBankCouponPaymentDetail(overItemList);

                    var itemId2OtherPay = $scope.buildQuarterItemId2OtherPay(recordItemList);

                    var cardId = singleCard.id || "";

                    var remainingActiveTimes = singleCard.timesLimit - singleCard.balance;

                    _.each(recordItemList, function (item) {
                        var activeTimes = item.saleNum;
                        var inactiveTimes = 0;

                        if (remainingActiveTimes <= 0) {
                            activeTimes = 0;
                            inactiveTimes = item.saleNum;
                        }
                        else if (remainingActiveTimes < activeTimes) {
                            activeTimes = remainingActiveTimes;
                            inactiveTimes = item.saleNum - remainingActiveTimes;
                        }

                        var times2Money = utils.toDecimalDigit(activeTimes * singleCard.timesAvgPrice);

                        remainingActiveTimes -= activeTimes;

                        var itemCashPay = itemId2OtherPay[item.id].cashPay || 0;
                        var itemBankPay = itemId2OtherPay[item.id].bankPay || 0;
                        var itemCouponPay = itemId2OtherPay[item.id].couponPay || 0;

                        var existProject = _.find(projectList, function (oneProject) {
                                return _isItemSameWithProject(item, oneProject);
                            }) || {};

                        var paymentDetail = _transPaymentDetail(existProject.markId, item.id, itemCashPay, itemBankPay, itemCouponPay, cardId, 0, item.saleNum, times2Money);
                        paymentDetail.inactiveTimes = inactiveTimes;
                        paymentDetail.inactiveMoney = inactiveTimes * singleCard.timesAvgPrice;

                        paymentDetailList.push(paymentDetail);
                    });
                }

                function _prepareMultiCardPaymentDetail() {
                    var cardPayItemList = _.filter($scope.buyProductRecords, function (item) {
                        return !_.isEmpty(item.payCardList);
                    });

                    var couponPayItemList = $scope.payByMoneyItemList();

                    var hasUnpaidMoney = _.filter(projectList, function (project) {
                        var existItem = _.find($scope.buyProductRecords, function (item) {
                            return _isItemSameWithProject(item, project);
                        });

                        return !_.isEmpty(existItem) && Math.abs($scope.itemUnpaidRemainingMoney(existItem)) > 0.1;
                    });

                    _spliceCashBankCouponPaymentDetail(hasUnpaidMoney, couponPayItemList);

                    var itemId2CouponPay = $scope.buildItemId2CouponPay(couponPayItemList);

                    _.each(cardPayItemList, function (item) {
                        var times, times2Money;

                        var existProject = _.find(projectList, function (project) {
                                return _isItemSameWithProject(item, project);
                            }) || {};

                        _.each(item.payCardList, function (one) {
                            if (one.payInfo.payType === "rechargeCard") {
                                var cardId = one.payCard.id;
                                var payCard = one.payInfo.cardPayMoney;

                                var sameItem = _.find(paymentDetailList, function (item) {
                                    return existProject.markId === item.markId;
                                });

                                var couponPay = _.isEmpty(sameItem) ? (itemId2CouponPay[item.id] || 0) : 0;
                                paymentDetailList.push(_transPaymentDetail(existProject.markId, item.id, 0, 0, couponPay, cardId, payCard));
                            }
                            else if (one.payInfo.payType === "recordCard") {
                                times = one.payInfo.cardPayTimes;
                                times2Money = utils.toDecimalDigit(one.payInfo.cardPayTimes * one.payCard.recordAvgPrice);

                                paymentDetailList.push(_transPaymentDetail(existProject.markId, item.id, 0, 0, 0, one.payCard.id, 0, times, times2Money));
                            }
                            else if (one.payInfo.payType === "quarterCard") {
                                //_handleQuarterCashBank();
                            }
                            else if (one.payInfo.payType === "presentService") {
                                paymentDetailList.push(_transPaymentDetail(existProject.markId, item.id, 0, 0, 0, one.payCard.sequenceId, 0, -(one.payInfo.cardPayTimes), 0));
                            }
                        });
                    });

                    _handleQuarterCashBank();

                    function _handleQuarterCashBank() {
                        var cardId2ActiveTimes = $scope.quarterCardId2ActiveTimes();

                        var quarterPayItemList = _.filter($scope.buyProductRecords, function (item) {
                            return !_.isEmpty(_.find(item.payCardList, function (one) {
                                return one.payInfo.payType === 'quarterCard';
                            }));
                        });

                        var itemId2OtherPay = $scope.buildQuarterItemId2OtherPay(quarterPayItemList);

                        _.each(quarterPayItemList, function (item) {
                            var existProject = _.find(projectList, function (project) {
                                    return _isItemSameWithProject(item, project);
                                }) || {};

                            _.each(item.payCardList, function (one) {
                                if (one.payInfo.payType !== 'quarterCard') {
                                    return;
                                }

                                var activeTimes = cardId2ActiveTimes[one.payCard.id];

                                var times = one.payInfo.cardPayTimes;
                                var times2Money = times * one.payCard.timesAvgPrice;
                                var inactiveTimes = 0;

                                if (activeTimes < 0) {
                                    times2Money = 0;
                                    inactiveTimes = times;
                                }
                                else if (activeTimes < times) {
                                    times2Money = activeTimes * one.payCard.timesAvgPrice;
                                    inactiveTimes = times - activeTimes;
                                }

                                cardId2ActiveTimes[one.payCard.id] -= times;

                                var itemCashPay = itemId2OtherPay[item.id].cashPay || 0;
                                var itemBankPay = itemId2OtherPay[item.id].bankPay || 0;
                                var itemCouponPay = itemId2OtherPay[item.id].couponPay || 0;

                                var paymentDetail = _transPaymentDetail(existProject.markId, item.id, itemCashPay, itemBankPay, itemCouponPay, one.payCard.id, 0, times, times2Money);
                                paymentDetail.inactiveTimes = inactiveTimes;
                                paymentDetail.inactiveMoney = inactiveTimes * one.payCard.timesAvgPrice;

                                paymentDetailList.push(paymentDetail);
                            });
                        });
                    }
                }

                function _spliceCashBankCouponPaymentDetail(cashBankItemList, couponItemList) {
                    if (_.isEmpty(couponItemList)) {
                        var itemIdList = _.pluck(cashBankItemList, "project_id");
                        couponItemList = _.filter($scope.buyProductRecords, function (item) {
                            return _.contains(itemIdList, item.id);
                        });
                    }
                    var itemId2CouponPay = $scope.buildItemId2CouponPay(couponItemList);

                    var totalItemMoney = 0;

                    _.each(cashBankItemList, function (item) {
                        totalItemMoney += item.sumMoney;
                    });

                    var assignedCash = 0, assignedBank = 0;

                    var totalCash = serviceBill.pay_cash;
                    var totalBank = serviceBill.pay_bankAccount_money;

                    if ($scope.incomeStatus.quarterOweMoney > 0) {
                        if ($scope.incomeStatus.quarterOweMoney <= totalCash) {
                            totalCash = utils.toDecimalDigit(totalCash - $scope.incomeStatus.quarterOweMoney);
                        }
                        else {
                            totalCash = 0;
                            totalBank = utils.toDecimalDigit(totalBank - ($scope.incomeStatus.quarter - totalCash));
                        }
                    }

                    _.each(cashBankItemList, function (item, index) {
                        var payCash = utils.toDecimalDigit((item.sumMoney / totalItemMoney) * totalCash);
                        var payBank = utils.toDecimalDigit((item.sumMoney / totalItemMoney) * totalBank);
                        var payCoupon = itemId2CouponPay[item.project_id] || 0;

                        if (cashBankItemList.length - 1 !== index) {
                            assignedCash = utils.toDecimalDigit(assignedCash + payCash);
                            assignedBank = utils.toDecimalDigit(assignedBank + payBank);

                            paymentDetailList.push(_transPaymentDetail(item.markId, item.project_id, payCash, payBank, payCoupon));
                        }
                        else {
                            var remainCash = utils.toDecimalDigit(serviceBill.pay_cash - assignedCash);
                            var remainBank = utils.toDecimalDigit(serviceBill.pay_bankAccount_money - assignedBank);

                            paymentDetailList.push(_transPaymentDetail(item.markId, item.project_id, remainCash, remainBank, payCoupon));
                        }
                    });
                }

                function _transPaymentDetail(markId, itemId, payCash, payBank, payCoupon, cardId, cardMoney, cardTimes, times2Money) {
                    return {
                        markId: markId,
                        service_id: itemId,
                        pay_cash: payCash || 0,
                        pay_bank: payBank || 0,
                        pay_coupon: payCoupon || 0,
                        memberCard_id: cardId || "",
                        card_pay_money: cardMoney || 0,
                        card_pay_times: cardTimes || 0,
                        times_2_money: times2Money || 0,
                        create_date: nowMilli
                    };
                }
            }

            //填充卡支付信息快照、
            function _buildPaymentCardSnapshot() {
                var cardPaymentList = [];

                if ($scope.isSingleCardMember()) {
                    _prepareSingleCardPayment();
                }

                if ($scope.isMultiCardMember()) {
                    _prepareMultiCardPayment();
                }

                _prepareCouponPayment();

                return cardPaymentList;

                //准备单卡支付组成
                function _prepareSingleCardPayment() {
                    var key = "recharge", value = 0, times2Money = 0, quarterInactiveTimes = 0;

                    if ($scope.isSingleRechargeCardMember()) {
                        key = "recharge";
                        value = serviceBill.pay_prePaidCard;
                    }

                    if ($scope.isSingleRecordCardMember()) {
                        key = "record";
                        value = serviceBill.def_int1;
                        times2Money = serviceBill.pay_prePaidCard;
                    }

                    if ($scope.isSingleQuarterCardMember()) {
                        key = "quarter";
                        value = serviceBill.def_int3;
                        times2Money = serviceBill.pay_prePaidCard;

                        var remainingActiveTimes = singleCard.timesLimit - singleCard.balance;

                        quarterInactiveTimes = value - remainingActiveTimes;

                        if (quarterInactiveTimes < 0) {
                            quarterInactiveTimes = 0;
                        }
                    }

                    cardPaymentList.push(_getPayment(singleCard.id, singleCard.cardName, key, value, times2Money, quarterInactiveTimes));
                }

                //准备多卡支付组成
                function _prepareMultiCardPayment() {
                    var quarterCardId2ActiveTimes = $scope.quarterCardId2ActiveTimes();

                    _.each($scope.buyProductRecords, function (item) {
                        var keyName = "recharge", value = 0, times2Money = 0, quarterInactiveTimes = 0;

                        _.each(item.payCardList, function (one) {
                            var cateName = one.payCard.cardName;
                            var cardId = one.payCard.id;

                            if (one.payInfo.payType === "rechargeCard") {
                                keyName = "recharge";
                                value = one.payInfo.cardPayMoney;
                            }
                            else if (one.payInfo.payType === "recordCard") {
                                keyName = "record";
                                value = one.payInfo.cardPayTimes;
                                times2Money = utils.toDecimalDigit(one.payInfo.cardPayTimes * one.payCard.recordAvgPrice);
                            }
                            else if (one.payInfo.payType === "quarterCard") {
                                keyName = "quarter";
                                value = one.payInfo.cardPayTimes;

                                var remainingActiveTimes = quarterCardId2ActiveTimes[one.payCard.id];
                                var activeTimes = value;

                                if (remainingActiveTimes <= 0) {
                                    activeTimes = 0;
                                }
                                else if (remainingActiveTimes < activeTimes) {
                                    activeTimes = remainingActiveTimes;
                                }

                                quarterCardId2ActiveTimes[one.payCard.id] -= activeTimes;

                                times2Money = utils.toDecimalDigit(activeTimes * one.payCard.timesAvgPrice);
                                quarterInactiveTimes = value - activeTimes;
                            }
                            else if (one.payInfo.payType === "presentService") {
                                keyName = "present";
                                value = one.payInfo.cardPayTimes;
                                times2Money = 0;
                                cardId = one.payInfo.present.sequenceId;
                            }

                            var cardPayment = _getPayment(cardId, cateName, keyName, value, times2Money, quarterInactiveTimes);

                            var paymentExist = _.find(cardPaymentList, function (item) {
                                return item.memberCardId === cardPayment.memberCardId && item.keyName === keyName;
                            });

                            if (paymentExist && paymentExist.keyName === cardPayment.keyName) {
                                paymentExist.value = utils.toDecimalDigit(paymentExist.value + cardPayment.value);
                                paymentExist.def_int1 = utils.toDecimalDigit(paymentExist.def_int1 + cardPayment.def_int1);
                            }
                            else {
                                cardPaymentList.push(cardPayment);
                            }
                        });
                    });
                }

                function _prepareCouponPayment() {
                    _.each($scope.payStatus.couponPayList, function (item) {
                        var temp = _getPayment(item.id, item.name, "coupon", item.money, item.bonusValue);
                        temp.def_str2 = item.bonusMode;
                        cardPaymentList.push(temp);
                    });
                }

                function _getPayment(cardId, cateName, key, value, times2Money, quarterInactiveTimes) {
                    var quarterInactiveMoney = 0;

                    if (quarterInactiveTimes) {
                        var payCard = _.find($scope.memberSelected.cards, function (card) {
                            return card.id === cardId;
                        });

                        if (!_.isEmpty(payCard)) {
                            quarterInactiveMoney = quarterInactiveTimes * payCard.timesAvgPrice;
                        }
                    }

                    return {
                        memberCardId: cardId,
                        keyName: key,
                        value: utils.toDecimalDigit(value),
                        groupName: "payment",
                        create_date: nowMilli,
                        def_str1: cateName,
                        def_int1: utils.toDecimalDigit(times2Money || 0),
                        quarter_inactive_times: quarterInactiveTimes || 0,
                        quarter_inactive_money: quarterInactiveMoney
                    }
                }
            }

            //填充卡消费信息、用于更新卡余额
            function _buildConsumeCard() {
                var consumeCardList = [];

                var cardList = $scope.memberSelected.cards;
                _.each(cardPaymentList, function (item) {
                    var presentScore = 0;
                    var reduction = 0;
                    var usedCard = _.find(cardList, function (card) {
                        return card.id === item.memberCardId;
                    });

                    if (_.isEmpty(usedCard)) {
                        fault = true;
                        _showErrorCardMsg();
                        return;
                    }

                    if (item.keyName === "quarter") {
                        var times = 0;
                        var activeTimes = usedCard.timesLimit - usedCard.balance;

                        if (activeTimes >= item.value) {
                            times = item.value;
                        }
                        else if (activeTimes < item.value) {
                            times = activeTimes > 0 ? activeTimes : 0;
                        }

                        reduction = (usedCard.timesAvgPrice * times);
                    }

                    if (item.keyName === "recharge") {
                        reduction = item.value;
                        if (usedCard.consumePresentScore) {
                            presentScore = item.value / usedCard.consumePresentScore;
                        }
                    }

                    if (item.keyName === "record") {
                        reduction = utils.toDecimalDigit(item.value * usedCard.recordAvgPrice);
                    }

                    consumeCardList.push({
                        id: usedCard.id,
                        reduction: reduction,
                        modify_date: nowMilli,
                        presentScore: presentScore,
                        cardType: item.keyName
                    });
                });

                return consumeCardList;
            }

            function _showErrorCardMsg() {
                $scope.modalDialogClose();
                utils.openFancyBox("#m-pos-checkout-error-card");
            }

            //填充计次卡余额
            function _buildRecordCardBalance() {
                var recordCardBalanceList = [];
                if ($scope.isSingleRecordCardMember()) {
                    _prepareSingleRecordCardBalance();
                }

                if ($scope.isMultiCardMember()) {
                    _prepareMultiRecordCardBalance();
                }

                return recordCardBalanceList;

                //准备单计次卡余额
                function _prepareSingleRecordCardBalance() {
                    var balance = $scope.view.recordBalanceTemp;

                    _.each(balance, function (oneGroup) {
                        _.each(oneGroup.services, function (service) {
                            var balanceTemp = {
                                id: service.recordId,
                                memberCardId: singleCard.id,
                                keyName: service.id,
                                value: oneGroup.times,
                                bind_group: oneGroup.bind_group
                            };

                            recordCardBalanceList.push(balanceTemp);
                        });
                    });
                }

                //多卡支付、计次卡余额准备
                function _prepareMultiRecordCardBalance() {
                    //使用计次卡支付的项目
                    var payByRecordCardItem = _.filter($scope.buyProductRecords, function (item) {
                        return !_.isEmpty(_.find(item.payCardList, function (one) {
                            return one.payInfo.payType === 'recordCard';
                        }));
                    });

                    //支付用到的计次卡
                    var payUsedRecordCard = [];

                    //计次卡对应的支付情况
                    var recordCardPayTimesMap = {};

                    _.each(payByRecordCardItem, function (item) {
                        _.each(item.payCardList, function (one) {
                            //填充支付使用到的计次卡、避免重复
                            var cardExist = _.find(payUsedRecordCard, function (card) {
                                return one.payCard.id === card.id;
                            });
                            if (!cardExist) {
                                payUsedRecordCard.push(one.payCard);
                            }

                            //填充每张计次卡对应某组服务支付的次数
                            var group = $scope.recordServiceGroup(one.payCard, item.id);

                            if (!recordCardPayTimesMap[one.payCard.id]) {
                                recordCardPayTimesMap[one.payCard.id] = {};
                            }

                            if (recordCardPayTimesMap[one.payCard.id][group]) {
                                recordCardPayTimesMap[one.payCard.id][group] += one.payInfo.cardPayTimes;
                            }
                            else {
                                recordCardPayTimesMap[one.payCard.id][group] = one.payInfo.cardPayTimes;
                            }
                        });
                    });

                    var balanceTemp;
                    _.each(payUsedRecordCard, function (card) {
                        _.each(card.recordBalance, function (balance) {
                            var payTemp = recordCardPayTimesMap[card.id][balance.bind_group] || 0;

                            _.each(balance.services, function (item) {
                                balanceTemp = {
                                    id: item.recordId,
                                    memberCardId: card.id,
                                    keyName: item.id,
                                    value: item.times - payTemp,
                                    modify_date: nowMilli,
                                    bind_group: balance.bind_group
                                };

                                recordCardBalanceList.push(balanceTemp);
                            });
                        });
                    });
                }
            }

            function _buildQuarterCardUsed() {
                var quarterUsedList = [];

                _emptyQuarterCardUsedCopy();

                if ($scope.isSingleQuarterCardMember()) {
                    _prepareSingleQuarterUsed();
                }

                if ($scope.isMultiCardMember()) {
                    _prepareMultiQuarterUsed();
                }

                return quarterUsedList;

                function _prepareSingleQuarterUsed() {
                    _.each($scope.incomeStatus.servicePayTimes, function (times, serviceId) {
                        _.each(singleCard.quarterUsed, function (oneGroup) {
                            var usedService = _.find(oneGroup.services, function (service) {
                                return service.id === serviceId;
                            });

                            if (!_.isEmpty(usedService)) {
                                oneGroup.usedCopy += times;
                            }
                        });

                        _.each(singleCard.quarterUsed, function (oneGroup) {
                            _.each(oneGroup.services, function (service) {
                                quarterUsedList.push({
                                    id: service.recordId,
                                    memberCardId: singleCard.id,
                                    value: oneGroup.usedCopy,
                                    modify_date: nowMilli,
                                    keyName: service.id,
                                    bind_group: service.bind_group
                                });
                            });
                        });
                    });
                }

                function _prepareMultiQuarterUsed() {
                    var payByQuarterCardItem = _.filter($scope.buyProductRecords, function (item) {
                        return !_.isEmpty(_.find(item.payCardList, function (one) {
                            return one.payInfo.payType === 'quarterCard';
                        }));
                    });

                    var payQuarterCards = [];

                    _.each(payByQuarterCardItem, function (item) {
                        _.each(item.payCardList, function (one) {
                            _.each(one.payCard.quarterUsed, function (oneGroup) {
                                var usedService = _.find(oneGroup.services, function (service) {
                                    return service.id === item.id;
                                });

                                if (!_.isEmpty(usedService)) {
                                    oneGroup.usedCopy += item.saleNum;
                                }
                            });

                            var cardExist = _.find(payQuarterCards, function (card) {
                                return card.id === one.payCard.id;
                            });

                            if (_.isEmpty(cardExist)) {
                                payQuarterCards.push(one.payCard);
                            }
                        });
                    });

                    _.each(payQuarterCards, function (card) {
                        _.each(card.quarterUsed, function (oneGroup) {
                            _.each(oneGroup.services, function (service) {
                                quarterUsedList.push({
                                    id: service.recordId,
                                    memberCardId: singleCard.id,
                                    value: oneGroup.usedCopy,
                                    modify_date: nowMilli,
                                    keyName: service.id,
                                    bind_group: service.bind_group
                                });
                            });
                        });
                    });
                }

                // 重新初始化使用次数副本，在计算的过程中会累加该中，避免重复计算重复累加
                function _emptyQuarterCardUsedCopy() {
                    if (!$scope.isMemberSelected()) {
                        return;
                    }

                    var quarterCard = _.filter($scope.memberSelected.cards, function (card) {
                        return card.cateType === 'quarter';
                    });

                    _.each(quarterCard, function (card) {
                        _.each(card.quarterUsed, function (item) {
                            item.usedCopy = item.totalUsed;
                        });
                    });
                }
            }

            //填充赠送服务余额
            function _buildPresentSBalance() {
                if (!$scope.isMultiCardMember()) {
                    return [];
                }
                var presentBalanceList = [];

                //使用赠送服务支付的项目
                var payByPresentItem = _.filter($scope.buyProductRecords, function (item) {
                    return !_.isEmpty(_.find(item.payCardList, function (one) {
                        return one.payInfo.payType === 'presentService';
                    }));
                });

                var payUsedPresent = [];
                var presentSPayTimesMap = {};

                _queryPayTimes();
                _assembleBalance();

                return presentBalanceList;

                function _queryPayTimes() {
                    _.each(payByPresentItem, function (item) {
                        _.each(item.payCardList, function (one) {
                            var presentExist = _.find(payUsedPresent, function (present) {
                                return one.payCard.id === present.id;
                            });

                            if (_.isEmpty(presentExist)) {
                                payUsedPresent.push(one.payCard);
                            }

                            if (presentSPayTimesMap[one.payCard.recordId]) {
                                presentSPayTimesMap[one.payCard.recordId] += one.payInfo.cardPayTimes;
                            }
                            else {
                                presentSPayTimesMap[one.payCard.recordId] = one.payInfo.cardPayTimes;
                            }
                        });
                    });
                }

                function _assembleBalance() {
                    _.each($scope.memberSelected.presents, function (present) {
                        _.each(present.services, function (service) {
                            var payTimes = presentSPayTimesMap[service.recordId] || 0;

                            var balance = {
                                id: service.recordId,
                                memberCardId: present.sequenceId,
                                serviceId: service.id,
                                value: Number(service.times) - payTimes,
                                modify_date: nowMilli,
                                serviceName: service.names
                            };

                            presentBalanceList.push(balance);
                        });
                    });
                }
            }

            //填充余额快照
            function _buildBillBalanceSnapshot() {
                var billBalanceList = [];

                _fillRecordCard();
                _fillRechargeCard();

                return billBalanceList;

                function _fillRecordCard() {
                    _.each(recordCardBalanceList, function (item) {
                        billBalanceList.push({
                            memberCardId: item.memberCardId,
                            groupName: "billMemBalance",
                            keyName: item.keyName,
                            value: item.value,
                            serviceName: $scope.serviceIdNameMap[item.keyName] || "",//服务已不存在、
                            create_date: nowMilli,
                            bind_group: item.bind_group
                        });
                        //计次卡余额不需要更新这两个字段
                        delete item.keyName;
                        delete item.memberCardId;
                    });

                    _.each(quarterCardBalanceList, function (item) {
                        billBalanceList.push({
                            memberCardId: item.memberCardId,
                            groupName: "billMemBalance",
                            keyName: item.keyName,
                            value: item.value,
                            serviceName: $scope.serviceIdNameMap[item.keyName] || "",//服务已不存在、
                            create_date: nowMilli,
                            bind_group: item.bind_group
                        });
                        //计次卡余额不需要更新这两个字段
                        delete item.keyName;
                        delete item.memberCardId;
                    });

                    //赠送项目余额
                    _.each(presentBalanceList, function (item) {
                        billBalanceList.push({
                            memberCardId: item.memberCardId,
                            groupName: "presentBalanceSnapshot",
                            keyName: item.serviceId,
                            value: item.value,
                            serviceName: item.serviceName || "",
                            create_date: nowMilli
                        });

                        delete item.keyName;
                        delete item.memberCardId;
                        delete item.serviceName;
                    });
                }

                function _fillRechargeCard() {
                    var rechargeCardList = _.filter($scope.memberSelected.cards, function (card) {
                        return card.cateType === "recharge";
                    });

                    _.each(rechargeCardList, function (card) {
                        var cardConsumeInfo = _.find(cardPaymentList, function (payment) {
                            return (card.id === payment.memberCardId && payment.keyName === "recharge");
                        });

                        if (cardConsumeInfo) {
                            billBalanceList.push({
                                memberCardId: card.id,
                                groupName: "rechargeBalanceSnapshot",
                                keyName: card.id,
                                value: utils.toDecimalDigit(card.balance - cardConsumeInfo.value),
                                create_date: nowMilli
                            });
                        }
                    });
                }
            }

            //填充会员、用于更新会员积分
            function _buildMemberScore() {
                var memberScore = {};
                if ($scope.isMemberSelected()) {
                    var totalPresentScore = 0;
                    _.each(consumeCardList, function (item) {
                        if (serviceBill.usedPrivilege) {
                            item.presentScore *= 2;
                        }
                        totalPresentScore += item.presentScore;
                    });
                    memberScore = {
                        id: $scope.memberSelected.id,
                        presentScore: totalPresentScore,
                        modify_date: nowMilli
                    };
                }
                return memberScore;
            }

            function _buildCouponList() {
                var couponUsedList = [];

                _.each($scope.payStatus.couponPayList, function (item) {
                    couponUsedList.push({
                        id: item.id,
                        isUsed: "used",
                        modify_date: nowMilli
                    });
                });

                return couponUsedList;
            }

            function _buildDeposit() {
                var depositList = [];
                var depositItemList = [];

                if ($scope.isMemberSelected()) {
                    _.each($scope.buyProductRecords, function (item) {
                        if (item.isStoredInShop) {
                            _buildOneDeposit(item);
                        }
                    });
                }

                return {
                    depositList: depositList,
                    depositItemList: depositItemList
                };

                function _buildOneDeposit(deposit) {
                    _prepareDeposit();
                    _prepareDepositItem();


                    function _prepareDeposit() {
                        depositList.push({
                            type: "depositItem",
                            entityId: deposit.id,
                            entityName: deposit.name,
                            memberId: $scope.memberSelected.id,
                            create_date: nowMilli
                        });
                    }

                    function _prepareDepositItem() {
                        _.each(deposit.serviceList, function (item) {
                            var times = 0;

                            var isInConsume = _.find($scope.buyProductRecords, function (service) {
                                return service.id === item.id;
                            });

                            if (!_.isEmpty(isInConsume)) {
                                times = isInConsume.saleNum;
                            }

                            depositItemList.push({
                                memberId: $scope.memberSelected.id,
                                entityId: item.id,
                                entityName: item.name,
                                numberofuse: times
                            });
                        });
                    }
                }
            }

            function _buildDepositConsume() {
                var depositConsumeList = [];

                if ($scope.isMemberSelected() && $scope.memberSelected.hasDeposit) {
                    var memberDeposit = $scope.memberSelected.deposits;

                    if (_.isEmpty(memberDeposit)) {
                        return depositConsumeList;
                    }

                    _.each($scope.buyProductRecords, function (item) {
                        _.each(memberDeposit, function (oneDeposit) {
                            var consumeItem = _.find(oneDeposit.services, function (service) {
                                return service.id === item.id;
                            });

                            if (!_.isEmpty(consumeItem)) {
                                depositConsumeList.push({
                                    id: consumeItem.recordId,
                                    consumeTimes: item.saleNum
                                });
                            }
                        });
                    });
                }

                return depositConsumeList;
            }

            function _isItemSameWithProject(item, project) {
                return item.id === project.project_id && item.serviceEmployee.id === project.employee_id && item.relatedCardId === project.relatedCardId;
            }

            // 防止currentMoney扣成负数
            function _rebuildCardReduction() {
                _.each(consumeCardList, function (item) {
                    var usedCard = _.find($scope.memberSelected.cards, function (card) {
                        return card.id === item.id;
                    });

                    if (_.isEmpty(usedCard)) {
                        return;
                    }

                    if (usedCard.currentMoney - item.reduction < 0) {
                        cardId2AdjustMoney[usedCard.id] = usedCard.currentMoney - item.reduction;

                        item.reduction = usedCard.currentMoney;
                    }
                });
            }

            function _rebuildPaymentInfo() {
                _.each(cardPaymentList, function (item) {
                    if (item.keyName !== 'record' && item.keyName !== 'quarter') {
                        return;
                    }

                    if (!cardId2AdjustMoney[item.memberCardId]) {
                        return;
                    }

                    item.def_int1 += cardId2AdjustMoney[item.memberCardId];

                    if (item.def_int1 < 0) {
                        item.def_int1 = 0;
                    }
                });
            }

            function _rebuildPaymentDetail() {
                _.each(paymentDetailList, function (item) {
                    if (!cardId2AdjustMoney[item.memberCard_id]) {
                        return;
                    }

                    item.times_2_money += cardId2AdjustMoney[item.memberCard_id];
                    cardId2AdjustMoney[item.memberCard_id] = 0;

                    if (item.times_2_money < 0) {
                        item.times_2_money = 0;
                    }
                });
            }
        };

        $scope.buildFreePerformance = function (billInfo) {
            var empBonusList = billInfo.empBonusList;

            var projectList = billInfo.projectList;
            var paymentDetailList = billInfo.paymentDetailList;

            var freePerformanceList = [];

            var freeList = _buildFreeList();
            _.each(freeList, function (item) {
                var joinEmpList = _.filter(empBonusList, function (empBonus) {
                    return empBonus.markId === item.markId;
                });

                var zeroPriceSplice = _spliceFreeInfo(item.zeroPrice, joinEmpList);
                var presentSplice = _spliceFreeInfo(item.present, joinEmpList);
                var quarterSplice = _spliceFreeInfo(item.quarter, joinEmpList);

                freePerformanceList = freePerformanceList.concat(zeroPriceSplice).concat(presentSplice).concat(quarterSplice);
            });

            _.each(freeList.freeCouponList, function (item) {
                freePerformanceList = freePerformanceList.concat(_spliceFreeInfo(item, empBonusList));
            });

            billInfo.freePerformanceList = freePerformanceList;

            function _buildFreeList() {
                var freeList = [];
                _.each(projectList, function (item) {
                    var payDetail = _.find(paymentDetailList, function (payment) {
                        return item.project_id === payment.service_id && item.markId === payment.markId;
                    });
                    if (_.isEmpty(payDetail)) {
                        return;
                    }

                    var freePerformance = {
                        markId: item.markId,
                        zeroPrice: _buildZeroPriceFreeInfo(item),
                        present: _buildPresentFreeInfo(item, payDetail),
                        quarter: _buildQuarterInActiveFreeInfo(payDetail)
                    };

                    freeList.push(freePerformance);
                });

                freeList.freeCouponList = _buildCoupon();

                return freeList;

                function _buildZeroPriceFreeInfo(item) {
                    var originalItem = $scope.productList[item.project_id];
                    if (_.isEmpty(originalItem)) {
                        return;
                    }

                    if (originalItem.prices_salesPrice !== 0) {
                        return;
                    }

                    return {
                        item_id: item.project_id,
                        type: 'zeroPrice',
                        times: item.saleNum,
                        performance: (originalItem.originalPerformance || 0) * item.saleNum
                    };
                }

                function _buildPresentFreeInfo(item, payDetail) {
                    var originalItem = $scope.productList[item.project_id];
                    if (_.isEmpty(originalItem)) {
                        return;
                    }

                    if (payDetail.card_pay_times >= 0) {
                        return;
                    }
                    var present = originalItem.presentInfo;
                    //如果配置了计入业绩或固定提成，就不应该在记录免费业绩了
                    if (present && present.bonusValue > 0){
                        return null;
                    }
                    return {
                        item_id: payDetail.memberCard_id,
                        type: 'present',
                        times: Math.abs(payDetail.card_pay_times),
                        performance: originalItem.prices_salesPrice * Math.abs(payDetail.card_pay_times)
                    };
                }

                function _buildQuarterInActiveFreeInfo(payDetail) {
                    var inactiveTimes = payDetail.inactiveTimes || 0;

                    if (inactiveTimes === 0) {
                        return;
                    }

                    return {
                        item_id: payDetail.memberCard_id,
                        type: 'quarter',
                        times: inactiveTimes,
                        performance: payDetail.inactiveMoney || 0
                    };
                }

                function _buildCoupon() {
                    var couponFreeList = [];
                    _.each($scope.payStatus.couponPayList, function (item) {
                        //如果配置了计入业绩或固定提成，就不应该在记录免费业绩了
                        if (item.bonusValue > 0) {
                            return null;
                        }
                        couponFreeList.push({
                            item_id: item.id,
                            type: 'coupon',
                            times: 1,
                            performance: item.money
                        })
                    });

                    return couponFreeList;
                }
            }

            function _spliceFreeInfo(freeInfo, empList) {
                if (_.isEmpty(freeInfo) || _.isEmpty(empList)) {
                    return [];
                }

                var spliceResult = [];

                var originalTimes = freeInfo.times;
                var originalPerformance = freeInfo.performance;

                freeInfo.times = utils.toDecimalDigit(freeInfo.times / empList.length);
                freeInfo.performance = utils.toDecimalDigit(freeInfo.performance / empList.length);

                _.each(empList, function (item) {
                    spliceResult.push(_.extend(_.clone(freeInfo), {
                        employee_id: item.employee_id
                    }));
                });

                spliceResult[0].times = utils.toDecimalDigit(originalTimes - freeInfo.times * (empList.length - 1));
                spliceResult[0].performance = utils.toDecimalDigit(originalPerformance - freeInfo.performance * (empList.length - 1));

                return spliceResult;
            }
        };

        $scope.clearErrorOrderConfirm = function () {
            $scope.clearOrder();
            $scope.modalDialogClose();
            $scope.digestScope();
        };
    }

    exports.initModel = initModel;
    exports.initControllers = initControllers;
});
