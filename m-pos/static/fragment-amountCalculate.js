//支付金额计算
define(function (require, exports, module) {
    var utils = require("mframework/static/package").utils;

    function initControllers($scope) {
        //重置计算金额用到的状态
        $scope.resetCalculateStatus = function () {
            resetIncomeStatus();
            resetPayStatus();
            resetPay();
        };

        function resetIncomeStatus() {
            $scope.incomeStatus.totalMoney = 0;
            $scope.incomeStatus.discountMoney = 0;
            $scope.incomeStatus.paidMoney = 0;

            $scope.incomeStatus.rechargeCard = 0;//充值卡支付金额
            $scope.incomeStatus.recordCard = 0;//次卡支付金额

            $scope.incomeStatus.rechargeCardOldPrice = 0;//充值卡原价金额
            $scope.incomeStatus.recordCardOldPrice = 0;//计次卡原价金额

            $scope.incomeStatus.servicePayTimes = {};//每个服务支付的次数
            $scope.incomeStatus.payTimes = 0;//计次卡总计支付的次数
            $scope.incomeStatus.quarterPayTimes = 0;//年卡支付次数
            $scope.incomeStatus.presentSPayTimes = 0;

            $scope.incomeStatus.multiCardOverMoney = 0;//多卡支付剩余的金额

            $scope.incomeStatus.rechargeCardPresentScore = 0;//充值卡消费赠送积分

            $scope.incomeStatus.couponPayMoney = 0;//现金券支付金额

            $scope.incomeStatus.quarterOweMoney = 0;//年卡所补的差价

            $scope.incomeStatus.needToPayMoney = 0;
        }

        function resetPayStatus() {
            $scope.payStatus.billDiscount = featureConf.defaultDiscount;
            $scope.payStatus.billReduce = 0;
            $scope.payStatus.cashPay = 0;
            $scope.payStatus.cashChange = 0;
            $scope.payStatus.bankPay = 0;
            $scope.payStatus.cardPay = 0;
            $scope.payStatus.couponPayList = [];
        }

        function resetPay() {
            $scope.pay.cash = 0;
            $scope.pay.prePaidCard = 0;
            $scope.pay.cardTimes = 0;
            $scope.pay.quarterCardTimes = 0;
            $scope.pay.bank = 0;
            $scope.pay.coupon = 0;
        }

        //计算金额、散客|会员、会员分为单卡|多卡、卡分为计次卡|充值卡
        $scope.calculateAmount = function () {
            _calculateItemMoney();
            resetIncomeStatus();

            if ($scope.isMemberSelected()) {
                if ($scope.isNoCardMember()) {
                    //无卡会员结算
                    normalCalculate();
                }
                else if ($scope.isSingleCardMember()) {
                    //单卡会员结算
                    var singleCard = $scope.memberSelected.cards[0];
                    if ($scope.isRechargeCard(singleCard)) {
                        singleRechargeCalculate();
                    }
                    else if ($scope.isRecordCard(singleCard)) {
                        singleRecordCalculate();
                    }
                    else if ($scope.isQuarterCard(singleCard)) {
                        singleQuarterCalculate();
                    }
                }
                else {
                    //多卡会员结算
                    multiCardMemberCalculate();
                }
            }
            else {
                //散客结算
                normalCalculate();
            }
            payStatusChange();

            function _calculateItemMoney() {
                _.each($scope.buyProductRecords, function (item) {
                    item.money = item.saleNum * item.unitPrice;

                    if (_.isNaN(item.money) || item.saleNum < 0) {
                        item.saleNum = 0;
                        item.money = 0;
                    }
                });
            }
        };

        //散客
        function normalCalculate() {
            var paidAccuracy = _.isUndefined($scope.view.paidAccuracy) ? 1 : $scope.view.paidAccuracy;

            var totalMoney = 0;

            var productList = $scope.buyProductRecords;

            _.each(productList, function (item) {
                totalMoney += item.money;
            });

            var couponPayBeforeDis = 0;
            _.each($scope.payStatus.couponPayList, function (item) {
                couponPayBeforeDis += item.money;
            });

            var withoutCouponRemaining = totalMoney - couponPayBeforeDis;

            if (withoutCouponRemaining < 0) {
                withoutCouponRemaining = 0;
            }

            var noDiscountMoney = 0;
            _.each(productList, function (item) {
                if (item.noDiscount) {
                    noDiscountMoney += item.money;
                }
            });

            if (noDiscountMoney > couponPayBeforeDis) {
                noDiscountMoney -= couponPayBeforeDis;
            }
            else {
                noDiscountMoney = 0;
            }

            var paid = utils.toDecimalDigit(noDiscountMoney + $scope.payStatus.billDiscount * (withoutCouponRemaining - noDiscountMoney) / 10);
            var discountMoney = withoutCouponRemaining - paid;

            $scope.incomeStatus.totalMoney = totalMoney;
            $scope.incomeStatus.couponPayMoney = couponPayBeforeDis;
            $scope.incomeStatus.discountMoney = discountMoney;
            $scope.incomeStatus.reduceMoney = $scope.payStatus.billReduce || 0;//减免金额

            var temp = paid - $scope.payStatus.billReduce;//1位精度
            $scope.incomeStatus.paidMoney = utils.toDecimalDigit(temp, paidAccuracy);//应付金额，0|1位精度

            $scope.view.adjustMoney = utils.toDecimalDigit($scope.incomeStatus.paidMoney - temp);//对应收调整了多少钱

            //减免金额过大、不需要收钱...防止界面出现负数
            if ($scope.incomeStatus.paidMoney < 0) {
                $scope.incomeStatus.paidMoney = 0;
            }

            $scope.incomeStatus.needToPayMoney = $scope.incomeStatus.paidMoney;
        }

        //单充值卡计算
        function singleRechargeCalculate() {
            var singleCard = $scope.memberSelected.cards[0];

            //高级折扣计算和普通折扣计算、折扣信息被手工更改过与正常折扣计算没有差别
            if ($scope.isAdvancedDisType(singleCard)) {
                if ($scope.view.disChangegManually) {
                    normalCalculate();
                }
                else {
                    _advancedRechargeCalculate();
                }
            }
            else {
                if (!$scope.view.disChangegManually) {
                    $scope.payStatus.billDiscount = singleCard.discountInfo;
                }
                normalCalculate();
            }

            _calculateRechargeCardPaid();

            $scope.incomeStatus.needToPayMoney = $scope.incomeStatus.paidMoney;

            function _calculateRechargeCardPaid() {
                if (singleCard.isValid) {
                    if (singleCard.balance < $scope.incomeStatus.paidMoney) {
                        //会员卡余额不足
                        $scope.incomeStatus.rechargeCard = utils.toDecimalDigit(singleCard.balance > 0 ? singleCard.balance : 0);
                    }
                    else {
                        $scope.incomeStatus.rechargeCard = $scope.incomeStatus.paidMoney;
                    }

                    if (singleCard.consumePresentScore) {
                        $scope.incomeStatus.rechargeCardPresentScore = $scope.incomeStatus.rechargeCard / singleCard.consumePresentScore;
                    }
                }

                //卡支付金额在界面上未更改、则使用计算出来的扣卡金额
                if (!$scope.view.cardPayChangeManually) {
                    $scope.payStatus.cardPay = $scope.incomeStatus.rechargeCard;
                }
            }

            //高级充值卡计算
            function _advancedRechargeCalculate() {
                var paidAccuracy = _.isUndefined($scope.view.paidAccuracy) ? 1 : $scope.view.paidAccuracy;

                var totalMoney = 0, paid = 0;
                var productList = $scope.buyProductRecords;
                var discountTemp;

                var totalCouponPayBefDis = 0;

                var itemId2CouponPay = $scope.buildItemId2CouponPay($scope.buyProductRecords);

                _.each(productList, function (item) {
                    var itemCouponPayBefDis = itemId2CouponPay[item.id] || 0;

                    totalMoney += item.money;
                    totalCouponPayBefDis += itemCouponPayBefDis;

                    //针对特殊折扣处理
                    discountTemp = singleCard.discountInfo[item.cate_id];

                    //部分界面上未选择的服务类别折扣为10，填写的折扣可为0、
                    if (!discountTemp && discountTemp !== 0) {
                        discountTemp = 10;
                    }

                    if (item.noDiscount) {
                        discountTemp = 10;
                    }

                    if (itemCouponPayBefDis > item.money) {
                        itemCouponPayBefDis = item.money;
                    }

                    paid += (item.money - itemCouponPayBefDis) * discountTemp / 10;
                });

                var withoutCouponRemaining = totalMoney - totalCouponPayBefDis;

                //整单平均折扣、用于在收银弹出窗显示
                $scope.payStatus.billDiscount = utils.toDecimalDigit(paid / withoutCouponRemaining * 10);

                $scope.incomeStatus.totalMoney = totalMoney;
                $scope.incomeStatus.couponPayMoney = totalCouponPayBefDis;
                $scope.incomeStatus.discountMoney = withoutCouponRemaining - paid;
                $scope.incomeStatus.reduceMoney = $scope.payStatus.billReduce;//减免金额

                var temp = paid - $scope.payStatus.billReduce;//1位精度
                $scope.incomeStatus.paidMoney = utils.toDecimalDigit(temp, paidAccuracy);//应付金额，0|1位精度
                $scope.view.adjustMoney = utils.toDecimalDigit($scope.incomeStatus.paidMoney - temp);//对应收调整了多少钱

                //减免金额过大、不需要收钱...
                if ($scope.incomeStatus.paidMoney < 0) {
                    $scope.incomeStatus.paidMoney = 0;
                }
            }
        }

        //单计次卡计算
        function singleRecordCalculate() {
            var paidAccuracy = _.isUndefined($scope.view.paidAccuracy) ? 1 : $scope.view.paidAccuracy;

            var singleCard = $scope.memberSelected.cards[0];

            var recordProduct = [], overProduct = [];//记次项目与剩余的项目
            var productList = $scope.buyProductRecords;

            var serviceIdTimesMap = {};//服务id与扣次Map
            var totalMoney = 0;//总金额
            var recordTolMoney = 0;//使用记次卡减少的金额
            var totalTimes = 0;//使用计次卡支付的总次数

            //深复制
            var recordBalanceTemp = JSON.parse(JSON.stringify(singleCard.recordBalance));

            //遍历计次会员余额、默认支付次数全为0
            _.each(singleCard.recordBalance, function (balance) {
                _.each(balance.services, function (service) {
                    serviceIdTimesMap[service.id] = 0;
                });
            });

            //会员卡未过期、使用卡内次数支付
            if (singleCard.isValid) {
                _calculateRecordTimes();
            }
            else {
                _.each(productList, function (item) {
                    totalMoney += item.money;
                    overProduct.push(item);
                });
            }

            var couponPayMoney = 0;
            _.each($scope.payStatus.couponPayList, function (item) {
                couponPayMoney += item.money;
            });

            var noDiscountMoney = 0;
            _.each(overProduct, function (item) {
                if (item.noDiscount) {
                    noDiscountMoney += item.money;
                }
            });

            var recordOverMoney = totalMoney - recordTolMoney;//除去计次卡剩下应支付的金额
            var withoutRecordAndCouponPay = recordOverMoney - couponPayMoney - noDiscountMoney;

            if (withoutRecordAndCouponPay < 0) {
                withoutRecordAndCouponPay = 0;
            }

            var paid = utils.toDecimalDigit($scope.payStatus.billDiscount * withoutRecordAndCouponPay / 10 + noDiscountMoney);//打折后应付
            var discountMoney = withoutRecordAndCouponPay + noDiscountMoney - paid;

            $scope.incomeStatus.totalMoney = totalMoney;//整单金额
            $scope.incomeStatus.couponPayMoney = couponPayMoney;

            $scope.incomeStatus.recordCard = utils.toDecimalDigit(totalTimes * singleCard.recordAvgPrice);
            $scope.incomeStatus.recordCardOldPrice = recordTolMoney;//计次卡扣次减少的金额

            $scope.incomeStatus.payTimes = totalTimes;//合计支付次数
            $scope.incomeStatus.servicePayTimes = serviceIdTimesMap;//每个服务支付的次数

            $scope.incomeStatus.discountMoney = discountMoney;//折扣减少的金额
            $scope.incomeStatus.reduceMoney = $scope.payStatus.billReduce;//减免金额

            var temp = paid - $scope.payStatus.billReduce;//1位精度
            $scope.incomeStatus.paidMoney = utils.toDecimalDigit(temp, paidAccuracy);//应付金额，0|1位精度
            $scope.view.adjustMoney = utils.toDecimalDigit($scope.incomeStatus.paidMoney - temp);//对应收调整了多少钱

            //减免金额过大、不需要收钱...防止界面上出现负数
            if ($scope.incomeStatus.paidMoney < 0) {
                $scope.incomeStatus.paidMoney = 0;
            }

            $scope.incomeStatus.needToPayMoney = $scope.incomeStatus.paidMoney + $scope.incomeStatus.recordCard;

            //将区分后的项目
            $scope.view.recordProduct = recordProduct;
            $scope.view.overProduct = overProduct;
            $scope.view.recordBalanceTemp = recordBalanceTemp;

            function _calculateRecordTimes() {
                var recordTemp, overTemp;

                //获取记次卡消费次数
                _.each(productList, function (item) {
                    var serviceRemainingTimes = $scope.recordServiceRemainingTimes(recordBalanceTemp, item.id);

                    //计次卡范围内并且服务剩余次数大于0
                    if ($scope.isRecordContainsService(singleCard, item.id) && serviceRemainingTimes > 0) {
                        //数量大于余次，进行拆分
                        if (item.saleNum > serviceRemainingTimes) {
                            serviceIdTimesMap[item.id] = serviceRemainingTimes;

                            recordTemp = _.clone(item);
                            overTemp = _.clone(item);

                            recordTemp.saleNum = serviceIdTimesMap[item.id];
                            recordTemp.money = recordTemp.unitPrice * recordTemp.saleNum;

                            overTemp.saleNum = item.saleNum - recordTemp.saleNum;
                            overTemp.money = overTemp.unitPrice * overTemp.saleNum;

                            recordProduct.push(recordTemp);
                            overProduct.push(overTemp);

                            recordTolMoney += recordTemp.money;
                        }
                        else {
                            serviceIdTimesMap[item.id] = item.saleNum;
                            recordProduct.push(item);
                            recordTolMoney += item.money;
                        }
                        totalTimes += serviceIdTimesMap[item.id];

                        _freshBalanceTimes(item.id, serviceIdTimesMap[item.id]);
                    }
                    else {
                        overProduct.push(item);
                    }
                    totalMoney += item.money;
                });

                function _freshBalanceTimes(serviceId, reduceTimes) {
                    _.each(recordBalanceTemp, function (balance) {
                        var belongThisGroup = _.contains(_.pluck(balance.services, "id"), serviceId);

                        if (belongThisGroup) {
                            balance.times -= reduceTimes;
                        }
                    });
                }
            }
        }

        function singleQuarterCalculate() {
            var paidAccuracy = _.isUndefined($scope.view.paidAccuracy) ? 1 : $scope.view.paidAccuracy;

            var singleCard = $scope.memberSelected.cards[0];

            var productList = $scope.buyProductRecords;

            //记次项目与剩余的项目
            var recordProduct = _.filter(productList, function (item) {
                return $scope.isQuarterContainsService(singleCard, item.id);
            });

            var overProduct = _.filter(productList, function (item) {
                return !$scope.isQuarterContainsService(singleCard, item.id);
            });

            var couponPayMoney = 0;
            _.each($scope.payStatus.couponPayList, function (item) {
                couponPayMoney += item.money;
            });

            var totalMoney = 0;//总金额
            var quarterTolMoney = 0;//使用年卡减少的金额
            var totalTimes = 0;//使用年卡支付的总次数

            var serviceIdTimesMap = {};//服务id与使用次数Map
            //会员卡未过期、使用卡内次数支付
            if (singleCard.isValid) {
                _.each(recordProduct, function (item) {
                    serviceIdTimesMap[item.id] = item.saleNum;
                    quarterTolMoney += item.money;
                    totalTimes += item.saleNum;
                });

                _.each(productList, function (item) {
                    totalMoney += item.money;
                });
            }
            else {
                overProduct = productList;
                _.each(overProduct, function (item) {
                    totalMoney += item.money;
                });
            }

            var quarterOweMoney = 0;
            if (quarterTolMoney > singleCard.capsLimit) {
                quarterOweMoney = utils.toDecimalDigit(quarterTolMoney - singleCard.capsLimit);
                quarterTolMoney = singleCard.capsLimit;
            }

            var noDiscountMoney = 0;
            _.each(overProduct, function (item) {
                if (item.noDiscount) {
                    noDiscountMoney += item.money;
                }
            });

            var recordOverMoney = totalMoney - quarterTolMoney;//除去计次卡剩下应支付的金额

            var withoutRecordAndCoupon = recordOverMoney - couponPayMoney - noDiscountMoney;

            if (withoutRecordAndCoupon < 0) {
                withoutRecordAndCoupon = 0;
            }

            var paid = utils.toDecimalDigit($scope.payStatus.billDiscount * withoutRecordAndCoupon / 10 + noDiscountMoney);//打折后应付

            $scope.incomeStatus.discountMoney = withoutRecordAndCoupon + noDiscountMoney - paid;

            $scope.incomeStatus.quarterOweMoney = quarterOweMoney || 0;//年卡所补的差价

            $scope.incomeStatus.totalMoney = totalMoney;//整单金额
            $scope.incomeStatus.couponPayMoney = couponPayMoney;

            $scope.incomeStatus.recordCard = utils.toDecimalDigit(totalTimes * singleCard.timesAvgPrice);

            var remainingActiveTimes = singleCard.timesLimit - singleCard.balance;

            if (remainingActiveTimes <= 0) {
                $scope.incomeStatus.recordCard = 0;
            }
            else if (remainingActiveTimes < totalTimes) {
                $scope.incomeStatus.recordCard = utils.toDecimalDigit(remainingActiveTimes * singleCard.timesAvgPrice);
            }

            $scope.incomeStatus.recordCardOldPrice = quarterTolMoney;//计次卡扣次减少的金额

            $scope.incomeStatus.payTimes = 0;
            $scope.incomeStatus.quarterPayTimes = totalTimes;

            $scope.incomeStatus.servicePayTimes = serviceIdTimesMap;//每个服务支付的次数

            $scope.incomeStatus.reduceMoney = $scope.payStatus.billReduce;//减免金额

            var temp = paid - $scope.payStatus.billReduce;//1位精度
            $scope.incomeStatus.paidMoney = utils.toDecimalDigit(temp, paidAccuracy);//应付金额，0|1位精度
            $scope.view.adjustMoney = utils.toDecimalDigit($scope.incomeStatus.paidMoney - temp);//对应收调整了多少钱

            //减免金额过大、不需要收钱...防止界面上出现负数
            if ($scope.incomeStatus.paidMoney < 0) {
                $scope.incomeStatus.paidMoney = 0;
            }

            $scope.incomeStatus.needToPayMoney = $scope.incomeStatus.paidMoney + $scope.incomeStatus.recordCard;

            //将区分后的项目挂到记次卡上下文
            $scope.view.recordProduct = recordProduct;
            $scope.view.overProduct = overProduct;
        }

        function multiCardMemberCalculate() {
            var paidAccuracy = _.isUndefined($scope.view.paidAccuracy) ? 1 : $scope.view.paidAccuracy;

            var totalMoney = 0;
            var overMoney = 0;

            var multiRechargePayMoney = 0;
            var multiRecordPayMoney = 0;

            var multiRecordCardPayTimes = 0;
            var multiQuarterCardPayTimes = 0;


            var presentScore = 0;
            var rechargeCardOldPrice = 0;
            var recordCardOldPrice = 0;
            var quarterCardOldPrice = 0;
            var presentSPayTimes = 0;

            var noDiscountMoney = 0;

            var payByMoneyItem = $scope.payByMoneyItemList();

            var couponPayMoney = 0;
            _.each($scope.payStatus.couponPayList, function (item) {
                couponPayMoney += item.money;
            });

            var itemId2CouponPay = $scope.buildItemId2CouponPay(payByMoneyItem);

            _.each($scope.buyProductRecords, function (item) {
                var itemCouponBefDis = itemId2CouponPay[item.id] || 0;

                overMoney += $scope.itemUnpaidRemainingMoney(item) - itemCouponBefDis;

                if (_.isEmpty(item.payCardList) && item.noDiscount) {// 未使用任何支付方式
                    noDiscountMoney += item.money - itemCouponBefDis;
                }
                else {
                    _.each(item.payCardList, function (one) {
                        if (one.payInfo.payType === "rechargeCard") {
                            var payCard = !_.isEmpty(_.find($scope.memberSelected.cards, function (card) {
                                return card.id === one.payCard.id;
                            }));

                            var approvePayMoney = payCard.balance;//可支付的会员卡余额

                            //减去该卡在其他项目上支付的金额
                            approvePayMoney -= $scope.cardTotalPayWithoutItem(one.payCard.id, item);

                            var payMoney = one.payInfo.cardPayMoney;

                            if (one.payInfo.cardPayMoney > approvePayMoney) {
                                if (window.featureConf.itemOnlyPayByOneCard) {
                                    $scope.removeItemPayInfo(item);
                                    return;
                                }

                                one.payInfo.cardPayMoney = approvePayMoney;
                            }

                            multiRechargePayMoney += payMoney;

                            var rechargePayBeforeDis = payMoney / (one.payInfo.discount / 10) + (one.payInfo.reduceMoney || 0);
                            if (rechargePayBeforeDis > item.money - itemCouponBefDis) {
                                rechargePayBeforeDis = item.money - itemCouponBefDis;
                            }
                            rechargeCardOldPrice += rechargePayBeforeDis;

                            if (one.payCard.consumePresentScore) {
                                presentScore += one.payInfo.cardPayMoney / one.payCard.consumePresentScore;
                            }
                        }
                        else if (one.payInfo.payType === "recordCard") {
                            recordCardOldPrice += item.unitPrice * one.payInfo.cardPayTimes;
                            multiRecordCardPayTimes += one.payInfo.cardPayTimes;
                            multiRecordPayMoney += one.payInfo.cardPayTimes * one.payCard.recordAvgPrice;
                        }
                        else if (one.payInfo.payType === "quarterCard") {
                            quarterCardOldPrice += item.unitPrice * one.payInfo.cardPayTimes;
                            multiQuarterCardPayTimes += one.payInfo.cardPayTimes;
                            multiRecordPayMoney += one.payInfo.times2Money;
                        }
                        else if (one.payInfo.payType === "presentService") {
                            //赠送
                            recordCardOldPrice += item.unitPrice * one.payInfo.cardPayTimes;
                            presentSPayTimes += one.payInfo.cardPayTimes;
                        }
                    });
                }
                totalMoney += item.money;
            });

            var quarterCardPayMoney = 0;
            var quarterOweMoney = 0;
            var quarterCouponPay = 0;//现金券支付年卡的部分

            _countQuarterPayMoney();

            var couponMorePay = $scope.getCouponMorePay(itemId2CouponPay);//现金券多付的钱有可能是支付超出年卡支付上限的部分

            if (couponMorePay > 0 && quarterOweMoney > 0) {
                quarterCouponPay = utils.toDecimalDigit(Math.min(couponMorePay, quarterOweMoney));
            }

            overMoney += utils.toDecimalDigit(quarterCardOldPrice - quarterCardPayMoney - quarterCouponPay);

            $scope.incomeStatus.quarterOweMoney = utils.toDecimalDigit(quarterOweMoney);

            $scope.incomeStatus.totalMoney = totalMoney;
            $scope.incomeStatus.couponPayMoney = couponPayMoney;

            $scope.incomeStatus.multiCardOverMoney = overMoney;//多卡支付剩余的金额

            $scope.incomeStatus.rechargeCardOldPrice = rechargeCardOldPrice;
            $scope.incomeStatus.recordCardOldPrice = recordCardOldPrice + quarterCardPayMoney;

            $scope.incomeStatus.rechargeCard = multiRechargePayMoney;
            $scope.incomeStatus.recordCard = multiRecordPayMoney;

            $scope.incomeStatus.payTimes = multiRecordCardPayTimes;
            $scope.incomeStatus.quarterPayTimes = multiQuarterCardPayTimes;
            $scope.incomeStatus.rechargeCardPresentScore = presentScore;

            $scope.incomeStatus.presentSPayTimes = presentSPayTimes;

            $scope.incomeStatus.needToPayMoney = _calcNeedToPayMoney();

            //对剩余的金额进行折扣、减免
            var paid = utils.toDecimalDigit(noDiscountMoney + $scope.payStatus.billDiscount * (overMoney - noDiscountMoney) / 10);
            $scope.incomeStatus.discountMoney = overMoney - paid;

            var temp = paid - $scope.payStatus.billReduce;//1位精度
            $scope.incomeStatus.paidMoney = utils.toDecimalDigit(temp, paidAccuracy);//应付金额，0|1位精度
            $scope.view.adjustMoney = utils.toDecimalDigit($scope.incomeStatus.paidMoney - temp);//对应收调整了多少钱

            //减免金额过大、不需要收钱...防止界面上出现负数
            if ($scope.incomeStatus.paidMoney < 0) {
                $scope.incomeStatus.paidMoney = 0;
            }

            $scope.payStatus.cardPay = $scope.incomeStatus.rechargeCard;

            function _countQuarterPayMoney() {
                var payByQuarterItem = _.filter($scope.buyProductRecords, function (item) {
                    var payContainsQuarter = !_.isEmpty(_.find(item.payCardList, function (one) {
                        return one.payInfo.payType === 'quarterCard';
                    }));

                    return payContainsQuarter;
                });

                var quarterCardId2PayMoney = {};

                _.each(payByQuarterItem, function (item) {
                    _.each(item.payCardList, function (one) {
                        if (quarterCardId2PayMoney[one.payCard.id]) {
                            quarterCardId2PayMoney[one.payCard.id] += item.money;
                        }
                        else {
                            quarterCardId2PayMoney[one.payCard.id] = item.money;
                        }
                    });
                });

                _.each(payByQuarterItem, function (item) {
                    _.each(item.payCardList, function (one) {
                        if (quarterCardId2PayMoney[one.payCard.id] > one.payCard.def_int1) {
                            quarterOweMoney += utils.toDecimalDigit(quarterCardId2PayMoney[one.payCard.id] - one.payCard.def_int1);

                            quarterCardId2PayMoney[one.payCard.id] = one.payCard.def_int1;
                        }
                    });
                });

                _.each(quarterCardId2PayMoney, function (money) {
                    quarterCardPayMoney += money;
                });
            }

            function _calcNeedToPayMoney() {
                var total = 0;

                _.each($scope.buyProductRecords, function (item) {
                    if (_.isEmpty(item.payCardList)) {
                        var discount = 10;

                        if (!item.noDiscount) {
                            discount = $scope.memberSelected.discountOfOneCard || 10;
                        }

                        total += item.money * discount / 10;
                        return;
                    }

                    _.each(item.payCardList, function (one) {
                        var payInfo = one.payInfo;
                        var payType = payInfo.payType;

                        var payByTimes = (payType === "recordCard" || payType === "quarterCard" || payType === "presentService");

                        if (payType === "rechargeCard") {
                            total += payInfo.cardPayMoney;
                        }
                        else if (payByTimes) {
                            total += payInfo.times2Money;
                        }
                    });
                });

                return total;
            }
        }

        function payStatusChange() {
            $scope.pay.cardTimes = $scope.incomeStatus.payTimes;//计次卡支付的次数
            $scope.pay.quarterCardTimes = $scope.incomeStatus.quarterPayTimes;//年卡支付的次数

            $scope.pay.prePaidCard = $scope.payStatus.cardPay + $scope.incomeStatus.recordCard;
            $scope.pay.bank = $scope.payStatus.bankPay;//银行卡金额
            $scope.pay.coupon = $scope.incomeStatus.couponPayMoney;

            //pay.cash表示理论上应该收取的现金
            if ($scope.isMultiCardMember() || $scope.isSingleRecordCardMember() || $scope.isSingleQuarterCardMember()) {
                //单计次卡或者多卡结算、paidMoney指除去卡支付后的金额
                $scope.pay.cash = $scope.incomeStatus.paidMoney - $scope.pay.bank;

                $scope.payStatus.cashChange = ($scope.payStatus.cashPay + $scope.payStatus.bankPay) - $scope.incomeStatus.paidMoney;
            }
            else {
                $scope.pay.cash = $scope.incomeStatus.paidMoney - $scope.pay.prePaidCard - $scope.pay.bank;

                $scope.payStatus.cashChange = ($scope.payStatus.cardPay + $scope.payStatus.cashPay + $scope.payStatus.bankPay) - $scope.incomeStatus.paidMoney;
            }

            //会员卡+银行卡超出应收导致计算pay.cash为负
            if ($scope.pay.cash < 0) {
                $scope.pay.cash = 0;
            }


            //会员卡+银行卡超出应收、找零=实收现金
            if ($scope.payStatus.cashChange > $scope.payStatus.cashPay) {
                $scope.payStatus.cashChange = $scope.payStatus.cashPay;
            }

            //现金支付不足，pay.cash=实付现金
            if ($scope.payStatus.cashChange < 0) {
                $scope.pay.cash = $scope.payStatus.cashPay;
            }
        }

        $scope.getCouponMorePay = function (itemId2CouponPay) {
            var couponPayMoney = 0;
            _.each($scope.payStatus.couponPayList, function (item) {
                couponPayMoney += item.money;
            });

            var itemCouponPay = 0;
            _.each(itemId2CouponPay, function (value) {
                itemCouponPay += value;
            });

            return utils.toDecimalDigit(couponPayMoney - itemCouponPay);
        };
    }

    exports.initControllers = initControllers;
});