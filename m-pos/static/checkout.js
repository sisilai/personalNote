define(function (require, exports, module) {
    exports.init = init;
    exports.switchMenu = switchMenu;
    exports.paramsChange = paramsChange;
    exports.afterPageLoaded = afterPageLoaded;
    exports.loadModelAsync = loadModelAsync;
    exports.initController = initController;
    exports.checktimeout = true;

    var smsUtils = require("mframework/static/package").httpsUtils;
    var utils = require("mframework/static/package").utils,
        cache = utils.getCache(),
        self = this;
    var moduleScope;
    var featureDataI = require("./checkout-dataI.js");
    var numKeyboard = require("mframework/static/package").numKeyboard;

    var fragment_checkoutCommit = require("./fragment-checkoutCommit.js");
    var fragment_checkout = require("./fragment-checkout.js");
    var fragment_bonus = require("./fragment-bonus.js");
    var fragment_member = require("./fragment-member.js");
    var fragment_amountCalculate = require("./fragment-amountCalculate.js");
    var fragment_pend = require("./fragment-pend.js");
    var fragment_newCard = require("./fragment-newCard.js");
    var fragment_build = require("./fragment-buildServiceBill.js");
    var fragment_pay = require('./fragment-pay.js');

    var systemSettingDao = require("m-dao/static/package").systemSettingDao;

    var serviceDao = require("m-dao/static/package").serviceDao;
    var memberDao = require("m-dao/static/package").memberDao;

    function loadModelAsync(params, callback) {
        var model = {
            productCategorieMap: {},    //可以选择的产品和服务类别对应的产品服务列表
            productCategories: {},      //类型ID与类型信息的映射
            productViewArray: [],       //界面需要展示的产品列表

            productCategorySelected: "memberRelItem",

            productSelected: {},        //操作当前选中的商品、可进行数量更改、从购买列表中去除等
            buyProductRecords: [],      //购买商品列表

            memberList: [],
            memberSelected: {},
            memberSearch: "",

            //金额收入状态、界面上一些不可更改的显示信息
            incomeStatus: {
                totalMoney: 0,
                discountMoney: 0,
                paidMoney: 0,
                rechargeCard: 0,
                recordCard: 0,
                rechargeCardOldPrice: 0,
                recordCardOldPrice: 0,
                servicePayTimes: {},
                payTimes: 0,
                multiCardOverMoney: 0,
                rechargeCardPresentScore: 0
            },

            //支付状态，折扣，减免，会员卡，现金...可在界面上更改
            payStatus: {
                billDiscount: featureConf.defaultDiscount,
                billReduce: 0,
                cashPay: 0,
                cashChange: 0,
                bankPay: 0,
                cardPay: 0,
                couponPayList: []
            },

            //支付方式实际支付金额
            pay: {
                cash: 0,
                prePaidCard: 0,
                quarterCardTimes: 0,
                cardTimes: 0,
                bank: 0,
                coupon: 0
            },

            employeeList: [],
            employeeSelected: {},

            view: {},

            sysMsgOptions: {
                msgContent: [],
                currentIndex: 0
            },

            numKeyList: numKeyboard.getKeyList(),//键盘按键集合

            bonusMode: 'real', //real|original

            itemSearch: "",

            memberRelItem: []
        };

        if (YILOS.INITCLEANCACHE == "true") {
            utils.getCache().clearAll();
        }

        initModel(model, callback);
    }

    function initModel(model, callback) {
        fragment_member.initModel(model);
        fragment_pend.initModel(model);
        fragment_bonus.initModel(model);

        initPageData(model, function (error) {
            if (error) {
                utils.log("m-setting checkout.js loadModelAsync", error);
                callback(null, model);
                return;
            }
            callback(null, model);
        });
    }

    //初始化页面数据模型
    function initPageData(model, callback) {
        async.waterfall([transferModel, initEmployeeData, initServiceData, initMemberCateList, initMsgSwitch, initTicketSwitch, initBonusMode], function (error, model) {
            if (error) {
                callback(error);
                return;
            }
            model.storeInfo = utils.getStoreInfo();

            callback(null);
        });

        //将Model往下传
        function transferModel(callback) {
            callback(null, model);
        }
    }

    //初始化员工数据
    function initEmployeeData(model, callback) {
        featureDataI.initEmployeeList(function (error, employeeList) {
            if (error) {
                utils.log("m-pos checkout.js initEmployeeData.featureDataI.initEmployeeList", error);
                callback(error);
                return;
            }
            model.employeeList = employeeList;
            callback(null, model);
        });
    }

    //初始化服务数据
    function initServiceData(model, callback) {
        serviceDao.initService(function (error, result) {
            if (error) {
                utils.log("m-pos checkout.js initServieData.featureDataI.initServiceList", error);
                callback(error);
                return;
            }

            model = _.extend(model, result);

            var itemId2Name = {};
            _.each(model.productList, function (item) {
                itemId2Name[item.id] = item.name;
            });
            model.serviceIdNameMap = itemId2Name;

            callback(null, model);
        });
    }

    function initMemberCateList(model, callback) {
        memberDao.queryCateList(function (error, result) {
            if (error) {
                callback(error);
                return;
            }

            model.rechargeCateList = result.rechargeCateList;

            var allCardList = result.quarterCateList.concat(result.recordCateList);

            var cateId2CardCate = {};

            _.each(allCardList, function (item) {
                cateId2CardCate[item.id] = item;
            });

            _.extend(model, result);

            model.allCardList = _.sortBy(allCardList, function (card) {
                return -card.baseInfo_minMoney;
            });

            model.cateId2CardCate = cateId2CardCate;

            callback(null, model);
        });
    }

    function initMsgSwitch(model, callback) {
        utils.getMsgSwitch(function (error, msgSwitch) {
            if (error) {
                utils.log("m-member allMemberList.js initMsgSwitch.utils.getMsgSwitch", error);
                callback(error);
                return;
            }
            model.msgSwitch = msgSwitch;
            callback(null, model);
        });
    }

    //初始化小票格式开关
    function initTicketSwitch(model, callback) {
        utils.getTicketSwitch(function (error, ticketSwitch) {
            if (error) {
                callback(error);
                return;
            }
            model.ticketSwitch = ticketSwitch;
            callback(null, model);
        });
    }

    function initBonusMode(model, callback) {
        systemSettingDao.getBonusMode(function (error, mode) {
            if (error) {
                callback(error);
                return;
            }

            model.bonusMode = mode;
            callback(null, model);
        });
    }

    function initController($scope, $location) {
        fragment_checkoutCommit.initControllers($scope);
        fragment_bonus.initControllers($scope);
        fragment_checkout.initControllers($scope);
        fragment_member.initControllers($scope);
        fragment_amountCalculate.initControllers($scope);
        fragment_pend.initControllers($scope);
        fragment_newCard.initControllers($scope);
        fragment_build.initControllers($scope);
        fragment_pay.initControllers($scope);

        moduleScope = $scope;

        //刷新Scope、
        $scope.digestScope = function () {
            setTimeout(function () {
                try {
                    $scope.$digest();
                }
                catch (error) {
                }
            }, 10);
        };

        $scope.modalDialogClose = function () {
            $.fancybox.close();
        };

        //选择类别
        $scope.choiceCate = function (cate, key) {
            // 过滤已下架的服务
            $scope.productViewArray = _.filter($scope.productCategorieMap[cate.id] || [], function (item) {
                return item.status != 0;
            });
            $scope.productCategorySelected = key;

            setTimeout(function () {
                self.productScroll = new IScroll("#product-item-list", {
                    offsetHeight: 0,
                    mouseWheel: false,
                    momentum: true,
                    bounce: true,
                    bounceTime: 200,
                    deceleration: 10,
                    click: false
                });

                self.productScroll.refresh();
                self.productScroll.scrollTo(0, 0, 1000);
            }, 100);
        };

        //选择会员卡类别
        $scope.choiceCardItem = function () {
            $scope.productCategorySelected = "cardItem";

            setTimeout(function () {
                self.productScroll = new IScroll("#product-item-list", {
                    offsetHeight: 0,
                    mouseWheel: false,
                    momentum: true,
                    bounce: true,
                    bounceTime: 200,
                    deceleration: 10,
                    click: false
                });

                self.productScroll.refresh();
                self.productScroll.scrollTo(0, 0, 1000);
            }, 100);
        };

        $scope.choiceMemberRelItem = function () {
            $scope.productCategorySelected = "memberRelItem";

            _initMemberRelItem();

            function _initMemberRelItem() {
                if (!$scope.isMemberSelected()) {
                    setTimeout(function () {
                        adjustHeight();
                        initOrFreshProductIScroll();
                    }, 100);
                    return;
                }

                _markItemTimesAndPrice();
                _showExpireQuarterCard();

                $scope.digestScope();

                setTimeout(function () {
                    adjustHeight();
                    initOrFreshProductIScroll();
                }, 100);

                function _showExpireQuarterCard() {
                    $scope.expireQuarterCard = _.clone($scope.memberSelected.expireCards);
                }

                function _markItemTimesAndPrice() {
                    $scope.memberRelItem = [];

                    _markRecordItem();
                    _markQuarterItem();
                    _markPresentItem();

                    function _markRecordItem() {
                        var recordCard = _.filter($scope.memberSelected.cards, function (card) {
                            return card.cateType === "record";
                        });

                        _.each(recordCard, function (card) {
                            var itemIds = _.keys(card.serviceId2Bonus);

                            _.each(itemIds, function (itemId) {
                                var balance = $scope.getRecordContainsServiceBalance(card, itemId);
                                if (!balance) {
                                    return;
                                }

                                var copyItem = _.clone($scope.productList[itemId]);

                                if (!_.isEmpty(copyItem)) {
                                    delete copyItem.$$hashKey;

                                    copyItem.isRecord = true;
                                    copyItem.remainingTimes = balance.times;
                                    copyItem.initTimes = card.timesLimit;
                                    copyItem.relatedCardId = card.id;
                                    if(!window.featureConf.cardShowOriPrice){
                                        copyItem.prices_salesPrice = card.recordAvgPrice;
                                    }
                                }

                                $scope.memberRelItem.push(copyItem);
                            });
                        });
                    }

                    function _markQuarterItem() {
                        var quarterCard = _.filter($scope.memberSelected.cards, function (card) {
                            return card.cateType === "quarter";
                        });

                        _.each(quarterCard, function (card) {
                            //window.featureConf.quarterUseHourInterval = "24";
                            // 馨米兰需求，避免店内恶意消费，季卡和年卡一天最多只能用一次
                            //如果该年卡或季卡已经支付过一次，则该年卡或年卡上的项目不在出现在收银界面的会员资料中
                            if (!_.isEmpty(card.paymentRecords) && !_.isEmpty(window.featureConf.quarterUseHourInterval)) {//季卡、年卡支付记录
                                var nowMill = new Date().getTime();
                                var lastPay = _.max(card.paymentRecords, function (item) {
                                    return item.dateTime;
                                });
                                var tempDate = new Date(lastPay.dateTime);
                                var tempTime = new Date(tempDate.getFullYear(), tempDate.getMonth(), tempDate.getDate() + 1).getTime();
                                if (nowMill < tempTime) {
                                    return;
                                }
                            }
                            var itemIds = _.keys(card.serviceId2Bonus);

                            _.each(itemIds, function (itemId) {
                                if (!$scope.isQuarterContainsService(card, itemId)) {
                                    return;
                                }

                                var copyItem = _.clone($scope.productList[itemId]);

                                if (!_.isEmpty(copyItem)) {
                                    delete copyItem.$$hashKey;

                                    copyItem.isQuarter = true;

                                    copyItem.remainingTimes = card.timesLimit - card.balance;
                                    copyItem.initTimes = card.timesLimit;

                                    copyItem.cardStartTime = card.dateTime;
                                    copyItem.cardEndTime = card.validTime;
                                    copyItem.relatedCardId = card.id;

                                    if(!window.featureConf.cardShowOriPrice){
                                        copyItem.prices_salesPrice = card.timesAvgPrice;
                                    }

                                    if (copyItem.remainingTimes < 0) {
                                        copyItem.remainingTimes = 0;
                                    }
                                }

                                $scope.memberRelItem.push(copyItem);
                            });
                        });
                    }

                    function _markPresentItem() {
                        // 赠送服务
                        var presents = $scope.memberSelected.presents || [];
                        _.each(presents, function (item) {
                            _.each(item.services || [], function (service) {
                                // 还有余次，并且有效
                                if (service.times > 0 && service.isValid) {
                                    var oneItem = _.clone($scope.productList[service.id]);

                                    if (oneItem) {
                                        delete oneItem.$$hashKey;
                                        oneItem.isPresent = true;
                                        oneItem.remainingTimes = service.times;
                                        oneItem.relatedCardId = service.sequenceId;
                                        $scope.memberRelItem.push(oneItem);
                                    }
                                }
                            });
                        });
                    }
                }
            }
        };

        //选择搜索
        $scope.choiceItemSearch = function () {
            $scope.productViewArray = [];
            $scope.productCategorySelected = "search";
            $scope.itemSearch = "";
        };

        $scope.searchBlur = function () {
            $("#item-search-input").blur()
        };

        $scope.clearItemSearch = function () {
            $scope.itemSearch = "";
            $scope.productViewArray = [];
        };

        $scope.$watch("itemSearch", function (newVal) {
            if ($scope.productCategorySelected === "search" && newVal === "") {
                $scope.productViewArray = [];
                $scope.allCardLists = [];

            }

            if ($scope.productCategorySelected !== "search" || newVal === "") {
                return;
            }

            $scope.productViewArray = filterItemOrCardList($scope.productList, newVal);

            $scope.allCardLists = filterItemOrCardList($scope.allCardList, newVal);

            setTimeout(function () {
                initOrFreshProductIScroll(true);
            }, 100);
        });

        function filterItemOrCardList(itemOrCardList, filterCondition) {
            return _.filter(_.values(itemOrCardList), function (item) {

                var itemPYList = utils.makePy(item.name);
                var matchShortName = false;

                _.each(itemPYList, function (one) {
                    if (one.indexOf(filterCondition.toUpperCase()) !== -1) {
                        matchShortName = true;
                    }
                });

                var matchName = (item.name || "").indexOf(filterCondition.toUpperCase()) !== -1;

                var price = Number(filterCondition);

                var itemOrCardPrice = item.prices_salesPrice;

                if (!_.isUndefined(item.baseInfo_minMoney)) {
                    itemOrCardPrice = item.baseInfo_minMoney;
                }

                var matchPrice = !_.isNaN(price) && Math.abs(itemOrCardPrice - price) <= 1;

                return (matchShortName || matchName || matchPrice) && item.status !== 0;
            }).slice(0, 50);
        }

        $scope.isProductSelected = function (product) {
            return $scope.isCompleteSameItem(product, $scope.productSelected);
        };

        //选择消费商品
        $scope.selectProduct = function (product, count) {
            if (!_.isUndefined(product.baseInfo_minMoney) && !$scope.isMemberSelected()) {
                utils.showGlobalMsg("请先选择已有会员或录入新会员资料");
                return;
            }

            var currentEmpSel = $scope.view.currentServiceEmpSelected;

            if (_.isEmpty(currentEmpSel)) {
                $scope.showServiceEmpSelect();
                $scope.showServiceEmpSelect.cacheItem = product;
                return;
            }
            $scope.view.currentServiceEmpSelectedShow = {};

            //添加至左边消费列表中
            var itemAfterConvert = _addProductRecord(product, count);

            $scope.calculateAmount();
            $scope.selectProductOrder(itemAfterConvert);

            $scope.multiCardAutoMatch();

            //添加消费商品，count:添加的数量、不传递默认为1
            function _addProductRecord(product, count) {
                var itemAfterConvert = {};

                var existItem = _.find($scope.buyProductRecords, function (item) {
                    return item.id === product.id && item.serviceEmployee.id === currentEmpSel.id && item.relatedCardId === product.relatedCardId;
                });

                if (!_.isEmpty(existItem)) {
                    existItem.saleNum++;
                    itemAfterConvert = existItem;

                    $scope.removeItemPayInfo(existItem);
                }
                else {
                    _addNewItem();
                }

                _freshScroll();

                return itemAfterConvert;

                function _freshScroll() {
                    if (!self.buyProductScroll) {
                        return;
                    }

                    if (!_.isEmpty(existItem)) {
                        var scrollIndex = 0;
                        _.each($scope.buyProductRecords, function (item, index) {
                            if ($scope.isCompleteSameItem(item, existItem)) {
                                scrollIndex = index;
                            }
                        });

                        self.buyProductScroll.scrollToElement(document.querySelector('#bill-product-list li:nth-child(' + (scrollIndex + 1) + ')'), 500);
                        self.buyProductScroll.refresh();
                    }
                    else {
                        setTimeout(function () {
                            self.buyProductScroll.scrollToElement(document.querySelector('#bill-product-list li:last-child'), 500);
                            self.buyProductScroll.refresh();
                        }, 100);
                    }
                }

                function _addNewItem() {
                    var isFirst = true;
                    _.each($scope.buyProductRecords, function (item) {
                        if (item.serviceEmployee.id === currentEmpSel.id) {
                            isFirst = false;
                        }
                    });

                    itemAfterConvert = _convertItem();

                    var lastIndex = utils.findLastIndex($scope.buyProductRecords, function (item) {
                        return item.serviceEmployee.id === currentEmpSel.id;
                    });

                    if (_.isNumber(lastIndex)) {
                        $scope.buyProductRecords.splice(lastIndex + 1, 0, itemAfterConvert);
                    }
                    else {
                        $scope.buyProductRecords.push(itemAfterConvert);
                    }

                    function _convertItem() {
                        if (!_.isUndefined(product.baseInfo_minMoney)) {
                            return _buildOneCard();
                        }

                        return _buildOneItem();
                    }

                    function _buildOneItem() {
                        return {
                            id: product.id,
                            saleNum: count || 1,
                            name: product.name,
                            money: product.prices_salesPrice * (count || 1),
                            unitPrice: product.prices_salesPrice,
                            originalPerformance: product.originalPerformance,
                            baseInfo_image: product.baseInfo_image,
                            cate_id: product.c_id,
                            cate_name: product.c_name,
                            type: product.type,
                            serviceList: product.service,//作为套盒关联的服务
                            isStoredInShop: (product.stored_in_shop == 1 || !_.isEmpty(product.service)),//寄存在店内或者有关联服务、表明是套合
                            cannotUseCard: product.cannotUseCard || false,
                            noDiscount: product.noDiscount || false,
                            storeInShop: false,
                            serviceEmployee: currentEmpSel,
                            isFirst: isFirst,
                            itemType: "item",
                            relatedCardId: product.relatedCardId
                        };
                    }

                    function _buildOneCard() {
                        var card = {
                            id: product.id,
                            saleNum: count || 1,
                            name: product.name,
                            cardNo: product.cardNo,
                            baseInfo_minMoney: product.baseInfo_minMoney,
                            money: product.baseInfo_minMoney * (count || 1),
                            unitPrice: product.baseInfo_minMoney * (count || 1),
                            cate_id: product.id,
                            cate_name: product.name,
                            type: 3,
                            serviceList: [],
                            isStoredInShop: false,
                            cannotUseCard: false,
                            noDiscount: true,
                            serviceEmployee: currentEmpSel,
                            isFirst: isFirst,
                            itemType: "card",
                            presentServices: product.presentServices || [],//季卡/年卡关联的赠送服务
                            relatedCardId: product.relatedCardId,
                            isExtension: product.isExtension || null//是否为续卡
                        };

                        if (product.dateTime) {
                            card.dateTime = product.dateTime;
                        }

                        return card;
                    }
                }
            }
        };

        //移除多卡支付的状态
        $scope.removeItemPayInfo = function (product, card) {
            if (_.isEmpty(product) || _.isEmpty(product.payCardList)) {
                return;
            }

            _adjustOtherQuarterCardPayActiveTimes();

            product.payCardList = _.filter(product.payCardList, function (item) {
                return !_.isEmpty(card) && item.payCard.id !== card.id;
            });

            $("#m-pos-member-card-select .y_dialog_header .y_step_status>li:nth-child(3)").show();

            function _adjustOtherQuarterCardPayActiveTimes() {
                _.each(product.payCardList, function (oneItem) {
                    var payCard = oneItem.payCard;
                    var payInfo = oneItem.payInfo;

                    // 年卡支付方式移除，可能导致其他项目被该年卡支付的有效次数变化
                    if (payInfo.payType !== 'quarterCard') {
                        return;
                    }

                    var currentItemActiveTimes = payInfo.activeTimes;
                    if (currentItemActiveTimes === 0) {
                        return;
                    }

                    var payBySameCardAndActiveTimesShortItem = _.filter($scope.buyProductRecords, function (item) {
                        return !_.isEmpty(_.find(item.payCardList, function (one) {
                            return one.payCard.id === payCard.id && one.payInfo.activeTimes !== one.payInfo.cardPayTimes;
                        }));
                    });

                    _.each(payBySameCardAndActiveTimesShortItem, function (item) {
                        _.each(item.payCardList, function (one) {
                            var itemPayInfo = one.payInfo;

                            var shortTimes = itemPayInfo.cardPayTimes - itemPayInfo.activeTimes;

                            if (currentItemActiveTimes <= 0) {
                                return;
                            }

                            if (currentItemActiveTimes >= shortTimes) {
                                itemPayInfo.activeTimes += shortTimes;

                            }
                            else if (currentItemActiveTimes < shortTimes) {
                                itemPayInfo.activeTimes += currentItemActiveTimes;
                            }

                            itemPayInfo.times2Money = itemPayInfo.activeTimes * one.payCard.timesAvgPrice;

                            currentItemActiveTimes -= shortTimes;
                        });
                    });
                });
            }
        };

        $scope.removeAllItemPayInfo = function () {
            _.each($scope.buyProductRecords, function (item) {
                delete item.payCardList;
            })
        };

        //选中订单中商品
        $scope.selectProductOrder = function (product) {
            _.each($scope.buyProductRecords, function (item) {
                if ($scope.isCompleteSameItem(product, item)) {
                    $scope.productSelected = item;
                }
            });
            $scope.digestScope();
        };

        //对消费商品中选中项进行数量增加
        $scope.addProductOrderNum = function (product) {
            if (!$scope.isProductSelected(product)) {
                $scope.selectProductOrder(product);
                return;
            }

            if (!_.isEmpty(product)) {
                product.saleNum++;
                $scope.removeItemPayInfo(product);
            }

            $scope.multiCardAutoMatch();
            $scope.calculateAmount();
        };

        //对消费商品中选中项进行数量减少
        $scope.reduceProductOrderNum = function (product) {
            if (!$scope.isProductSelected(product)) {
                $scope.selectProductOrder(product);
                return;
            }

            if (!_.isEmpty(product)) {
                if (product.saleNum > 1) {
                    product.saleNum--;
                    $scope.removeItemPayInfo(product);
                }
            }

            $scope.calculateAmount();

            $scope.multiCardAutoMatch();
        };

        $scope.changeProductSaleNum = function (product) {
            $scope.removeItemPayInfo(product);

            product.money = product.unitPrice * product.saleNum;
            $scope.multiCardAutoMatch();

            $scope.calculateAmount();
        };

        //从消费列表在中移除某商品
        $scope.deleteProductInOrder = function (product) {
            _.each($scope.buyProductRecords, function (item, index) {
                if ($scope.isCompleteSameItem(item, product)) {
                    $scope.buyProductRecords.splice(index, 1);

                    if (item.isFirst && !_.isEmpty($scope.buyProductRecords[index])) {
                        $scope.buyProductRecords[index].isFirst = true;
                    }
                }
            });

            if (_.isEmpty($scope.buyProductRecords)) {
                $scope.view.currentServiceEmpSelectedShow = $scope.view.currentServiceEmpSelected;
            }

            $scope.calculateAmount();
            $scope.productSelected = {};

            setTimeout(function () {
                initOrFreshOrderListIScroll(false);
            }, 100);
        };

        //修改单项产品价格弹出框
        $scope.changeProductPrice = function (product) {
            if (!featureConf.changePriceAccess) {
                return;
            }

            $scope.view.oldPrice = 0;
            if ($scope.productList[product.id]) {
                $scope.view.oldPrice = $scope.productList[product.id].prices_salesPrice;
            }

            $scope.view.changed_price = $scope.productSelected.unitPrice || 0;
            numKeyboard.resetBoard();
            utils.openFancyBox("#m-pos-change-price-popup");
            $scope.removeItemPayInfo(product);
        };

        //修改单项产品价格提交
        $scope.changeProductPriceCommit = function (price) {
            var buyProduct = _.find($scope.buyProductRecords, function (product) {
                return product.id === $scope.productSelected.id;
            });

            if (_.isEmpty(buyProduct)) {
                return;
            }

            buyProduct.unitPrice = price;
            buyProduct.oldPrice = price;
            buyProduct.money = buyProduct.unitPrice * buyProduct.saleNum;

            $scope.productSelected.unitPrice = price;
            $scope.calculateAmount();
            $scope.view.changed_price = 0;
            $scope.modalDialogClose();
        };


        $scope.showServiceEmpSelect = function () {
            utils.openFancyBox("#m-pos-service-employee-select");
        };

        $scope.serviceEmpSelect = function (employee) {
            $scope.view.currentServiceEmpSelectedTemp = employee;
        };

        $scope.serviceEmpSelectCommit = function () {
            if (_.isEmpty($scope.view.currentServiceEmpSelectedTemp)) {
                utils.showGlobalMsg("请选择服务员工");
                return;
            }

            var exitsItem = _.find($scope.buyProductRecords, function (item) {
                return item.serviceEmployee.id === $scope.view.currentServiceEmpSelectedTemp.id;
            });

            $scope.view.currentServiceEmpSelected = $scope.view.currentServiceEmpSelectedTemp;
            $scope.view.currentServiceEmpSelectedShow = $scope.view.currentServiceEmpSelectedTemp;

            if (!_.isEmpty(exitsItem)) {
                $scope.view.currentServiceEmpSelectedShow = {};
            }
            if (!_.isEmpty($scope.showServiceEmpSelect.cacheItem)) {
                $scope.selectProduct($scope.showServiceEmpSelect.cacheItem);
                delete $scope.showServiceEmpSelect.cacheItem;
            }

            $scope.view.currentServiceEmpSelected.cacheFlag = true;
            $scope.modalDialogClose();
        };

        $scope.changeServiceEmployee = function (product) {
            $scope.view.beforeChangeItem = product;
            $scope.view.currentServiceEmpSelectedTemp = product.serviceEmployee;

            utils.openFancyBox("#m-pos-service-employee-change");
        };

        $scope.serviceEmpChange = function (employee) {
            $scope.view.currentServiceEmpSelectedTemp = employee;
        };

        $scope.serviceEmpChangeCommit = function () {
            var beforeChangeItem = $scope.view.beforeChangeItem;
            var currentSelEmp = $scope.view.currentServiceEmpSelectedTemp;

            _removeFromPreviousEmployee();
            _add2AntherEmployee();

            $scope.multiCardAutoMatch();

            $scope.modalDialogClose();
            $scope.digestScope();

            function _removeFromPreviousEmployee() {
                $scope.buyProductRecords = _.filter($scope.buyProductRecords, function (item) {
                    //return item.id !== beforeChangeItem.id || item.serviceEmployee.id !== beforeChangeItem.serviceEmployee.id;
                    return !$scope.isCompleteSameItem(item, beforeChangeItem);
                });

                if (beforeChangeItem.isFirst) {
                    var previousEmpFirstItem = _.find($scope.buyProductRecords, function (item) {
                        return item.serviceEmployee.id === beforeChangeItem.serviceEmployee.id;
                    });

                    if (_.isEmpty(previousEmpFirstItem)) {
                        return;
                    }
                    previousEmpFirstItem.isFirst = true;
                }
            }

            function _add2AntherEmployee() {
                var selectEmpLastItem = utils.findLast($scope.buyProductRecords, function (item) {
                    return item.serviceEmployee.id === currentSelEmp.id;
                });

                beforeChangeItem.serviceEmployee = currentSelEmp;

                if (_.isEmpty(selectEmpLastItem)) {
                    beforeChangeItem.isFirst = true;
                    $scope.buyProductRecords.push(beforeChangeItem);
                    return;
                }

                beforeChangeItem.isFirst = false;
                var lastIndex = utils.findLastIndex($scope.buyProductRecords, function (item) {
                    return item.serviceEmployee.id === currentSelEmp.id;
                });

                if (_.isNumber(lastIndex)) {
                    var existItem = _.find($scope.buyProductRecords, function (item) {
                        return item.id === beforeChangeItem.id;
                    });

                    if (_.isEmpty(existItem)) {
                        $scope.buyProductRecords.splice(lastIndex + 1, 0, beforeChangeItem);
                        return;
                    }

                    existItem.saleNum += beforeChangeItem.saleNum;

                    $scope.removeItemPayInfo(existItem);
                }
            }
        };

        //改价输入
        $scope.changePriceInput = function (key) {
            //小数点后一位之后的输入忽略
            if (!numKeyboard.isBackKey(key) && utils.isWhatDecimal($scope.view.changed_price, 1)) {
                return;
            }

            //改价输入上限 100000
            if (!numKeyboard.isBackKey(key)) {
                if (parseFloat($scope.view.changed_price) > 100000) {
                    return;
                }
            }

            var keyValueTemp = Number(numKeyboard.clickKey(key));

            //NaN
            if (_.isNaN(keyValueTemp)) {
                $scope.view.changed_price = 0;
                numKeyboard.resetBoard();//出现NaN将键盘还原
            }
            else {
                $scope.view.changed_price = keyValueTemp;
            }
        };

        //清空单服务单所有信息
        $scope.clearOrder = function () {
            $scope.buyProductRecords = [];
            $scope.productSelected = {};
            $scope.memberSelected = {};
            $scope.view = {};
            $scope.view.branchStore = {};
            $scope.checkoutCustomComment = "";

            $scope.resetCalculateStatus();
        };

        //撤销当前单
        $scope.cancelOrder = function () {
            $scope.resetSyncFlag();
            $scope.clearOrder();
            $scope.clearPendBill();

            $scope.digestScope();

            setTimeout(function () {
                initOrFreshOrderListIScroll(true);
            }, 100);
        };

        //弹出会员选择框
        $scope.showMemberSel = function () {
            $scope.resetSyncFlag();
            numKeyboard.resetBoard();
            $scope.view.memberSelected = {};//重新选择会员
            _resetMemberSearch();
            _openDialog();

            function _resetMemberSearch() {
                $scope.memberSearch = "";
                $scope.memberList = [];
            }

            function _openDialog() {
                utils.openFancyBox("#m-pos-member-popup");
            }
        };

        //结算确认弹出窗
        $scope.openCheckoutConfirmDia = function () {
            $scope.view.dialogHrefStack = [];

            if ($scope.buyProductRecords.length === 0) {
                utils.showGlobalMsg($.i18n.t("checkout.error_4"));
                return;
            }

            if ($scope.isMemberSelected()) {
                if ($scope.isSingleCardMember() || $scope.isNoCardMember()) {
                    $scope.normalCheckoutConfirm();
                }
                else {
                    $scope.showCardSelectDia();
                }
            }
            else {
                $scope.normalCheckoutConfirm();
            }

            _queryProductStorageInfo();

            function _queryProductStorageInfo(){
                var idArray = [];
                _.each($scope.buyProductRecords, function(product){
                    if(product.type === 2){
                        idArray.push(product.id);
                    }
                })

                smsUtils.postRequest("/chain/" + YILOS.MASTERID + "/" + YILOS.ENTERPRISEID + "/productStorageItemInfo", {products: idArray}, function(result){
                    if(!result || result.code != 0){
                        return;
                    }

                    $scope.storageInfo = {};
                    _.each(result.result, function(item){
                        $scope.storageInfo[item.productId] = item;
                    })
                }, function(){});
            }
        };

        $scope.getEmpName = function (employeeId) {
            var name = "无";
            var empTemp = _.find($scope.employeeList, function (item) {
                return item.id == employeeId;
            });
            if (empTemp && empTemp.name) {
                name = empTemp.name;
            }
            return name;
        };

        //同步保护标志重置
        $scope.resetSyncFlag = function () {
            $scope.searchMember.doing = false;
            $scope.normalCommit.doing = false;
        };

        //确认License过期确认行为
        $scope.conformLicenseAlarm = function () {
            $.fancybox.close();
            $location.path("#/m-setting/account");
        };

        $scope.sendMsg = function (msgArg) {
            smsUtils.sendMessage(msgArg, function (data) {
                if (data.code == 1 && data.error.errorCode == "7000005") {
                    utils.showTips($.i18n.t("checkout.error_3"));
                }
            }, function (err) {

            });
        };

        $scope.clearServiceCache = function () {
            cache.clear("service.category2productMap", true);
            cache.clear("service.productList", true);
            cache.clear("service.categoryMap", true);
            cache.clear("service.categoryList", true);
        };

        $scope.showDialogError = function (dialogId, msg, delay) {
            var errorElement = $(dialogId + " .pos_dialog_tips");

            errorElement.text(msg).show();

            if (!delay) {
                delay = 2000;
            }
            setTimeout(function () {
                errorElement.hide();
            }, delay);
        };

        $scope.initOrFreshOrderListIScroll = function (scrollToTop) {
            initOrFreshOrderListIScroll(scrollToTop);
        };

        $scope.isCompleteSameItem = function (itemA, itemB) {
            if (_.isEmpty(itemA) || _.isEmpty(itemB)) {
                return false;
            }

            return itemA.id === itemB.id && itemA.serviceEmployee.id === itemB.serviceEmployee.id && itemA.relatedCardId === itemB.relatedCardId;
        };
    }

    function init() {

    }

    function afterPageLoaded() {
        setTimeout(function () {
            adjustHeight();
            initOrFreshProductIScroll();
            initOrFreshOrderListIScroll();
        }, 100);

        _initPendList();
        _addEventListener();

        function _initPendList() {
            featureDataI.initPendOrderList(function (error, pendList) {
                if (error) {
                    utils.log("m-pos fragment-pend.js initModel", error);
                    utils.showGlobalMsg(error.errorMsg || "挂单数据获取失败，请稍后再试");
                    return;
                }

                moduleScope.pend_pendList = pendList;
                moduleScope.pend_countPendShow();
                moduleScope.digestScope();
            });
        }

        function _addEventListener() {
            global.eventEmitter.addListener("m-member.member.memberChange", function (memberId, isUpgrade) {
                if (moduleScope.isMemberSelected() && memberId === moduleScope.memberSelected.id) {
                    if (isUpgrade) {
                        moduleScope.removeAllItemPayInfo();
                    }

                    moduleScope.queryAndSelectedMember(memberId);
                }
            });

            global.eventEmitter.addListener("m-member.member.newMember", function (memberId) {
                // 没选中会员，默认选中新加的会员
                if (!moduleScope.isMemberSelected()) {
                    moduleScope.queryAndSelectedMember(memberId);
                }
            });

            global.eventEmitter.addListener("system.baseSetting.refresh", function () {
                if (!moduleScope) {
                    return;
                }

                moduleScope.clearServiceCache();
                self.productScroll = null;

                initModel(moduleScope, function () {
                    moduleScope.digestScope();

                    _initPendList();

                    //在1s后重新计算高度，解决模型刷新了但是界面还没有刷新导致获取到的界面元素高度为0问题
                    setTimeout(function () {
                        adjustHeight();
                    }, 100);
                });
            });
        }
    }

    function switchMenu(params) {
        setTimeout(function () {
            adjustHeight();
        }, 100);

        initOrFreshProductIScroll();
        initOrFreshOrderListIScroll();
    }

    function paramsChange(params) {

    }

    function adjustHeight() {
        var main_container_h = $("#main-container").outerHeight();
        var product_cate = $("#m-pos-checkout-area .y_product_cate_list");

        var itemList = $("#m-pos-checkout-area #product-item-list");

        itemList.outerHeight(main_container_h - product_cate.outerHeight());

        var pos_order_h = $("#m-pos-checkout-area .pos_order").outerHeight();
        var pos_order_money_h = $("#m-pos-checkout-area .pos_order_money").outerHeight();
        $("#bill-product-list").height(main_container_h - pos_order_h - pos_order_money_h);

        var adjustRight = Math.abs(itemList.position().top + itemList.outerHeight() - main_container_h) < 10;

        if (adjustHeight.previousAdjust && adjustRight) {
            clearTimeout(adjustHeight.previousAdjust);
        }

        if (!adjustRight) {
            adjustHeight.previousAdjust = setTimeout(function () {
                adjustHeight();
            }, 100);
        }
    }

    function initOrFreshProductIScroll(scrollToTop) {
        if (self.productScroll) {
            self.productScroll.refresh();
            if (scrollToTop) {
                self.productScroll.scrollTo(0, 0, 1000);
            }
        }
        else {
            if ($("#product-item-list").is(':visible')) {
                self.productScroll = new IScroll("#product-item-list", {
                    offsetHeight: 0,
                    mouseWheel: false,
                    momentum: true,
                    bounce: true,
                    bounceTime: 200,
                    deceleration: 10,
                    click: false
                });
            }
            else {
                self.productScroll = null;
            }
        }
    }

    function initOrFreshOrderListIScroll(scrollToTop) {
        if (self.buyProductScroll) {
            self.buyProductScroll.refresh();

            if (scrollToTop) {
                self.buyProductScroll.scrollTo(0, 0, 1000);
            }
        }
        else {
            self.buyProductScroll = new IScroll('#bill-product-list', {
                offsetHeight: 0,
                mouseWheel: true,
                click: true
            });
        }
    }
});