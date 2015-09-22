
    //初始化提成模型
    function initModel(model)

    //整理提成模型
    function cleanModel(model)

    //初始化控制器
    function initControllers($scope)

        //初始化提成设置界面
        $scope.bonus_openBonusSetting = function (serviceBill, confirmCallback)
        参数：
        var serviceBill =
            {
                frontDiaHref: {},
                dialogHeadType: 'xxx',
                featureType: "checkout",//业务调用方类型描述、如收银，开卡，充值...
                featureOptions: {
                bill: {
                    id: 'xxx',
                        amount: xxx,
                        discount: xxx,
                        member_name: 'xxx',
                        memberNo: 'xxx',
                        create_date: 'xxx',
                        billNo: 'xxx'
                },//流水
                projectList: []//项目列表
            }//跟据业务type描述不同，featureOptions结构不同

        //切换提成类型（目前该方法未使用）
        $scope.bonus_switchBonusType = function (type)

        //选择提成员工
        $scope.bonus_selectEmployee = function (employee)
        参数：
            employee: 员工对象

        //员工平均提成和绩效
        function avgEmpPerformanceAndBonus(bonusEmployees)
        参数：
            employee: 提成员工对象数组

        //提成确认提交
        $scope.bonus_commit = function ()

        //选中服务项目
        $scope.bonus_selectBonusProject = function (selectedProject)
        参数：
            selectedProject：项目对象

        //修改提成或者绩效输入
        $scope.bonus_modifyBonusOrPerformanceInput = function (key)
        参数：
            key： 键盘按键字符

        //触发修改提成金额
        $scope.bonus_modifyBonusNumber = function (bonusEmployeeRecord, employeeRecordList, $event)
        参数：
            bonusEmployeeRecord: 提成员工记录对象
            employeeRecordList: 员工记录列表数组
            $event: 默认传入$event

        //触发修改业绩金额
        $scope.bonus_modifyPerformanceNumber = function (bonusEmployeeRecord, employeeRecordList, modifyType, $event)
        参数：
            bonusEmployeeRecord: 提成员工记录对象
            employeeRecordList: 员工记录列表数组
            modifyType: 修改类型'xxx'
            $event: 默认传入$event

        //删除整单提成记录（目前该方法未使用）
        $scope.bonus_deleteBonusRecord = function (index, employee, employeeRecordList)
        参数：
            index: 删除元素的数组下标
            employee: 员工对象
            employeeRecordList:员工记录集合数组

        //删除项目提成记录
        $scope.bonus_deleteItemsBonusRecord = function (index, employee, employeeRecordList)
        参数：
            index: 删除元素的数组下标
            employee: 员工对象
            employeeRecordList:员工记录集合数组

        //关闭提成弹出框
        $scope.bonus_modalDialogClose = function ()

        //设置员工提成时返回上一步
        $scope.bonus_backFrontStep = function ()

        //返回员工提成列表
        $scope.bonus_backEmployeeList = function ()

        //设置$scope.bonus_flipStatus = "employee";
        $scope.bonus_flipToEmployeeList = function ()

        //设置$scope.bonus_flipStatus = "keyboard";
        $scope.bonus_flipToKeyBoard = function ()

        //查找其他员工
        $scope.searchOtherEmployee = function ()

        // 指定客
        $scope.bonus_setAppointPerformance = function (bonusEmployee)
        参数：
            bonusEmployee: 提成员工对象
            $event: 默认传入$event

    //清除所有界面输入状态
    function cleanAllInputStatus()

    //增加界面输入状态
    function addInputStatus($event)