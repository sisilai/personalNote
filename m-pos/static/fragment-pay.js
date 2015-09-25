define(function (require, exports) {
    function initControllers($scope) {
        $scope.cardTotalPayWithoutItem = function (cardId, item) {
            var total = 0;

            _.each($scope.buyProductRecords, function (oneItem) {
                if ($scope.isCompleteSameItem(item, oneItem)) {
                    return;
                }

                _.each(oneItem.payCardList, function (one) {
                    if (one.payCard.id === cardId) {
                        if (one.payInfo.payType === 'rechargeCard') {
                            total += one.payInfo.cardPayMoney;
                        }
                        else {
                            total += one.payInfo.cardPayTimes;
                        }
                    }
                });
            });

            return total;
        };

        $scope.payByMoneyItemList = function () {
            return _.filter($scope.buyProductRecords, function (item) {
                var payContainsRechargeCard = _.find(item.payCardList, function (one) {
                    return one.payInfo.payType === 'rechargeCard';
                });

                return _.isEmpty(item.payCardList) || payContainsRechargeCard;
            });
        };

        $scope.isCardPayInItem = function (cardId, item) {
            if (_.isEmpty(item)) {
                return false;
            }

            return !_.isEmpty(_.find(item.payCardList, function (one) {
                return one.payCard.id === cardId;
            }));
        };

        $scope.isPresentPayInItem = function (sequenceId, item) {
            if (_.isEmpty(item)) {
                return false;
            }

            return !_.isEmpty(_.find(item.payCardList, function (one) {
                return !_.isEmpty(one.payInfo.present) && one.payInfo.present.sequenceId === sequenceId;
            }));
        };

        $scope.itemUnpaidRemainingTimes = function (item) {
            var remainingTimes = item.saleNum;

            _.each(item.payCardList, function (one) {
                if (one.payInfo.payType === 'rechargeCard') {
                    var reduce = (one.payInfo.reduceMoney || 0);
                    var discount = (one.payInfo.discount || 10);

                    var times = Math.ceil((one.payInfo.cardPayMoney + reduce) / discount * 10 / item.unitPrice);
                    remainingTimes -= times;
                }
                else {
                    remainingTimes -= one.payInfo.cardPayTimes;
                }
            });

            if (remainingTimes < 0) {
                remainingTimes = 0;
            }

            return remainingTimes;
        };

        $scope.itemUnpaidRemainingMoney = function (item) {
            var remainingMoney = item.money;

            _.each(item.payCardList, function (one) {
                if (one.payInfo.payType === 'rechargeCard') {
                    var reduce = (one.payInfo.reduceMoney || 0);
                    var discount = (one.payInfo.discount || 10);

                    remainingMoney -= (one.payInfo.cardPayMoney + reduce) / discount * 10;
                }
                else {
                    remainingMoney -= one.payInfo.cardPayTimes * item.unitPrice;
                }
            });

            if (remainingMoney < 0) {
                remainingMoney = 0;
            }

            return remainingMoney;
        };

        $scope.itemUnpaidRemainingMoneyWithoutOnePay = function (item, payId) {
            var remainingMoney = item.money;

            _.each(item.payCardList, function (one) {
                if (one.payInfo.id === payId) {
                    return;
                }

                if (one.payInfo.payType === 'rechargeCard') {
                    var reduce = (one.payInfo.reduceMoney || 0);
                    var discount = (one.payInfo.discount || 10);

                    remainingMoney -= (one.payInfo.cardPayMoney + reduce) / discount * 10;
                }
                else {
                    remainingMoney -= one.payInfo.cardPayTimes * item.unitPrice;
                }
            });

            if (remainingMoney < 0) {
                remainingMoney = 0;
            }

            return remainingMoney;
        };

        $scope.itemReselectPay = function (item) {
            var payIdList = [];

            _.each(item.payCardList, function (one) {
                if (one.payInfo.payType === 'presentService') {
                    payIdList.push(one.payInfo.present.sequenceId);
                    return;
                }

                payIdList.push(one.payCard.id);
            });

            $scope.removeItemPayInfo(item);

            _.each(payIdList, function (id) {
                var payCard = _.find($scope.memberSelected.cards, function (one) {
                    return one.id === id;
                });
                if (!_.isEmpty(payCard)) {
                    $scope.selectPayCard(payCard);
                    return;
                }

                var payPresent = _.find($scope.memberSelected.presents, function (one) {
                    return one.sequenceId === id;
                });
                if (_.isEmpty(payCard)) {
                    $scope.selectPayPresent(payPresent)
                }
            });
        };
    }

    exports.initControllers = initControllers;
});