//收银提成选择模块
define(function (require, exports, module) {

    var utils = require("mframework/static/package").utils; 			//全局公共函数
    var featureDataI = require("./checkout-dataI.js");
    var numKeyboard = require("mframework/static/package").numKeyboard;
    var memberDao = require("m-dao/static/package").memberDao;
    var ticketDao = require("m-dao/static/package").ticketDao;

    //初始化模型
    function initModel(model) {
        model.recordCardRecTimes = [1, 2];
    }

    //初始化控制器
    function initControllers($scope) {
        //关闭会员选择框、
        $scope.closeMemberSelDia = function ()

        //选择会员
        $scope.selectMember = function (member)
        参数：
            member: 会员对象

        //多卡会员选择消费卡
        $scope.showCardSelectDia = function ()

        //多卡自动匹配
        $scope.multiCardAutoMatch = function ()

        //关闭卡选择对话框
        $scope.closeCardSelectDia = function ()

        //选择支付卡下一步操作
        $scope.selectPayCardNextStep = function ()

        //选择准备支付的项目
        $scope.selectPayItem = function (item)
        参数：
            item: 项目对象

        //移除当前选择项目卡支付
        $scope.removeCurrentSelItemCardPay = function ()

        //多卡充值
        $scope.multiCardRecharge = function (card)
        参数：
            card: 会员卡对象

        //单卡充值
        $scope.singleCardRecharge = function (card)
        参数：
            card: 会员卡对象

        //仅卡充值
        $scope.onlyCardRecharge = function (card)
        参数：
            card: 会员卡对象

        //过期卡选择
        $scope.expireCardSelect = function (card)
        参数：
            card: 会员卡对象

        //过期卡充值提交
        $scope.expireCardRechargeCommit = function ()

        //切换充值卡支付方式，$scope.cardRecharge.payMethod = payMethod;
        $scope.switchRechargePayMethod = function (payMethod)
        参数：
            payMethod: 支付方式英文表示

        //判断员工是否在列表里面
        $scope.isEmpInList = function (bonusEmpList, employee)
        参数：
            bonusEmpList： 提成员工列表
            employee: 员工对象
        返回：
            true： 存在
            false: 不存在

        //选择充值员工提成
        $scope.selectRechargeEmpBonus = function (employee)
        参数：
            employee: 员工对象

        //选择记录充值时间，$scope.cardRecharge.rechargeMultiple = rechargeTimes;
        $scope.selectRecordRechargeTimes = function (rechargeTimes)
        参数：
            rechargeTimes: 充值时间xxx

        //重置卡充值
        function resetCardRecharge()

        //打开卡充值对话框
        function openCardRechargeDia()

        //关闭卡充值对话框
        $scope.closeCardRechargeDia = function ()

        //检查收银充值
        $scope.checkPosRecharge = function ()
        返回：
            true：正确
            fals：错误

        //卡充值提交
        $scope.cardRechargeCommit = function ()
        成功：提示"充值成功"
        失败：提示"充值失败"

        //该方法目前没有使用
        $scope.getPresentSAvailableInfo = function (service, present)
        参数：
            service: 服务对象
            present: 赠送对象
        返回：
            return {
                useAvailable: true || false,
                typeDetail: 'xxx',
                usedService: {xxx:xxx,...}
            };

        //显示选择卡错误
        function _showSelectCardError(msg)
        参数：
            msg: 错误信息

        //选择支付赠送
        $scope.selectPayPresent = function (present, isAuto)
        参数：
            present:赠送对象
            isAuto: 是否自动 true || false

        //为支付项目选择某张卡
        $scope.selectPayCard = function (preparePayCard, isAutoMatch)
        参数：
            preparePayCard: 准备支付卡对象
            isAutoMatch: 是否自动匹配 true || false

        //是否是高级折扣类型、涉及到计算规则不一样
        $scope.isAdvancedDisType = function (memberCard)
        参数：
            memberCard: 会员卡对象
        返回：
            true： 一样
            false: 不一样

        //过滤不相关会员
        $scope.filterMemberIrrelevance = function ()

        //标记会员的一些标志
        $scope.markMemberSomeFlag = function ()

        //操作会员充值卡
        $scope.handleMemberRechargeCard = function ()

        //查询和选中会员
        $scope.queryAndSelectedMember = function (memberId, callback)
        参数：
            memberId: 会员ID
        返回：
            成功：callback(null);
            失败：callback(error);

        //选择会员确定按钮
        $scope.selMemberConfirm = function (callback)

        //判断项目能否卡支付
        $scope.isProductCannotPayByCard = function (product)
        参数：
            product: 项目对象
        返回：
            true：该项目不能卡支付
            false: 该项目可以卡支付

        //是否存在不能卡支付项目
        $scope.existCannotPayByCardProduct = function ()
        返回：
            true： 存在
            false； 不存在

        //是否选中会员
        $scope.isMemberSelected = function ()
        返回：
            true： 选中
            false； 没有选中

        //是否临时会员（散客？）
        $scope.isTempMember = function ()
        返回：
            true： 是临时会员
            false； 不是临时会员

        //是否是没有卡的会员
        $scope.isNoCardMember = function ()
        返回：
            true：没有卡会员
            false：有卡会员

        //是否是单卡会员
        $scope.isSingleCardMember = function ()
        返回：
            true：是单卡会员
            false：不是单卡会员

        //判断是否是多卡会员，会员消费不能使用会员卡支付的项目，按照多卡流程的方式收银
        $scope.isMultiCardMember = function ()
        返回：
            true：是多卡会员
            false: 不是多卡会员

        //是否是计次卡
        $scope.isRecordCard = function (memberCard)
        参数：
            memberCard: 会员卡对象
        返回：
            true：是计次卡
            false: 不是计次卡

        //是否是充值卡
        $scope.isRechargeCard = function (memberCard)
        参数：
            memberCard: 会员卡对象
        返回：
            true：是充值卡
            false: 不是充值卡

        //年/季卡
        $scope.isQuarterCard = function (memberCard)
        参数：
            memberCard: 会员卡对象
        返回：
            true：是年卡季卡
            false: 不是年卡季卡

        //单充值卡会员
        $scope.isSingleRechargeCardMember = function ()
        返回：
            true：是单充值卡会员
            false: 不是单充值卡会员

        //单计次卡会员
        $scope.isSingleRecordCardMember = function ()
        返回：
            true：是单计次卡会员
            false: 不是单计次卡会员

        //单年卡会员
        $scope.isSingleQuarterCardMember = function ()
        返回：
            true：是单年卡会员
            false: 不是单年卡会员

        //需要验证密码
        $scope.needToConfirmPassword = function ()
        返回：
            true：需要
            false: 不需要

        //是否为空
        $scope.isEmpty = function (obj)
        参数：
            obj: 对象
        返回：
            true: 空对象
            false: 飞空对象

        //查询会员
        $scope.searchMember = function (keyword)
        参数：
            keyword: 会员搜索关键字

        //会员搜索输入
        $scope.memberSearchInput = function (key)
        参数：
            key: 虚拟键盘按键名

        //使用系统键盘输入会员搜索条件
        $scope.inputSearchSysKey = function ()

        //清空搜索框文字
        $scope.clearMemberSearch = function ()

        //修改项目提成
        $scope.modifyItemDiscount = function (item)
        参数：
            item：项目对象

        //折扣减少修改提交
        $scope.discountReduceModifyCommit = function ()

        // 计次服务剩余次数
        $scope.recordServiceRemainingTimes = function (recordBalance, serviceId)
        参数：
            recordBalance: 计次卡余额
            serviceId: 服务Id
        返回：
            return remainingTimes;//剩余次数

        //季卡ID对应使用次数
        $scope.quarterCardId2ActiveTimes = function ()
        返回：
            return utils.deepClone(quarterCardId2ActiveTimes);//使用次数

        // 计次服务属于哪一组，－1表示没有找到相应组
        $scope.recordServiceGroup = function (recordCard, serviceId)
        参数：
            recordCard: 计次卡对象
            serviceId: 服务Id
        返回：
            return group;//组

        //计次卡是否包含服务
        $scope.isRecordContainsService = function (recordCard, serviceId)
        参数：
            recordCard: 计次卡
            serviceId: 服务Id
        返回：
            true：包含
            false;不包含

        //季卡是否包含服务
        $scope.isQuarterContainsService = function (quarterCard, serviceId)
        参数：
            quarterCard: 季卡
            serviceId: 服务Id
        返回：
            true：包含
            false;不包含

        //季卡服务绩效
        $scope.quarterServicePerformance = function (quarterCard, serviceId)
        参数：
            quarterCard: 季卡
            serviceId: 服务Id
        返回：
            return performance;//绩效

        //弹出编辑
        $scope.flipToEdit = function ()

        //弹出编辑卡列表
        $scope.flipToCardList = function ()

        //生日特权
        $scope.birthdayPrivilege = function ()

        //仅卡升级
        $scope.onlyCardUpGrade = function (card)
        参数：
            card: 卡对象

        //选择会员卡类别，$scope.view.upGradeModel.cardCate = cardCate;
        $scope.selectMemberCate = function (cardCate)
        参数：
            cardCate: 卡类别

        //升级卡提交
        $scope.upGradeCardCommit = function ()
        成功：提示"会员卡升级成功"
        失败：提示"会员卡升级失败，请稍后再试"