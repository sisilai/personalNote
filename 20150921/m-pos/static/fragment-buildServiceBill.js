define(function (require, exports, module) {
    var utils = require("mframework/static/package").utils;

    function initModel(model) {
    }

    function initControllers($scope) {
        //构造收银单的所有信息
        $scope.buildServiceBillInfo = function ()
        返回：
            return {
                serviceBill: {xxx:xxx,...},
                paymentDetailList: [xxx,...],
                projectList: [xxx,...],
                recordCardBalanceList: [xxx,...],
                quarterCardBalanceList: [xxx,...],
                presentBalanceList: [xxx,...],
                billBalanceList: [xxx,...],
                cardPaymentList: [xxx,...],
                consumeCardList: [xxx,...],
                memberScore: [xxx,...],
                usedCouponList: [xxx,...],
                depositList: [xxx,...],
                depositItemList: [xxx,...],
                depositConsumeList: [xxx,...]
            };

        //建立免费绩效
        $scope.buildFreePerformance = function (billInfo)