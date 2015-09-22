define(function (require, exports, module) {
    var utils = require("mframework/static/package").utils; 			//全局公共函数
    var featureDataI = require("./checkout-dataI.js");
    var numKeyboard = require("mframework/static/package").numKeyboard;

    //该方法没有实现
    function initModel(model, callback) {

    }

    //初始化控制器
    function initControllers($scope) {

        //判断是否小于0
        $scope.isLessThanZero = function (num) {
            return Number(num) < 0;
        };
        参数：
            num: 数字
        返回：
            true: 小于0
            false: 不小于0

        //选择支付优惠券
        $scope.selectPayCoupon = function (coupon)
        参数：
            coupon: 优惠券对象

        //判断优惠券是否在支付列表里面
        $scope.inCouponPayList = function (coupon)
        参数：
            coupon: 优惠券对象
        返回：
            true：存在
            false: 不存在

        //收银弹出窗中的虚拟键盘输入
        $scope.payStatusInput = function (key)
        参数：
            key: 键盘上的字符

        //结算弹出框选择其中某项进行输入
        $scope.payStatusInputFocus = function (inputFiled)
        参数：
            inputFiled：记录当前输入的项:折扣、减免、现金、银行卡的英文表示

        //结算弹出框
        $scope.normalCheckoutConfirm = function ()

        //关闭收银窗口
        $scope.closeCheckoutDia = function ()

        //打开收银窗口
        $scope.showCheckoutDia = function ()

        //收银台的下一步操作
        $scope.checkoutNextStep = function ()

        //显示选择提成的弹出窗
        $scope.showBonusSelDia = function ()

        //收银提交
        $scope.checkoutCommit = function ()

        //收银成功后确认界面
        $scope.showCheckoutConfirmPage = function ()

        //关闭收银提交确认界面
        $scope.closeCheckoutConfirmPage = function ()

        //上传签名照片
        $scope.signature = function ()
        错误：弹出错误提示框"签名失败，请稍后再试"

        //得到优惠券提成信息
        $scope.getCouponBonusInfo = function ()
        返回：
            return {
                couponPayMoney: couponPayMoney,
                performance: performance,
                fixed: fixed
            };
        //获取每个项目对应的现金券支付金额
        $scope.buildItemId2CouponPay = function (itemList)
        参数：
            itemList: 项目对象列表
        返回：
            return itemId2CouponPay;//每个项目Id对应的现金券支付金额对象

        //获取每个项目Id对应的现金券绩效
        $scope.buildItemId2CouponPerformance = function (itemList, itemId2CouponPay)
        参数：
            itemList: 项目对象列表
            itemId2CouponPay: 每个项目Id对应的现金券支付金额对象
        返回：
            return itemId2CouponPerformance;//每个项目Id对应的现金券绩效对象
        {}

        //建立季卡项目Id对应其他支付
        $scope.buildQuarterItemId2OtherPay = function (itemList, totalCashPay, totalBankPay, totalCouponPay)
        参数：
            itemList: 项目对象列表
            totalCashPay: 总现金支付
            totalBankPay: 总银行支付
            totalCouponPay: 总优惠券支付
        返回：
            var itemId2OtherPay =
                [   'xxx':{
                    cashPay: xxx,
                    bankPay: xxx,
                    couponPay: xxx
                    },...]
            return itemId2OtherPay;

        //取反：$scope.view.showCouponSel = !$scope.view.showCouponSel;
        $scope.singleCardShowCouponSel = function ()

        //获取选择提示底部位置
        $scope.getSelectTips = function ()
        返回：距离底部（bottom）的像素，带单位

        //调整应收金额
        $scope.adjustShouldEarn = function ()

        //显示满意程度选择
        $scope.showEvaluationSelect = function ()

        //密码输入
        $scope.passwordInput = function (key)
        参数：
            key:虚拟键盘的键值

        //返回前一个对话框
        $scope.back2PreviousDialog = function ()