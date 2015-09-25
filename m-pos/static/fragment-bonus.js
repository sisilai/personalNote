define(function (require, exports, module) {
    var utils = require("mframework/static/package").utils; 			//全局公共函数
    var serviceDao = require("m-dao/static/package").serviceDao;
    var numKeyboard = require("mframework/static/package").numKeyboard;
    var commonDao = require("m-dao/static/package").commonDao;

    function initModel(model) {
        model.bonusView = {
            searchKeyword: ""
        };

        cleanModel(model);
    }

    function cleanModel(model) {
        model.bonus = {
            selected_type: "items",
            billType: "",
            show_fixed_bonus: false,
            show_performance: true,
            employeeList: [],
            billInfo: {
                totalMoney: 0
            },
            whole: {
                employeeList: [],
                projectList: [],
                chgBonusFlag: false
            },
            items: {
                selectedProject: {},
                projectList: []
            },
            isAppoint: window.featureConf.isAppoint
        };
    }

    function initControllers($scope) {
        var confirmSuccessCallback;
        var bonus_serviceBill;

        global.eventEmitter.addListener("bonus.dialog.open", function (args) {
            $scope.bonus_openBonusSetting(args[0], args[1], args[2]);
        });

        //初始化提成设置界面
        $scope.bonus_openBonusSetting = function (serviceBill, confirmCallback) {
            _initTempVar();
            _cleanModel();
            _initBonusBill();

            _initProjectFixedBonus4Service(function (error) {
                if (error) {
                    utils.log("m-pos checkout-bonus loadModelAsync", error);
                    return;
                }
                _initBonusForm();
                _autoMatchEmployee();

                $scope.bonus_flipToEmployeeList();
                $scope.resetSyncFlag();
                $scope.digestScope();
            });

            function _initTempVar() {
                confirmSuccessCallback = confirmCallback;
                bonus_serviceBill = serviceBill;
                $scope.bonusView.bonusDialogHeadType = serviceBill.dialogHeadType || "none";
                $scope.bonusView.bonusCancelBtn = serviceBill.frontDiaHref ? "上一步" : "取消";
                $scope.bonusView.frontDiaHref = serviceBill.frontDiaHref || "";
            }

            function _cleanModel() {
                cleanModel($scope);
                if (serviceBill.featureType == "rechargeCard" || serviceBill.featureType == "newCard") {
                    $scope.bonus.billType = "cardBonus";
                }
            }

            function _initBonusBill() {
                $scope.bonus.billInfo.totalMoney = serviceBill.featureOptions.bill.amount;
            }

            //查询配置在服务上的固定提成
            function _initProjectFixedBonus4Service(callback) {
                if ($scope.bonus.billType == "cardBonus") {
                    callback(null);
                    return
                }
                var fixedBonusProjectNum = 0;
                serviceDao.initService(function (error, result) {
                    if (error) {
                        callback(error);
                        return;
                    }
                    var projectList = result.productList;

                    _.each(serviceBill.featureOptions.projectList, function (item) {
                        var project = projectList[item.project_id];

                        if (project && project.fixed_bonus) {
                            fixedBonusProjectNum++;
                            $scope.bonus.show_fixed_bonus = true;
                            item.serviceFixedBonus = Number(project.fixed_bonus);
                        }
                        else {
                            $scope.bonus.showCardPerformance = ($scope.bonus.showCardPerformance || (item.cardMoney != 0));
                            $scope.bonus.showCashPerformance = ($scope.bonus.showCashPerformance || (item.cashMoney != 0));
                        }

                        if (item.extraFixedBonus !== 0) {
                            $scope.bonus.show_fixed_bonus = true;
                        }
                    });

                    var existPerformance = (fixedBonusProjectNum != serviceBill.featureOptions.projectList.length);
                    var cashAndCard = ($scope.bonus.showCardPerformance && $scope.bonus.showCashPerformance);

                    //如果全部项目都是固定提成的话，则不显示业绩列
                    $scope.bonus.show_performance = (existPerformance && !cashAndCard);
                    if ($scope.bonus.show_performance) {
                        $scope.bonus.showCardPerformance = false;
                        $scope.bonus.showCashPerformance = false;
                    }

                    callback(null);
                });
            }

            function _initBonusForm() {
                $scope.bonus.whole = {
                    employeeList: [],
                    chgBonusFlag: false
                };
                //深克隆
                $scope.bonus.whole.projectList = JSON.parse(JSON.stringify(serviceBill.featureOptions.projectList));
                _.each(serviceBill.featureOptions.projectList, function (project, index) {
                    $scope.bonus.items.projectList.push(_.extend({
                        selected: index == 0,
                        id: project.id,
                        name: project.name,
                        money: project.money,
                        chgBonusFlag: false,
                        employeeList: []
                    }, JSON.parse(JSON.stringify(project))));
                });
            }

            function _autoMatchEmployee() {
                var itemList = $scope.bonus.items.projectList;

                _.each(itemList, function (item) {
                    $scope.bonus_selectBonusProject(item);

                    var serviceEmployee = _.find($scope.employeeList, function (employee) {
                        return employee.id === item.employeeId;
                    });

                    if (!_.isEmpty(serviceEmployee)) {
                        $scope.bonus_selectEmployee(serviceEmployee);
                    }
                });

                $scope.bonus_selectBonusProject(itemList[0]);
                utils.openFancyBox("#bonus-setting-form");
            }
        };
        //切换提成类型
        $scope.bonus_switchBonusType = function (type) {
            $scope.bonus_flipToEmployeeList();
            cleanAllInputStatus();
            $scope.bonus.selected_type = type;
        };

        //选择提成员工
        $scope.bonus_selectEmployee = function (employee) {
            employee.cacheFlag = true;

            var selectedProject, isFirst, newEmployee;
            if ($scope.bonus.selected_type == "whole") {
                isFirst = ($scope.bonus.whole.employeeList.length == 0);
                if (hasAdd($scope.bonus.whole.employeeList, employee)) {
                    return;
                }
                newEmployee = {
                    employee_id: employee.id,
                    employee_name: employee.name,
                    enterprise_id: employee.enterprise_id,
                    icon: "imgs/default-head.png",
                    bonus: 0,
                    performance: 0,
                    cashPerformance: 0,
                    cardPerformance: 0
                };
                $scope.bonus.whole.employeeList.push(newEmployee);
            }
            else if ($scope.bonus.selected_type == "items") {
                selectedProject = _.find($scope.bonus.items.projectList, function (project) {
                    return project.selected
                });
                if (!selectedProject) {
                    return;
                }
                isFirst = (selectedProject.employeeList.length == 0);
                if (hasAdd(selectedProject.employeeList, employee)) {
                    return;
                }
                newEmployee = {
                    project_id: selectedProject.id,
                    project_type: selectedProject.type,
                    employee_id: employee.id,
                    employee_name: employee.name,
                    enterprise_id: employee.enterprise_id,
                    icon: "imgs/default-head.png",
                    bonus: 0,
                    performance: 0,
                    cashPerformance: 0,
                    cardPerformance: 0,
                    markId: selectedProject.markId
                };
                selectedProject.employeeList.push(newEmployee);
            }
            if (isFirst) {//第一提成人
                first(newEmployee);
                $scope.digestScope();
            }
            else {//非第一提成人
                second(newEmployee);
                $scope.digestScope();
            }

            function hasAdd(employeeList, employee) {
                var emp = _.find(employeeList, function (item) {
                    return item.employee_id == employee.id
                });
                return emp ? true : false;
            }

            //第一提成人计算
            function first(newEmployee) {
                newEmployee.isFirst = true;
                if ($scope.bonus.selected_type == "whole") {
                    if ($scope.bonus.billType == "cardBonus") {//开卡，充值处理
                        newEmployee.init_bonus = 0;
                        newEmployee.init_performance = Number($scope.bonus.billInfo.totalMoney);
                        newEmployee.bonus = newEmployee.init_bonus;
                        newEmployee.performance = newEmployee.init_performance;
                    }
                    else {
                        //收银处理、2.1不再处理岗位上配置的服务类别的固定提成
                        //整单提成，不能将服务和卖品混合到一起，需要按单项提成的方式处理
                        newEmployee.init_bonus = 0;
                        newEmployee.init_extraBonus = 0; //额外固定提成
                        newEmployee.init_performance = 0;
                        newEmployee.init_cashPerformance = 0;
                        newEmployee.init_cardPerformance = 0;

                        _.each($scope.bonus.whole.projectList, function (item) {
                            var saleNum = item.saleNum || 1;
                            var projectFixedBonus = item.serviceFixedBonus;
                            if (projectFixedBonus) {
                                //总的固定提成金额=单个项目的固定提成金额*项目数量
                                newEmployee.init_bonus += (Number(projectFixedBonus) * Number(saleNum));
                            }
                            else {
                                newEmployee.init_extraBonus += item.extraFixedBonus || 0;

                                //item.money已经是相同项目累加到一起后的金额
                                newEmployee.init_performance += Number(item.money);

                                var itemCashPerformance = utils.toDecimalDigit(item.money * (item.cashMoney / (item.cardMoney + item.cashMoney) || 0), 1);
                                newEmployee.init_cashPerformance += itemCashPerformance;
                                newEmployee.init_cardPerformance += utils.toDecimalDigit(item.money - itemCashPerformance, 1);
                            }
                        });
                        newEmployee.bonus = newEmployee.init_bonus;
                        newEmployee.extraBonus = newEmployee.init_extraBonus;
                        newEmployee.cashPerformance = newEmployee.init_cashPerformance;
                        newEmployee.performance = newEmployee.init_performance;
                        newEmployee.cardPerformance = newEmployee.init_cardPerformance;
                    }
                }
                else if ($scope.bonus.selected_type == "items") {
                    var saleNum = selectedProject.saleNum || 1;
                    if (selectedProject.serviceFixedBonus) {//判断选择的项目上是否配置了服务固定提成
                        newEmployee.init_bonus = (Number(selectedProject.serviceFixedBonus) * Number(saleNum));
                        newEmployee.init_performance = 0;
                        newEmployee.bonus = newEmployee.init_bonus;
                        newEmployee.performance = newEmployee.init_performance;

                        _splitCardAndCash();
                    }
                    else {//根据选择员工，项目类别判断是否为固定提成项目
                        newEmployee.init_bonus = 0;
                        newEmployee.init_extraBonus = selectedProject.extraFixedBonus || 0;
                        newEmployee.init_performance = Number(selectedProject.money);

                        newEmployee.bonus = newEmployee.init_bonus;
                        newEmployee.extraBonus = newEmployee.init_extraBonus;
                        newEmployee.performance = newEmployee.init_performance;

                        _splitCardAndCash();
                    }
                }

                function _splitCardAndCash() {
                    var cardMoney = selectedProject.cardMoney;
                    var cashMoney = selectedProject.cashMoney;
                    var totalMoney = cardMoney + cashMoney;
                    newEmployee.init_cashPerformance = utils.toDecimalDigit(newEmployee.performance * (cashMoney / totalMoney));
                    newEmployee.init_cardPerformance = utils.toDecimalDigit(newEmployee.performance - newEmployee.init_cashPerformance);

                    newEmployee.cashPerformance = newEmployee.init_cashPerformance;
                    newEmployee.cardPerformance = newEmployee.init_cardPerformance;
                }
            }

            function second(newEmployee) {
                newEmployee.isFirst = false;
                var bonusEmployees = [];
                var chgBonusFlag = true;
                if ($scope.bonus.selected_type == "whole") {
                    bonusEmployees = $scope.bonus.whole.employeeList;
                    chgBonusFlag = $scope.bonus.whole.chgBonusFlag;
                }
                else {
                    bonusEmployees = selectedProject.employeeList;
                    chgBonusFlag = selectedProject.chgBonusFlag;
                }

                if (!chgBonusFlag) {//如果用户没有手动修改提成的话
                    avgEmpPerformanceAndBonus(bonusEmployees);
                } else {
                    newEmployee.bonus = 0;
                    newEmployee.extraBonus = 0;
                    newEmployee.performance = 0;
                    newEmployee.cardPerfromance = 0;
                    newEmployee.cashPerformance = 0;
                }
            }
        };

        function avgEmpPerformanceAndBonus(bonusEmployees) {
            if (bonusEmployees.length > 1) {
                var bonusEmpAmount = bonusEmployees.length;
                var firstBonusEmp = bonusEmployees[0];

                var initPerformance = Number(firstBonusEmp.init_performance);
                var initBonus = Number(firstBonusEmp.init_bonus);
                var initExtraBonus = Number(firstBonusEmp.init_extraBonus);
                var initCashPerformance = Number(firstBonusEmp.init_cashPerformance);
                var initCardPerformance = Number(firstBonusEmp.init_cardPerformance);

                var avgPerformance = utils.toDecimalDigit(initPerformance / bonusEmpAmount);
                var avgBonus = utils.toDecimalDigit(initBonus / bonusEmpAmount);
                var avgExtraBonus = utils.toDecimalDigit(initExtraBonus / bonusEmpAmount);
                var avgCashPerformance = utils.toDecimalDigit(initCashPerformance / bonusEmpAmount);
                var avgCardPerformance = utils.toDecimalDigit(initCardPerformance / bonusEmpAmount);

                var firstPerformance = utils.toDecimalDigit(initPerformance - (avgPerformance * (bonusEmpAmount - 1)));
                var firstBonus = utils.toDecimalDigit(initBonus - (avgBonus * (bonusEmpAmount - 1)));
                var firstExtraBonus = utils.toDecimalDigit(initExtraBonus - (avgExtraBonus * (bonusEmpAmount - 1)));
                var firstCashPerformance = utils.toDecimalDigit(initCashPerformance - (avgCashPerformance * (bonusEmpAmount - 1)));
                var firstCardPerformance = utils.toDecimalDigit(initCardPerformance - (avgCardPerformance * (bonusEmpAmount - 1)));

                _.each(bonusEmployees, function (item, index) {
                    if (index == 0) {
                        item.performance = firstPerformance;
                        item.bonus = firstBonus;
                        item.extraBonus = firstExtraBonus;
                        item.cashPerformance = firstCashPerformance;
                        item.cardPerformance = firstCardPerformance;
                        return;
                    }
                    item.performance = avgPerformance;
                    item.bonus = avgBonus;
                    item.extraBonus = avgExtraBonus;
                    item.cashPerformance = avgCashPerformance;
                    item.cardPerformance = avgCardPerformance;
                });
                $scope.digestScope();
            }
        }

        //提成确认提交
        $scope.bonus_commit = function () {
            //设置正在提交标记
            if ($scope.bonus.issubmitting) {
                return;
            }
            setTimeout(function () {
                $scope.bonus.issubmitting = false;
            }, 3000);
            $scope.bonus.issubmitting = true;

            var crateDate = new Date().getTime();
            var bonus_records = [];

            _buildBonusRecords();
            _rebuildItemBonusRecords();

            confirmSuccessCallback(bonus_records);

            function _buildBonusRecords() {
                if ($scope.bonus.billType === "cardBonus") {
                    _buildCardBonus();
                }
                else {
                    _buildItemBonus();
                }

                function _buildCardBonus() {
                    _.each($scope.bonus.whole.employeeList, function (emp) {
                        var bonusRecord = {
                            employee_id: emp.employee_id,
                            employee_name: emp.employee_name,
                            totalMoney: utils.toDecimalDigit(emp.performance),
                            bonusMoney: 0
                        };

                        _buildBonusRecord(bonusRecord, emp, null);
                        bonus_records.push(bonusRecord);
                    });
                }

                function _buildItemBonus() {
                    if ($scope.bonus.selected_type == "whole") {
                        if (_.isEmpty($scope.bonus.whole.employeeList)) {
                            return;
                        }

                        //总业绩
                        var totalPerformance = $scope.bonus.whole.employeeList[0].init_performance;
                        var totalCashPerformance = $scope.bonus.whole.employeeList[0].init_cashPerformance;
                        var totalCardPerformance = $scope.bonus.whole.employeeList[0].init_cardPerformance;

                        //总提成
                        var totalBonus = $scope.bonus.whole.employeeList[0].init_bonus;
                        var totalExtraBonus = $scope.bonus.whole.employeeList[0].init_extraBonus;

                        _.each($scope.bonus.whole.employeeList, function (emp) {
                            //员工分得业绩的比例（员工业绩/总业绩）
                            var empPerformanceRate = Number(emp.performance) / Number(totalPerformance);

                            var empCashPerformanceRate = (emp.cashPerformance / totalCashPerformance) || 0;
                            var empCardPerformanceRate = (emp.cardPerformance / totalCardPerformance) || 0;

                            //员工分得提成的比例（员工提成/总提成）
                            var empBonusRate = (emp.bonus / totalBonus) || 0;
                            var empExtraBonusRate = (emp.extraBonus / totalExtraBonus) || 0;

                            //计算每个项目中员工的提成和业绩
                            _.each($scope.bonus.whole.projectList, function (project) {
                                project.employeeBonus = project.employeeBonus || [];
                                var saleNum = project.saleNum || 1;
                                var projectFixedBonus = project.serviceFixedBonus;
                                var projectExtraFixedBonus = project.extraFixedBonus || 0;

                                var projectCardPerformance = (project.money / totalPerformance) * totalCardPerformance || 0;
                                var projectCashPerformance = project.money - projectCardPerformance;

                                var bonus = 0, performance = 0, cardPerformance = 0, cashPerformance = 0, extraBonus = 0;

                                if (projectFixedBonus) {//根据比例，计算分得的固定提成
                                    bonus = projectFixedBonus * saleNum * empBonusRate;
                                }
                                else {//根据比例，计算分得的业绩
                                    extraBonus = projectExtraFixedBonus * empExtraBonusRate;

                                    //money已经是unitPrice*saleNum*discount之后的金额
                                    performance = Number(project.money) * empPerformanceRate;
                                    cashPerformance = projectCashPerformance * empCashPerformanceRate;
                                    cardPerformance = projectCardPerformance * empCardPerformanceRate;
                                }

                                var empBonus = {
                                    project_id: project.project_id,
                                    itemCateId: project.cateId,
                                    employee_id: emp.employee_id,
                                    employee_name: emp.employee_name,
                                    bonusMoney: 0,
                                    totalMoney: utils.toDecimalDigit(performance),
                                    cashMoney: utils.toDecimalDigit(cashPerformance),
                                    cardMoney: utils.toDecimalDigit(cardPerformance),
                                    fixedBonus: utils.toDecimalDigit(bonus + extraBonus),
                                };

                                _buildBonusRecord(empBonus, emp, project);
                                project.employeeBonus.push(empBonus);
                            });
                        });
                        //为了解决获取到的业绩或提成不平的问题，每个项目中最后一个员工的提成或业绩，修改为该项目总的提成或业绩减去之前每个员工分得的提成或业绩
                        _rebuildProjectLastEmpBonusOrPerformance($scope.bonus.whole.projectList);
                    }
                    else if ($scope.bonus.selected_type == "items") {
                        _.each($scope.bonus.items.projectList, function (project) {
                            project.employeeBonus = [];
                            _.each(project.employeeList, function (emp) {
                                var empBonus = {
                                    project_id: project.project_id,
                                    itemCateId: project.cateId,
                                    employee_id: emp.employee_id,
                                    employee_name: emp.employee_name,
                                    bonusMoney: 0,
                                    totalMoney: utils.toDecimalDigit(emp.performance),
                                    cashMoney: utils.toDecimalDigit(emp.cashPerformance),
                                    cardMoney: utils.toDecimalDigit(emp.cardPerformance),
                                    fixedBonus: utils.toDecimalDigit(emp.bonus + emp.extraBonus),
                                    markId: emp.markId
                                };
                                _buildBonusRecord(empBonus, emp, project);
                                project.employeeBonus.push(empBonus);
                            });
                        });
                        //为了解决获取到的业绩或提成不平的问题，每个项目中最后一个员工的提成或业绩，修改为该项目总的提成或业绩减去之前每个员工分得的提成或业绩
                        _rebuildProjectLastEmpBonusOrPerformance($scope.bonus.items.projectList);
                    }
                }
            }

            function _rebuildItemBonusRecords() {
                if ($scope.bonus.billType == "cardBonus") {
                    return;
                }

                var projectList = [];
                if ($scope.bonus.selected_type == "whole") {
                    projectList = $scope.bonus.whole.projectList;
                }
                else if ($scope.bonus.selected_type == "items") {
                    projectList = $scope.bonus.items.projectList;
                }

                _.each(projectList, function (project) {
                    if (_.isEmpty(project.employeeBonus)) {
                        return;
                    }

                    _.each(project.employeeBonus, function (empBonus) {
                        bonus_records.push(empBonus);
                    });
                });
            }

            //为了解决获取到的提成或业绩不平的问题，每个项目中最后一个员工的提成或业绩，修改为该项目总的提成或业绩减去之前每个员工分得的提成或业绩
            function _rebuildProjectLastEmpBonusOrPerformance(projectList) {
                _.each(projectList, function (project) {
                    var fixedBonus = (project.serviceFixedBonus || 0);
                    var extraFixedBonus = (project.extraFixedBonus || 0);

                    var saleNum = project.saleNum || 1;
                    var projectFixedBonus = Number(fixedBonus) * Number(saleNum) + extraFixedBonus;

                    var notLastEmpTotalBonus = 0;

                    _.each(project.employeeBonus, function (empBonus, index) {
                        if (index != project.employeeBonus.length - 1) {
                            notLastEmpTotalBonus += empBonus.fixedBonus;
                        }
                        if (index == project.employeeBonus.length - 1) {
                            empBonus.fixedBonus = utils.toDecimalDigit(Number(projectFixedBonus) - notLastEmpTotalBonus);
                        }
                    });

                    var notLastEmpTotalPerformance = 0;

                    _.each(project.employeeBonus, function (empBonus, index) {
                        if (index !== project.employeeBonus.length - 1) {
                            notLastEmpTotalPerformance += empBonus.totalMoney;
                        }
                        else {
                            empBonus.totalMoney = utils.toDecimalDigit(Number(project.money) - notLastEmpTotalPerformance);
                            empBonus.cashMoney = utils.toDecimalDigit(empBonus.totalMoney - empBonus.cardMoney);
                        }
                    });
                });
            }

            function _buildBonusRecord(empBonus, employee, project) {
                empBonus.dateTime = bonus_serviceBill.featureOptions.bill.create_date;
                empBonus.create_date = crateDate;
                empBonus.serviceBill_id = bonus_serviceBill.featureOptions.bill.id;
                empBonus.enterprise_id = YILOS.ENTERPRISEID;
                empBonus.member_name = bonus_serviceBill.featureOptions.bill.member_name;
                empBonus.cardNo = bonus_serviceBill.featureOptions.bill.memberNo;
                empBonus.discount = (project && (project.discounts || project.discounts == 0)) ? project.discounts : 10;
                if ($scope.bonus.isAppoint) {
                    empBonus.isAppoint = employee.isAppoint ? 1 : 0;
                }

                var projectFixedBonus;
                if (!employee.isFirst) {
                    if ($scope.bonus.billType == "cardBonus") {
                        empBonus.type = bonus_serviceBill.featureType == "rechargeCard" ? (15 + 36) : (15 + 40);
                        empBonus.billDetail = "从服务单[" + bonus_serviceBill.featureOptions.bill.billNo + "]获取的业绩";
                    }
                    else {
                        projectFixedBonus = project.serviceFixedBonus;

                        if (projectFixedBonus) {
                            empBonus.type = 15;
                        }
                        else if (project.type == 1 || !project.type) {//分享服务业绩
                            empBonus.type = 15 + 33;
                        }
                        else if (project.type == 2) {//分享卖品业绩
                            empBonus.type = 15 + 34;
                        }

                        empBonus.billDetail = project.name + "，分享" + (empBonus.type == 15 ? "提成" : "业绩");
                    }
                }
                else {
                    empBonus.befDisMoney = $scope.bonus.billType == "cardBonus" ? $scope.bonus.billInfo.totalMoney : Number(project.unitPrice) * Number(project.saleNum);

                    if ($scope.bonus.billType == "cardBonus") {
                        empBonus.type = bonus_serviceBill.featureType == "rechargeCard" ? 36 : 40;
                        empBonus.billDetail = bonus_serviceBill.featureType == "rechargeCard" ? "充值提成" : "开卡提成";
                    }
                    else {
                        projectFixedBonus = project.serviceFixedBonus;

                        if (projectFixedBonus) {
                            if (project.type == 1 || !project.type) {//服务
                                empBonus.type = 1;//服务固定提成
                            }
                            else if (project.type == 2) {//卖品
                                empBonus.type = 2;//卖品暂时没有固定提成2014-05-27
                            }
                        }
                        else {
                            if (project.type == 1 || !project.type) {//服务业绩
                                empBonus.type = 33;
                            }
                            else if (project.type == 2) {//卖品业绩
                                empBonus.type = 34;
                            }
                        }
                        empBonus.billDetail = project.name;
                    }
                }
            }
        };

        //选中服务项目
        $scope.bonus_selectBonusProject = function (selectedProject) {
            $scope.bonus_flipToEmployeeList();
            cleanAllInputStatus();

            $scope.selectedStorageItem = null;
            _.each($scope.bonus.items.projectList, function (project) {
                project.selected = (project.markId === selectedProject.markId);

                if(project.selected && $scope.storageInfo && $scope.storageInfo[project.id]) {
                    $scope.selectedStorageItem = $scope.storageInfo[project.id];
                    $scope.selectedStorageItem.saleNum = project.saleNum;
                    $scope.selectedStorageItem.price = project.unitPrice;
                    $scope.selectedStorageItem.leftCount = Number($scope.selectedStorageItem.count) - project.saleNum;
                }
            });
        };

        $scope.bonus_modifyBonusOrPerformanceInput = function (key) {
            var bonusEmployeeRecord = $scope.bonusView.bonusEmployeeRecord;
            var employeeRecordList = $scope.bonusView.employeeRecordList;
            var modifyFiled = $scope.bonusView.modifyType;


            var isCardCashModify = (employeeRecordList.length === 1 && (modifyFiled === "cardPerformance" || modifyFiled === "cashPerformance"));

            if (isCardCashModify) {
                _firstModify();
            }
            else {
                _noFirstModify();
            }


            function _firstModify() {
                var cardAndCashPerformance = bonusEmployeeRecord.init_cardPerformance + bonusEmployeeRecord.init_cashPerformance;
                var modifyNum = Number(numKeyboard.clickKey(key));
                _reviseModifyNum();

                bonusEmployeeRecord["init_" + modifyFiled] = modifyNum;

                if (modifyFiled === "cardPerformance") {
                    bonusEmployeeRecord.init_cashPerformance = utils.toDecimalDigit(cardAndCashPerformance - bonusEmployeeRecord.init_cardPerformance);
                }

                if (modifyFiled === "cashPerformance") {
                    bonusEmployeeRecord.init_cardPerformance = utils.toDecimalDigit(cardAndCashPerformance - bonusEmployeeRecord.init_cashPerformance);
                }

                bonusEmployeeRecord.cardPerformance = bonusEmployeeRecord.init_cardPerformance;
                bonusEmployeeRecord.cashPerformance = bonusEmployeeRecord.init_cashPerformance;

                function _reviseModifyNum() {
                    if (utils.isWhatDecimal(modifyNum, 2)) {
                        modifyNum = Number(numKeyboard.revocation());
                    }

                    if (modifyNum > cardAndCashPerformance) {
                        modifyNum = cardAndCashPerformance;
                        numKeyboard.resetBoard(modifyNum);
                    }
                }
            }

            function _noFirstModify() {
                var firstEmployeeRecord = employeeRecordList[0];
                var befModifyNum, modifyNum, firstEmpNum;


                if (modifyFiled === "bonus") {
                    befModifyNum = bonusEmployeeRecord.bonus + bonusEmployeeRecord.extraBonus;
                    firstEmpNum = firstEmployeeRecord.bonus + firstEmployeeRecord.extraBonus;
                }
                else {
                    befModifyNum = bonusEmployeeRecord[modifyFiled];
                    firstEmpNum = firstEmployeeRecord[modifyFiled];
                }

                if (!numKeyboard.isBackKey(key) && !numKeyboard.isEmpty() && firstEmpNum === 0) {
                    return;
                }
                modifyNum = Number(numKeyboard.clickKey(key));
                _reviseModifyNum();

                if (modifyFiled === "bonus") {
                    var bonusRatio = bonusEmployeeRecord.bonus / befModifyNum;

                    if (_.isNaN(bonusRatio)) {
                        bonusRatio = 1;
                    }

                    bonusEmployeeRecord.bonus = utils.toDecimalDigit(modifyNum * bonusRatio);
                    bonusEmployeeRecord.extraBonus = modifyNum - bonusEmployeeRecord.bonus;
                }
                else {
                    bonusEmployeeRecord[modifyFiled] = modifyNum;
                }

                _modifyOtherEmp();
                _modifyOtherFiled();

                function _reviseModifyNum() {
                    if (utils.isWhatDecimal(modifyNum, 2)) {
                        modifyNum = Number(numKeyboard.revocation());
                    }

                    if (modifyNum > befModifyNum + firstEmpNum) {
                        modifyNum = befModifyNum + firstEmpNum;
                        numKeyboard.resetBoard(modifyNum);
                    }
                }

                function _modifyOtherEmp() {
                    if (bonusEmployeeRecord.isFirst) {
                        return;
                    }

                    if ($scope.bonus.selected_type == "whole") {
                        $scope.bonus.whole.chgBonusFlag = true;
                    }
                    else {
                        var bonusProject = _.find($scope.bonus.items.projectList, function (project) {
                            return project.id == bonusEmployeeRecord.project_id;
                        });
                        if (bonusProject) {
                            bonusProject.chgBonusFlag = true;
                        }
                    }

                    var noFirstTotal = 0, noFirstExtraBonus = 0;

                    for (var i = 1; i < employeeRecordList.length; i++) {
                        noFirstTotal += (employeeRecordList[i][modifyFiled] || 0);
                        noFirstExtraBonus += (employeeRecordList[i].extraBonus || 0);
                    }

                    //重新设置第一提成人提成信息
                    firstEmployeeRecord[modifyFiled] = utils.toDecimalDigit(firstEmployeeRecord["init_" + modifyFiled] - noFirstTotal);
                    firstEmployeeRecord.extraBonus = utils.toDecimalDigit(firstEmployeeRecord.init_extraBonus - noFirstExtraBonus);
                }

                function _modifyOtherFiled() {
                    if (modifyFiled === "bonus") {
                        return;
                    }

                    if (modifyFiled === "performance") {
                        _modifyCardAndCash();
                        return;
                    }

                    if (modifyFiled === "cardPerformance" || modifyFiled === "cashPerformance") {
                        _modifyPerformance();
                    }

                    function _modifyCardAndCash() {
                        _.each(employeeRecordList, function (item) {
                            var cashPerformance = item.cashPerformance;
                            var cardPerformance = item.cardPerformance;
                            var total = cardPerformance + cashPerformance;
                            var cashRate = cashPerformance / total;

                            item.cashPerformance = utils.toDecimalDigit(item.performance * cashRate);
                            item.cardPerformance = utils.toDecimalDigit(item.performance - item.cashPerformance);
                        });
                    }

                    function _modifyPerformance() {
                        _.each(employeeRecordList, function (item) {
                            item.performance = item.cardPerformance + item.cashPerformance;
                        });
                    }
                }
            }
        };

        //触发修改提成金额
        $scope.bonus_modifyBonusNumber = function (bonusEmployeeRecord, employeeRecordList, $event) {
            //第一提成人不允许修改
            if (bonusEmployeeRecord.isFirst) {
                return;
            }
            $scope.bonus_flipToKeyBoard();

            cleanAllInputStatus();
            addInputStatus($event);

            numKeyboard.resetBoard();
            $scope.bonusView.modifyType = "bonus";
            $scope.bonusView.bonusEmployeeRecord = bonusEmployeeRecord;
            $scope.bonusView.employeeRecordList = employeeRecordList;
        };

        //触发修改业绩金额
        $scope.bonus_modifyPerformanceNumber = function (bonusEmployeeRecord, employeeRecordList, modifyType, $event) {
            var isCardCashModify = ((modifyType === "cardPerformance" || modifyType === "cashPerformance") && employeeRecordList.length === 1);

            //第一提成人不允许修改
            if (bonusEmployeeRecord.isFirst && !isCardCashModify) {
                return;
            }
            $scope.bonus_flipToKeyBoard();

            cleanAllInputStatus();
            addInputStatus($event);

            numKeyboard.resetBoard();
            $scope.bonusView.modifyType = modifyType;
            $scope.bonusView.bonusEmployeeRecord = bonusEmployeeRecord;
            $scope.bonusView.employeeRecordList = employeeRecordList;
        };

        //删除整单提成记录
        $scope.bonus_deleteBonusRecord = function (index, employee, employeeRecordList) {
            $scope.bonus_flipToEmployeeList();
            cleanAllInputStatus();
            //如果是删除第一提成人，则删除所有附属提成人
            if (employee.isFirst) {
                $scope.bonus.whole.employeeList = [];
                $scope.bonus.whole.chgBonusFlag = false;
                $scope.digestScope();
                return;
            }
            $scope.bonus.whole.employeeList.splice(index, 1);
            //修正第一提成人提成金额
            modifyFirst();
            $scope.digestScope();

            //修改其他员工提成信息，多个员工提成时关联变化
            function modifyFirst() {
                //修改第一提成人提成金额，不影响其他人提成
                //修改非第一提成人，需要从第一提成人中减除
                if (employee.isFirst) {
                    return;
                }

                if ($scope.bonus.whole.chgBonusFlag || employeeRecordList.length == 1) {//如果用户已经手工修改了提成的话，或只有一个提成员工时，则不自动计算每个提成员工的平均提成了
                    var firstEmployeeRecord = employeeRecordList[0];
                    firstEmployeeRecord.bonus = utils.toDecimalDigit(Number(firstEmployeeRecord.bonus) + Number(employee.bonus));
                    firstEmployeeRecord.extraBonus = utils.toDecimalDigit(Number(firstEmployeeRecord.extraBonus) + Number(employee.extraBonus));
                    firstEmployeeRecord.performance = utils.toDecimalDigit(Number(firstEmployeeRecord.performance) + Number(employee.performance));
                    firstEmployeeRecord.cashPerformance = utils.toDecimalDigit(Number(firstEmployeeRecord.cashPerformance) + Number(employee.cashPerformance));
                    firstEmployeeRecord.cardPerformance = utils.toDecimalDigit(Number(firstEmployeeRecord.cardPerformance) + Number(employee.cardPerformance));
                }
                else {
                    avgEmpPerformanceAndBonus(employeeRecordList);
                }
            }
        };

        //删除项目提成记录
        $scope.bonus_deleteItemsBonusRecord = function (index, employee, employeeRecordList) {
            $scope.bonus_flipToEmployeeList();
            cleanAllInputStatus();
            var bonusProject = _.find($scope.bonus.items.projectList, function (project) {
                return project.id == employee.project_id;
            });
            if (employee.isFirst) {
                employeeRecordList.splice(0, employeeRecordList.length);
                if (bonusProject) {
                    bonusProject.chgBonusFlag = false;
                }
                $scope.digestScope();
                return;
            }

            employeeRecordList.splice(index, 1);
            //修正第一提成人提成金额
            modifyOther();
            $scope.digestScope();

            function modifyOther() {
                //修改第一提成人提成金额，不影响其他人提成
                //修改非第一提成人，需要从第一提成人中减除
                if (employee.isFirst) {
                    return;
                }

                if ((bonusProject && bonusProject.chgBonusFlag) || employeeRecordList.length == 1) {//如果用户已经手工修改了提成的话，或只有一个提成员工时，则不自动计算每个提成员工的平均提成了
                    var firstEmployeeRecord = employeeRecordList[0];
                    firstEmployeeRecord.bonus = utils.toDecimalDigit(Number(firstEmployeeRecord.bonus) + Number(employee.bonus));
                    firstEmployeeRecord.extraBonus = utils.toDecimalDigit(Number(firstEmployeeRecord.extraBonus) + Number(employee.extraBonus));
                    firstEmployeeRecord.performance = utils.toDecimalDigit(Number(firstEmployeeRecord.performance) + Number(employee.performance));
                    firstEmployeeRecord.cashPerformance = utils.toDecimalDigit(Number(firstEmployeeRecord.cashPerformance) + Number(employee.cashPerformance));
                    firstEmployeeRecord.cardPerformance = utils.toDecimalDigit(Number(firstEmployeeRecord.cardPerformance) + Number(employee.cardPerformance));

                } else {
                    avgEmpPerformanceAndBonus(employeeRecordList);
                }
            }
        };

        //关闭提成弹出框
        $scope.bonus_modalDialogClose = function () {
            $.fancybox.close();
        };

        $scope.bonus_backFrontStep = function () {
            utils.openFancyBox($scope.bonusView.frontDiaHref);
        };

        $scope.bonus_backEmployeeList = function () {
            cleanAllInputStatus();
            $scope.bonus_flipToEmployeeList();
        };

        $scope.bonus_flipToEmployeeList = function () {
            $scope.bonus_flipStatus = "employee";
        };

        $scope.bonus_flipToKeyBoard = function () {
            $scope.bonus_flipStatus = "keyboard";
        };

        $scope.searchOtherEmployee = function () {
            var keyword = $scope.bonusView.searchKeyword;

            _removePreviousSearchEmp();

            if (!keyword) {
                return;
            }

            commonDao.searchOtherStoreEmployee(keyword, function (error, result) {
                if (error) {
                    utils.log("fragment-bonus.js searchOtherEmployee", error);
                    utils.showGlobalMsg(error.errorMsg || "搜索他店员工失败，请稍后再试");
                    return;
                }

                _.each(result, function (item) {
                    item.branchFlag = true;
                });

                $scope.employeeList = result.concat($scope.employeeList);

                $scope.digestScope();
            });

            function _removePreviousSearchEmp() {
                $scope.employeeList = _.filter($scope.employeeList, function (item) {
                    return !item.branchFlag || item.cacheFlag;
                });
            }
        };

        // 指定客
        $scope.bonus_setAppointPerformance = function (bonusEmployee, employeeList, $event) {
            bonusEmployee.isAppoint = !bonusEmployee.isAppoint;
            if (bonusEmployee.isAppoint) {
                $($event.target).addClass("selected");
            } else {
                $($event.target).removeClass("selected");
            }
        }
    }

    function cleanAllInputStatus() {
        $("#bonus-setting-form .y_underline_input_selected").removeClass("y_underline_input_selected");
    }

    function addInputStatus($event) {
        $($event.target).addClass("y_underline_input_selected");
    }

    exports.initModel = initModel;
    exports.initControllers = initControllers;
});