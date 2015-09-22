//支付金额计算
fragment-amountCalculate.js
    初始化angular控制器
    function initControllers($scope)

        //重置计算金额用到的状态
        $scope.resetCalculateStatus = function ()

        //重置收入状态
        function resetIncomeStatus()

        //重置支付状态
        function resetPayStatus()

        //重置支付
        function resetPay()

        //计算金额、散客|会员、会员分为单卡|多卡、卡分为计次卡|充值卡
        $scope.calculateAmount = function ()

        //散客
        function normalCalculate()

        //单充值卡计算
        function singleRechargeCalculate()

        //单计次卡计算
        function singleRecordCalculate()

        //单次季卡计算
        function singleQuarterCalculate()

        //多卡会员计算
        function multiCardMemberCalculate()

        //支付状态改变
        function payStatusChange()

        //获取更多优惠支付（该方法未使用）
        $scope.getCouponMorePay = function (itemId2CouponPay)