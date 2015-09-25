define(function (require, exports, module) {
    var utils = require("mframework/static/package").utils; 			//全局公共函数
    var featureDataI = require("./checkout-dataI.js");
    var numKeyboard = require("mframework/static/package").numKeyboard;
    var memberDao = require("m-dao/static/package").memberDao;

    function initModel(model, callback) {
        model.newCustomerImage = {
            doing : false
        }
    }

    function initControllers($scope) {
        $scope.isLessThanZero = function (num) {
            return Number(num) < 0;
        };

        $scope.selectPayCoupon = function (coupon) {
            var validMilli = coupon.valid * (1000 * 60 * 60 * 24);//过期时间转换为毫秒数
            var validDate = new Date(coupon.dateTime + validMilli);
            if (validDate.getTime() < new Date().getTime()) {
                _showSelectCardError("该现金券已失效");
                $scope.showDialogError("#m-pos-checkout-popup", "该现金券已失效");
                return;
            }

            var payExist = _.findWhere($scope.payStatus.couponPayList, {id: coupon.id});

            if (_.isEmpty(payExist)) {
                $scope.payStatus.couponPayList.push(coupon);
            }
            else {
                $scope.payStatus.couponPayList = _.without($scope.payStatus.couponPayList, payExist);
            }
            $scope.calculateAmount();

            var namesList = [];
            _.each($scope.payStatus.couponPayList, function (item) {
                namesList.push(item.name + "(￥" + utils.toDecimalDigit(item.money) + ")");
            });

            $scope.view.couponNameList = namesList.join("，");
            $scope.view.showCouponSel = false;

            function _showSelectCardError(msg) {
                $("#m-pos-member-card-select .multi_card_tips").hide();

                var errorMsg = $("#select-card-error").text(msg).show();
                setTimeout(function () {
                    errorMsg.hide();
                }, 2000);
            }
        };

        $scope.inCouponPayList = function (coupon) {
            return !_.isEmpty(_.findWhere($scope.payStatus.couponPayList, {id: coupon.id}));
        };

        //收银弹出窗中的虚拟键盘输入
        $scope.payStatusInput = function (key) {
            if ($scope.isMemberSelected() && !window.featureConf.memberCanUseCashAccess && _.contains(['cashPay', 'bankPay'], $scope.view.inputFiled)) {
                utils.showGlobalMsg('总店已设置会员不可使用现金消费');
                return;
            }

            $scope.payStatus[$scope.view.inputFiled] = Number(numKeyboard.clickKey(key));

            //减免，现今，银行卡小数点后一位之后的输入忽略
            if (!numKeyboard.isBackKey(key) && utils.isWhatDecimal($scope.payStatus[$scope.view.inputFiled], 2)) {
                $scope.payStatus[$scope.view.inputFiled] = Number(numKeyboard.revocation());
                return;
            }

            //最多输入999999.99、防止界面上输入框内容在iPad mini上换行
            if (!numKeyboard.isBackKey(key)) {
                if ((Number($scope.payStatus[$scope.view.inputFiled])) >= 1000000) {
                    $scope.payStatus[$scope.view.inputFiled] = Number(numKeyboard.revocation());
                    return;
                }
            }

            if ($scope.view.inputFiled === "cardPay") {
                $scope.view.cardPayChangeManually = true;

                //输入大于会员最多应收、
                if ($scope.payStatus.cardPay > $scope.incomeStatus.rechargeCard) {
                    $scope.payStatus.cardPay = $scope.incomeStatus.rechargeCard;
                    numKeyboard.resetBoard($scope.payStatus.cardPay);
                }
            }

            if ($scope.view.inputFiled === "billDiscount") {
                //折扣被手工更改、此时整单按照此折扣计算、忽略充值卡上的折扣规则
                $scope.view.disChangegManually = true;

                //输入大于10时、使用新输入的值
                if ($scope.payStatus.billDiscount > 10) {
                    $scope.payStatus.billDiscount = Number(numKeyboard.resetBoard(key));
                }

                //全部删除后、显示成 无:10折
                if (numKeyboard.isEmpty()) {
                    $scope.payStatus.billDiscount = featureConf.defaultDiscount;
                }
            }

            $scope.calculateAmount();
        };

        //结算弹出框选择其中某项进行输入
        $scope.payStatusInputFocus = function (inputFiled) {
            numKeyboard.resetBoard();

            //记录当前输入的项:折扣、减免、现金、银行卡
            $scope.view.inputFiled = inputFiled;
        };

        //结算弹出框
        $scope.normalCheckoutConfirm = function () {
            numKeyboard.resetBoard();

            //默认选中现金输入框
            if ($scope.isSingleRechargeCardMember()) {
                $scope.view.inputFiled = "cardPay";
            }
            else {
                $scope.view.inputFiled = "cashPay";
            }

            $scope.calculateAmount();
            $scope.showCheckoutDia();

            //会员结算、
            if ($scope.isSingleCardMember()) {
                var singleCard = $scope.memberSelected.cards[0];
                if (!singleCard.isValid) {
                    $scope.view.cardBalanceShort = false;
                    //会员卡失效
                    $scope.showDialogError("#m-pos-checkout-popup", $.i18n.t("checkout.membercard_valid"));
                }
                else if (singleCard.balance < $scope.incomeStatus.paidMoney && $scope.isRechargeCard(singleCard)) {
                    $scope.view.cardBalanceShort = true;
                    //充值卡会员有效余额不足
                    $scope.showDialogError("#m-pos-checkout-popup", $.i18n.t("checkout.membercar_not_sufficient"));
                }
                else {
                    $scope.view.cardBalanceShort = false;
                }
            }

            $scope.digestScope();
        };

        //关闭收银窗口
        $scope.closeCheckoutDia = function () {
            $scope.payStatus.billDiscount = featureConf.defaultDiscount;
            $scope.payStatus.billReduce = 0;

            if ($scope.isSingleRechargeCardMember()) {
                var singleCard = $scope.memberSelected.cards[0];
                if ($scope.isRechargeCard(singleCard) && !$scope.isAdvancedDisType(singleCard)) {
                    $scope.payStatus.billDiscount = singleCard.discounts;
                }
                else {
                    //关闭结算窗重新使用会员高级折扣计算模型
                    $scope.view.disChangegManually = false;
                }
            }

            $scope.calculateAmount();
            utils.openFancyBox($scope.view.dialogHrefStack.pop())
        };

        $scope.showCheckoutDia = function () {
            utils.openFancyBox("#m-pos-checkout-popup");
        };

        $scope.checkoutNextStep = function () {
            $scope.view.dialogHrefStack.push("#m-pos-checkout-popup");

            $scope.showBonusSelDia();
        };

        //显示选择提成的弹出窗
        $scope.showBonusSelDia = function () {
            if ($scope.isSingleRechargeCardMember()) {
                if (!utils.isNumberEqual(($scope.pay.cash + $scope.pay.prePaidCard + $scope.pay.bank), $scope.incomeStatus.paidMoney)) {
                    $scope.showDialogError("#m-pos-checkout-popup", $.i18n.t("checkout.error_5"));
                    $scope.view.dialogHrefStack.pop();
                    return;
                }
            }
            else {
                if (!utils.isNumberEqual(($scope.pay.cash + $scope.pay.bank), $scope.incomeStatus.paidMoney)) {
                    $scope.showDialogError("#m-pos-checkout-popup", $.i18n.t("checkout.error_5"));
                    $scope.view.dialogHrefStack.pop();
                    return;
                }
            }

            var billInfo = $scope.buildServiceBillInfo();

            if (billInfo.fault) {
                return;
            }

            _showEmpDialog();

            function _showEmpDialog() {
                var serviceBill = billInfo.serviceBill;
                var projectList = billInfo.projectList;
                var paymentDetailList = billInfo.paymentDetailList;

                var memberSelected = _.clone($scope.memberSelected);//收银成功后会清空该模型，在构造收银确认信息时有用到该模型

                var bonusInfo = _buildBonusInfo();

                //调用提成弹出框
                $scope.bonus_openBonusSetting(bonusInfo, function (empBonusList) {
                    //在有员工的情况下，必须要选择至少一个员工，流程才能走下去。
                    if ((!empBonusList || empBonusList.length == 0) && $scope.employeeList && $scope.employeeList.length > 0) {
                        $scope.showDialogError("#bonus-setting-form", "选择提成员工");
                        return;
                    }
                    //将计算过的提成打包进result、
                    billInfo.empBonusList = empBonusList;

                    //将收银流水中的employee_id和employee_name设置第一提成人
                    serviceBill.employee_id = empBonusList[0] ? empBonusList[0].employee_id || null : null;
                    serviceBill.employee_name = empBonusList[0] ? empBonusList[0].employee_name || null : null;

                    billInfo.newCardInfoList = $scope.buildNewCardModel(billInfo);

                    $scope.view.billInfo = billInfo;
                    $scope.buildFreePerformance(billInfo);

                    $scope.showEvaluationSelect();
                });

                function _buildBonusInfo() {
                    var bonusProjectList = [];

                    var itemId2Performance = _buildItemCouponPerformance();
                    var itemId2Fixed = _buildItemId2CouponFixed();

                    // 开卡使用卡支付的钱不计入业绩
                    var newCardByCardPay = 0;

                    //构造提成需要的项目信息，同时区分服务和卖品比例
                    _.each(projectList, _buildOneBonusItem);

                    //提成需要的信息
                    return {
                        frontDiaHref: $scope.view.dialogHrefStack.pop(),
                        dialogHeadType: _getDialogHeadType(),
                        featureType: "checkout",//业务调用方类型描述、如收银，开卡，充值...
                        featureOptions: {
                            bill: {
                                id: serviceBill.id,
                                amount: serviceBill.amount - newCardByCardPay,
                                discount: serviceBill.discount || 10,
                                member_name: serviceBill.member_name || "",
                                memberNo: serviceBill.memberNo || "",
                                create_date: serviceBill.create_date,
                                billNo: serviceBill.billNo
                            },//流水
                            projectList: bonusProjectList//项目列表
                        }//跟据业务type描述不同，featureOptions结构不同
                    };

                    function _buildItemCouponPerformance() {
                        var itemId2CouponPerformance = {};

                        var performance = 0;
                        var couponPayMoney = 0;
                        _.each($scope.payStatus.couponPayList, function (item) {
                            couponPayMoney += item.money;
                            if (item.bonusMode === "performance") {
                                performance += item.bonusValue;
                            }
                        });

                        var assigned = 0;
                        _.each(paymentDetailList, function (payment, index) {
                            if (index !== paymentDetailList.length - 1) {
                                itemId2CouponPerformance[payment.service_id] = utils.toDecimalDigit(performance * (payment.pay_coupon / couponPayMoney));
                                assigned += itemId2CouponPerformance[payment.service_id];
                            }
                            else {
                                itemId2CouponPerformance[payment.service_id] = utils.toDecimalDigit(performance - assigned);
                            }
                        });

                        return itemId2CouponPerformance;
                    }

                    function _buildItemId2CouponFixed() {
                        var itemId2couponFixed = {};

                        var fixed = 0;
                        var couponPayMoney = 0;
                        _.each($scope.payStatus.couponPayList, function (item) {
                            couponPayMoney += item.money;
                            if (item.bonusMode === "fixed") {
                                fixed += item.bonusValue;
                            }
                        });

                        var assigned = 0;
                        _.each(paymentDetailList, function (payment, index) {
                            if (index !== paymentDetailList.length - 1) {
                                itemId2couponFixed[payment.service_id] = utils.toDecimalDigit(fixed * (payment.pay_coupon / couponPayMoney));
                                assigned += itemId2couponFixed[payment.service_id];
                            }
                            else {
                                itemId2couponFixed[payment.service_id] = utils.toDecimalDigit(fixed - assigned);
                            }
                        });

                        return itemId2couponFixed;
                    }

                    function _queryItemPayDetail(billItem) {
                        var itemCouponPerformance = itemId2Performance[billItem.project_id] || 0;

                        var payDetailList = _.filter(paymentDetailList, function (payment) {
                            return billItem.project_id === payment.service_id && billItem.markId === payment.markId;
                        });

                        var payCash = itemCouponPerformance;
                        var payBank = 0;
                        var recordCardPay = 0;
                        var payCard = 0;

                        _.each(payDetailList, function (item) {
                            payCash += item.pay_cash || 0;
                            payBank += item.pay_bank || 0;
                            recordCardPay = item.times_2_money || 0;
                        });

                        _.each($scope.memberSelected.cards, function (item) {
                            _.each(payDetailList, function (one) {
                                if (one.memberCard_id !== item.id) {
                                    return;
                                }

                                if ($scope.bonusMode === "original") {
                                    payCard += utils.toDecimalDigit(one.card_pay_money);
                                    return;
                                }

                                payCard += utils.toDecimalDigit(one.card_pay_money * (item.inverse_ratio || 1));
                            });
                        });

                        var totalMoney = utils.toDecimalDigit(payCash + payBank + payCard);

                        var originalMoney = 0;
                        if ($scope.bonusMode === "original") {
                            originalMoney = utils.toDecimalDigit(billItem.def_int1 * billItem.saleNum);
                        }

                        var performance = 0;
                        var fixedBonus = 0;

                        var quarterCardId2ActiveTimes = $scope.quarterCardId2ActiveTimes();
                        _.each($scope.memberSelected.cards, function (item) {
                            _.each(payDetailList, function (one) {
                                if (one.memberCard_id !== item.id) {
                                    return;
                                }

                                var bonusInfo = {};
                                if ($scope.isQuarterCard(item) || $scope.isRecordCard(item)) {
                                    bonusInfo = item.serviceId2Bonus[billItem.project_id];
                                }

                                var times = one.card_pay_times;
                                if ($scope.isQuarterCard(item)) {
                                    var remainingActiveTimes = quarterCardId2ActiveTimes[item.id];

                                    if (remainingActiveTimes <= 0) {
                                        times = 0;
                                    }
                                    else if (remainingActiveTimes < times) {
                                        times = remainingActiveTimes;
                                    }

                                    quarterCardId2ActiveTimes[item.id] -= times;
                                }

                                if (bonusInfo.bonusMode === 'performance') {
                                    performance += (bonusInfo.bonusValue || 0) * times;
                                }
                                else if (bonusInfo.bonusMode === 'fixed') {
                                    fixedBonus += (bonusInfo.bonusValue || 0) * times;
                                }
                            });
                        });
                        _.each($scope.memberSelected.presents, function (item) {
                            _.each(payDetailList, function (one) {
                                if (one.memberCard_id !== item.sequenceId) {
                                    return;
                                }

                                var usedService = _.find(item.services, function (oneItem) {
                                    return oneItem.id === one.service_id;
                                });
                                if (_.isEmpty(usedService)) {
                                  }

                                if (usedService.bonusMode === 'performance') {
                                    performance += (usedService.bonusValue || 0) * Math.abs(one.card_pay_times);
                                }
                                else if (usedService.bonusMode === 'fixed') {
                                    fixedBonus += (usedService.bonusValue || 0) * Math.abs(one.card_pay_times);
                                }
                            });
                        });

                        return {
                            payCash: payCash,
                            payBank: payBank,
                            recordCardPay: recordCardPay,
                            payCard: payCard,
                            totalMoney: totalMoney,
                            originalMoney: originalMoney,
                            performance: totalMoney + performance,
                            fixedBonus: fixedBonus
                        };
                    }

                    function _buildOneBonusItem(item) {
                        var recordPer = 0;

                        var result = _queryItemPayDetail(item);

                        var payCash = result.payCash;
                        var payBank = result.payBank;
                        var payCard = result.payCard;
                        var money = result.performance;
                        var oldMoney = item.sumMoney;
                        var fixedBonus = result.fixedBonus || 0;

                        if ($scope.bonusMode === "original") {
                            money = result.originalMoney;
                            oldMoney = result.originalMoney;
                        }

                        var bonusItem = {
                            id: item.project_id,
                            discounts: item.discounts,
                            oldMoney: oldMoney,
                            money: money,
                            cardMoney: Number(recordPer) + Number(payCard),
                            cashMoney: Number(payCash) + Number(payBank),
                            unitPrice: item.unitPrice,
                            saleNum: item.saleNum,
                            type: item.type,
                            name: item.project_name,
                            cateId: item.project_cateId,
                            project_id: item.project_id,
                            employeeId: item.employee_id,
                            extraFixedBonus: itemId2Fixed[item.project_id] || 0 + fixedBonus,
                            markId: item.markId
                        };

                        _rebuildByCard();

                        bonusProjectList.push(bonusItem);

                        // 买卡项目，卡支付不算业绩
                        function _rebuildByCard() {
                            var isCard = (item.type === 3);
                            if (isCard) {
                                newCardByCardPay += bonusItem.cardMoney;
                                bonusItem.money = bonusItem.money - bonusItem.cardMoney;
                                bonusItem.cardMoney = 0;
                            }
                        }
                    }
                }

                function _getDialogHeadType() {
                    var type = "none";

                    if (!$scope.isMemberSelected() || ($scope.isTempMember() && !$scope.isMultiCardMember())) {
                        type = "normal";
                    }
                    else if ($scope.isMemberSelected() && !$scope.isMultiCardMember()) {
                        type = "notMultiCardMember";
                    }
                    else if (($scope.isMultiCardMember() || ($scope.isMultiCardMember() && $scope.isTempMember())) && $scope.incomeStatus.multiCardOverMoney === 0) {
                        type = "multiCardMemberTwoStep";
                    }
                    else if (($scope.isMultiCardMember() || ($scope.isMultiCardMember() && $scope.isTempMember())) && $scope.incomeStatus.multiCardOverMoney !== 0) {
                        type = "multiCardMemberThreeStep"
                    }

                    return type;
                }
            }
        };

        $scope.selectImageAndUpload = function (sourceType, midCallback, callback) {
            var imageInfo = {};

            async.series([_getImage, _base64Encode, _uploadImage], function (error) {
                // 取消选择图片不当成错误返回
                if (error && error === "no image selected") {
                    callback(error);
                    return;
                }

                callback(null, imageInfo);
            });

            function _getImage(callback) {
                utils.getPicture(sourceType,  null, "member", function (error, path) {
                    if (error) {
                        callback(error);
                        return;
                    }
                    midCallback(path);

                    imageInfo.imageLocalPath = path;
                    callback(null);
                });
            }

            function _base64Encode(callback) {
                window.plugins.files.imageBase64Code(imageInfo.imageLocalPath, function (data) {
                    imageInfo.imageDataBase64 = data;
                    callback(null);
                }, function (error) {
                    callback(error);
                });
            }

            function _uploadImage(callback) {
                memberDao.uploadMemberImage(imageInfo, function (error, result) {
                    if (error) {
                        callback(error);
                        return;
                    }

                    imageInfo.imageName = result.imageName;
                    callback(null);
                });
            }
        };

        $scope.newCustomerImage = function (sourceType, serviceBillItem) {
            if ($scope.newCustomerImage.doing) {
                return;
            }
            $scope.newCustomerImage.doing = true;

            var stopPlay = false, playList = [];

            $scope.selectImageAndUpload(sourceType, function (localPath) {
                $scope.newCustomerImage.uploadingImgPath = localPath;
                $scope.digestScope();
                _playStart(400);
            }, function (error, imageInfo) {
                _playDone(error, imageInfo);

                if (error) {
                    utils.log("consumeList.js newCustomerImage", error);
                    return;
                }
            });

            function _playStart(speed) {
                var uploadMask = $("#customerImageUploadingMask");

                _play(uploadMask.height(), uploadMask.height() * 0.618, speed, _play);

                function _play(start, stop, speed, callback) {
                    var animation = setInterval(function () {
                        if (uploadMask.height() > start) {
                            return;
                        }

                        if (uploadMask.height() <= stop) {
                            clearInterval(animation);

                            // 最终留下一点点用于真正上传完了播放
                            if (stop <= 10 || stopPlay) {
                                return;
                            }

                            callback(stop, stop * 0.618, speed * 0.618, callback);
                        }

                        uploadMask.height(uploadMask.height() - 1);
                    }, speed);

                    playList.push(animation);
                }
            }

            function _playDone(error, imageInfo) {
                var uploadMask = $("#customerImageUploadingMask");

                stopPlay = true;
                _.each(playList, function (item) {
                    clearInterval(item);
                });

                var animation = setInterval(function () {
                    uploadMask.height(uploadMask.height() - 5);

                    if (uploadMask.height() <= 0) {
                        $scope.newCustomerImage.doing = false;
                        $scope.newCustomerImage.uploadingImgPath = null;

                        if(error){
                            $scope.digestScope();
                        }
                        else{
                            if (_.isEmpty(imageInfo)) {
                                return;
                            }
                            memberDao.saveMemberServiceBillImage("", $scope.view.billInfo.serviceBill.member_id, imageInfo.imageName, function(error, result){
                                if(error){
                                    //
                                }
                                else if(result && result.result && result.result.id){
                                    if($scope.view.billInfo.customerImgs){
                                        $scope.view.billInfo.customerImgs.push({
                                            id: result.result.id,
                                            imgPath: 'http://yilos.oss-cn-hangzhou.aliyuncs.com/' + result.result.imgPath
                                        });
                                    }
                                    else{
                                        $scope.view.billInfo.customerImgs = [{
                                            id: result.result.id,
                                            imgPath: 'http://yilos.oss-cn-hangzhou.aliyuncs.com/' + result.result.imgPath
                                        }];
                                    }
                                }

                                $scope.digestScope();
                            })
                        }

                        clearInterval(animation);
                        uploadMask.height(175);
                    }
                }, 100);
            }
        };

        $scope.checkoutCommit = function () {
            if ($scope.checkoutCommit.doing) {
                return;
            }
            $scope.checkoutCommit.doing = true;

            if ($scope.needToConfirmPassword() && !$scope.view.confirmPassword) {
                utils.showGlobalMsg("请输入消费密码");
                $scope.checkoutCommit.doing = false;
                return;
            }

            if ($scope.view.confirmPassword) {
                var passwordAfterMd5 = utils.md5($scope.view.confirmPassword + "");

                if (passwordAfterMd5 !== $scope.memberSelected.password) {
                    utils.showGlobalMsg("消费密码有误，请重新输入");
                    $scope.checkoutCommit.doing = false;
                    $scope.view.confirmPassword = "";
                    $scope.view.passwordShow = "";
                    numKeyboard.resetBoard();
                    return;
                }
            }

            if (!$scope.view.evaluation) {
                utils.showGlobalMsg("请给服务员工选择满意度");
                $scope.checkoutCommit.doing = false;
                return;
            }

            var cardPaymentList = $scope.view.billInfo.cardPaymentList;
            var billBalanceList = $scope.view.billInfo.billBalanceList;
            var memberScore = $scope.view.billInfo.memberScore;
            var serviceBill = $scope.view.billInfo.serviceBill;

            var memberSelected = _.clone($scope.memberSelected);//收银成功后会清空该模型，在构造收银确认信息时有用到该模型

            $scope.view.billInfo.empEvaluationList = _buildEvaluation();

            _preparePendOrderFlag();

            utils.showWaitTips("#m-pos-evaluation", 24, "正在提交数据", "dialog");
            $scope.normalCommit($scope.view.billInfo, function (error) {
                utils.hideWaitTips("#m-pos-evaluation");

                if (error) {
                    utils.showGlobalMsg(error.errorMsg || "收银失败,请稍后再试");
                    utils.log("m-pos fragment-checkout.js bonus_openBonusSetting", error);
                    $scope.checkoutCommit.doing = false;
                    return;
                }

                global.eventEmitter.emitEvent('m-pos.checkout.success', [serviceBill.member_id]);

                $scope.checkoutCommit.doing = false;

                //收银确认模型
                $scope.view.confirmInfo = _buildConfirmInfo();

                $scope.signature();
            });

            function _buildConfirmInfo() {
                var totalCardPay = 0;

                _.each(cardPaymentList, function (payment) {
                    if (payment.keyName === "recharge") {
                        totalCardPay += payment.value;
                    }
                });


                return {
                    isTempMember: $scope.isTempMember(),
                    signaturePath: YILOS.ENTERPRISEID + "/images/signature/" + serviceBill.id,
                    billId: serviceBill.id,
                    memberId: serviceBill.member_id,
                    isMemberSelected: serviceBill.member_id ? true : false,
                    memberName: serviceBill.member_name,
                    memberNo: serviceBill.memberNo,
                    totalMoney: utils.toDecimalDigit(totalCardPay + serviceBill.pay_cash + serviceBill.pay_bankAccount_money + serviceBill.pay_coupon),
                    presentScore: memberScore.presentScore,
                    currentScore: serviceBill.currentScore,
                    payCash: serviceBill.pay_cash,
                    payBank: serviceBill.pay_bankAccount_money,
                    payCardList: _queryPayInfo()//每张卡支付信息[{cardCateName:"",used:"",balance:"",type:""}...]
                };

                function _queryPayInfo() {
                    if (!serviceBill.member_id) {
                        return [];
                    }

                    var cardInfoList = [];
                    var cardInfo;
                    _.each(cardPaymentList, function (payment) {
                        cardInfo = {};
                        cardInfo.cardCateName = payment.def_str1 + "(扣除/剩余)";
                        cardInfo.type = payment.keyName;
                        cardInfo.used = payment.value;

                        var cardBalance = _.find(billBalanceList, function (balance) {
                            return payment.memberCardId === balance.memberCardId;
                        });

                        var oldTimes = 0;

                        if (payment.keyName === "recharge") {
                            //充值卡余额、从流水余额快照中取
                            cardInfo.balance = cardBalance.value;
                        }
                        else if (payment.keyName === "record") {
                            oldTimes = 0;
                            var memberCard = _.find(memberSelected.cards, function (card) {
                                return payment.memberCardId === card.id;
                            });

                            _.each(memberCard.recordBalance, function (balance) {
                                oldTimes += balance.times;
                            });
                            cardInfo.balance = oldTimes - cardInfo.used;
                        }
                        else if (payment.keyName === "quarter") {
                            cardInfo.cardCateName = payment.def_str1 + "(支付)";
                            cardInfoList.push(cardInfo);
                            return;
                        }
                        else if (payment.keyName === "present") {
                            var presentUsed = _.find(memberSelected.presents, function (oneTimes) {
                                return oneTimes.sequenceId === payment.memberCardId;
                            });

                            oldTimes = presentUsed.balance;

                            cardInfo.balance = oldTimes - cardInfo.used;
                        }
                        else if (payment.keyName === "coupon") {
                            cardInfo.cardCateName = payment.def_str1 + "(支付)";
                        }

                        cardInfoList.push(cardInfo);
                    });

                    return cardInfoList;
                }
            }

            function _buildEvaluation() {
                var empEvaluationList = [];

                _.each($scope.view.billInfo.empBonusList, function (bonus) {
                    var isExists = _.find(empEvaluationList, function (item) {
                        return item.employee_id === bonus.employee_id;
                    });

                    if (!_.isEmpty(isExists)) {
                        return;
                    }

                    var evaluationModel = {
                        employee_id: bonus.employee_id,
                        mark: $scope.view.evaluation,
                        create_date: bonus.create_date
                    };

                    empEvaluationList.push(evaluationModel);
                });

                return empEvaluationList;
            }

            function _preparePendOrderFlag() {
                if (_.isEmpty($scope.pend_pendBill)) {
                    return;
                }

                $scope.view.billInfo.pendBill = $scope.pend_pendBill;

                _.each($scope.pend_pendList, function (item, index) {
                    if (item.id === $scope.pend_pendBill.id) {
                        $scope.pend_pendList.splice(index, 1);
                    }
                });
                $scope.pend_pendBill = {};
                $scope.pend_countPendShow();
            }
        };

        //收银成功后确认界面
        $scope.showCheckoutConfirmPage = function () {
            utils.openFancyBox("#m-pos-checkout-end-confirm");
            $scope.digestScope();
        };

        $scope.closeCheckoutConfirmPage = function () {
            $scope.clearOrder();
            $scope.modalDialogClose();
            $scope.reprintInit();
            $scope.digestScope();

            setTimeout(function () {
                $scope.initOrFreshOrderListIScroll(false);
            }, 100);
        };

        $scope.signature = function () {
            $.fancybox.close();
            if (!$scope.view.confirmInfo.isMemberSelected || $scope.view.confirmInfo.isTempMember) {
                $scope.showCheckoutConfirmPage();
                return;
            }

            var signaturePath = YILOS.DOCPATH + "/" + $scope.view.confirmInfo.signaturePath;
            var path = $scope.view.confirmInfo.signaturePath;

            var signatureModel = {
                billId: $scope.view.confirmInfo.billId,
                imageDataBase64: ""
            };

            async.series([_showSignatureDialog, _base64Encode, _uploadSignatureImage], function (error) {
                if (error) {
                    utils.showGlobalMsg("签名失败，请稍后再试");
                    return;
                }
            });

            function _showSignatureDialog(callback) {
                var temp = _.extend({}, $scope.view.confirmInfo);
                var info = {
                    path: signaturePath,
                    memberInfo: temp.memberName + "/" + temp.memberNo,
                    payCash: temp.payCash ? ("￥" + utils.toDecimalDigit(temp.payCash).toFixed(1)) : "",
                    payBank: temp.payBank ? ("￥" + utils.toDecimalDigit(temp.payBank).toFixed(1)) : "",
                    presentScore: Number((temp.presentScore || 0).toFixed(0)),
                    currentScore: Number((temp.currentScore || 0).toFixed(0)),
                    totalMoney: "￥" + utils.toDecimalDigit(temp.totalMoney).toFixed(1),
                    payCard: _rebuildPayCard(temp.payCardList)
                };

                if (window.plugins && window.plugins.Handwriting) {
                    window.plugins.Handwriting.showHandwriting(info, function () {
                        $scope.closeCheckoutConfirmPage();
                        callback(null);
                    }, function (error) {
                        callback(error);
                    });
                }
                else {
                    $scope.showCheckoutConfirmPage();
                    callback(null);
                }

                function _rebuildPayCard(payCardList) {
                    var result = [];
                    _.each(payCardList, function (payCard) {
                        var cateName, value;

                        var used = Number(payCard.used || 0);
                        var balance = Number(payCard.balance || 0);

                        if (payCard.type === "recharge") {
                            cateName = payCard.cardCateName + "：";
                            value = "￥" + used.toFixed(1) + "/" + (balance < 0 ? "-" : "") + "￥" + Math.abs(balance).toFixed(1);
                        }
                        else if (payCard.type === "record") {
                            cateName = payCard.cardCateName + "：";
                            value = used.toFixed(0) + "次/" + balance.toFixed(0) + "次";
                        }
                        else if (payCard.type === "quarter") {
                            cateName = payCard.cardCateName + "：";
                            value = used.toFixed(0) + "次";
                        }
                        else if (payCard.type === "present") {
                            cateName = payCard.cardCateName + "：";
                            value = used.toFixed(0) + "次/" + balance.toFixed(0) + "次";
                        }
                        else if (payCard.type === "coupon") {
                            cateName = payCard.cardCateName + "：";
                            value = "￥" + used.toFixed(1);
                        }

                        result.push({
                            cateName: cateName,
                            value: value
                        });
                    });
                    return result;
                }
            }

            function _base64Encode(callback) {
                if (!window.plugins || !window.plugins.files) {
                    callback(null);
                    return;
                }

                window.plugins.files.imageBase64Code(path, function (data) {
                    signatureModel.imageDataBase64 = data;
                    callback(null);
                }, function (error) {
                    callback(error);
                });
            }

            function _uploadSignatureImage(callback) {
                featureDataI.uploadSignatureImage(signatureModel, callback);
            }
        };

        $scope.getCouponBonusInfo = function () {
            var fixed = 0, performance = 0;

            var couponPayMoney = 0;
            _.each($scope.payStatus.couponPayList, function (item) {
                couponPayMoney += item.money;
                if (item.bonusMode === "performance") {
                    performance += item.bonusValue;
                }
                else if (item.bonusMode === "fixed") {
                    fixed += item.bonusValue;
                }
            });

            return {
                couponPayMoney: couponPayMoney,
                performance: performance,
                fixed: fixed
            };
        };

        //获取每个项目对应的现金券支付金额
        $scope.buildItemId2CouponPay = function (itemList) {
            var itemId2CouponPay = {};

            var couponPayMoney = 0;
            _.each($scope.payStatus.couponPayList, function (item) {
                couponPayMoney += item.money;
            });

            var itemTotalMoney = 0;
            _.each(itemList, function (item) {
                itemTotalMoney += item.money;
            });

            //现金券支付金额超过项目总金额
            if (couponPayMoney > itemTotalMoney) {
                couponPayMoney = itemTotalMoney;
            }

            var assigned = 0;
            _.each(itemList, function (item, index) {
                if (index !== itemList.length - 1) {
                    itemId2CouponPay[item.id] = utils.toDecimalDigit(couponPayMoney * (item.money / itemTotalMoney));
                    assigned += itemId2CouponPay[item.id];
                }
                else {
                    itemId2CouponPay[item.id] = utils.toDecimalDigit(couponPayMoney - assigned);
                }
            });

            return itemId2CouponPay;
        };

        $scope.buildItemId2CouponPerformance = function (itemList, itemId2CouponPay) {
            var itemId2CouponPerformance = {};
            if (_.isEmpty(itemId2CouponPay)) {
                itemId2CouponPay = $scope.buildItemId2CouponPay(itemList);
            }

            var performance = 0;
            var couponPayMoney = 0;
            _.each($scope.payStatus.couponPayList, function (item) {
                couponPayMoney += item.money;
                if (item.bonusMode === "performance") {
                    performance += item.bonusValue;
                }
            });

            var assigned = 0;
            _.each(itemList, function (item, index) {
                var itemCouponPay = itemId2CouponPay[item.id] || 0;
                var itemCouponPerformance = utils.toDecimalDigit((itemCouponPay / couponPayMoney) * performance);

                if (index !== itemList.length - 1) {
                    assigned += itemCouponPerformance;
                    itemId2CouponPerformance[item.id] = itemCouponPerformance;
                }
                else {
                    itemId2CouponPerformance[item.id] = utils.toDecimalDigit(performance - assigned);
                }
            });
            return itemId2CouponPerformance;
        };

        $scope.buildQuarterItemId2OtherPay = function (itemList, totalCashPay, totalBankPay, totalCouponPay) {
            totalCashPay = totalCashPay || $scope.pay.cash;
            totalBankPay = totalBankPay || $scope.pay.bank;
            totalCouponPay = totalCouponPay || $scope.pay.coupon;

            var itemId2OtherPay = {};

            var cashPayOweAvg = 0;
            var bankPayOweAvg = 0;
            var couponPayOweAvg = 0;

            var cashPayOweTol = 0;
            var bankPayOweTol = 0;
            var couponPayOweTol = 0;

            var quarterOwe = $scope.incomeStatus.quarterOweMoney;

            if (quarterOwe > 0) {
                if (quarterOwe <= totalCashPay) {
                    cashPayOweTol = quarterOwe;
                }
                else if (quarterOwe <= (totalCashPay + totalBankPay)) {
                    cashPayOweTol = totalCashPay;
                    bankPayOweTol = utils.toDecimalDigit(quarterOwe - totalCashPay);
                }
                else if (quarterOwe <= (totalCashPay + totalBankPay + totalCouponPay)) {
                    cashPayOweTol = totalCashPay;
                    bankPayOweTol = totalBankPay;
                    couponPayOweTol = utils.toDecimalDigit(quarterOwe - totalCashPay - totalBankPay);
                }

                cashPayOweAvg = utils.toDecimalDigit(cashPayOweTol / itemList.length || 0);
                bankPayOweAvg = utils.toDecimalDigit(bankPayOweTol / itemList.length || 0);
                couponPayOweAvg = utils.toDecimalDigit(couponPayOweTol / itemList.length || 0);
            }

            _.each(itemList, function (item, index) {
                var itemCashPay = cashPayOweAvg;
                var itemBankPay = bankPayOweAvg;
                var itemCouponPay = couponPayOweAvg;

                //防止账不平
                if (index === itemList.length - 1) {
                    itemCashPay = utils.toDecimalDigit(cashPayOweTol - cashPayOweAvg * (itemList.length - 1));
                    itemBankPay = utils.toDecimalDigit(bankPayOweTol - bankPayOweAvg * (itemList.length - 1));
                    itemCouponPay = utils.toDecimalDigit(couponPayOweTol - couponPayOweAvg * (itemList.length - 1));
                }

                itemId2OtherPay[item.id] = {
                    cashPay: itemCashPay,
                    bankPay: itemBankPay,
                    couponPay: itemCouponPay
                };
            });

            return itemId2OtherPay;
        };

        $scope.singleCardShowCouponSel = function () {
            $scope.view.showCouponSel = !$scope.view.showCouponSel;
        };

        $scope.getSelectTips = function () {
            if (!($scope.isMemberSelected() && $scope.memberSelected.hasCoupon)) {
                return "0rem";
            }

            var couponCount = $scope.memberSelected.coupons.length;
            if (couponCount > 5) {
                couponCount = 5;
            }
            return (14 - 2.5 * couponCount / 2) + "rem";
        };

        $scope.adjustShouldEarn = function () {
            if (_.isUndefined($scope.view.paidAccuracy) || $scope.view.paidAccuracy == 1) {
                $scope.view.paidAccuracy = 0;
            }
            else {
                $scope.view.paidAccuracy = 1;
            }
            $scope.calculateAmount();
        };

        $scope.showEvaluationSelect = function () {
            if (_.isEmpty($scope.showEvaluationSelect.evaluationTrans)) {
                $scope.showEvaluationSelect.evaluationTrans = {
                    "2": "不满意",
                    "4": "一般",
                    "6": "满意",
                    "8": "非常满意"
                };
            }

            _emptyMark();

            $scope.view.dialogHrefStack.push("#bonus-setting-form");
            utils.openFancyBox("#m-pos-evaluation");
            $scope.digestScope();

            function _emptyMark() {
                $scope.view.evaluationList = [8, 6, 4, 2];
                $scope.view.evaluation = "";
                $scope.view.confirmPassword = "";

                numKeyboard.resetBoard();
            }
        };

        $scope.passwordInput = function (key) {
            if (numKeyboard.isPointKey(key)) {
                return;
            }

            $scope.view.confirmPassword = numKeyboard.clickKey(key);

            $scope.view.passwordShow = "";

            _.times($scope.view.confirmPassword.length, function () {
                $scope.view.passwordShow += "*";
            });
        };

        $scope.back2PreviousDialog = function () {
            utils.openFancyBox($scope.view.dialogHrefStack.pop());
        };
    }

    exports.initModel = initModel;
    exports.initControllers = initControllers;
});