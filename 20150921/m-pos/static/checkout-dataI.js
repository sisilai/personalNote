define(function (require, exports, module) {
    var database = require("mframework/static/package").database;
    var dataUtils = require("mframework/static/package").dataUtils;
    var dbInstance = database.getDBInstance();
    var httpHelper = require("mframework/static/package").httpsUtils;

    exports.initEmployeeList = initEmployeeList;
    exports.initCateServiceList = initCateServiceList;

    exports.fillIdCode = fillIdCode;
    exports.checkout = checkout;

    exports.initPendOrderList = initPendOrderList;
    exports.pendOrder = pendOrder;
    exports.deletePend = deletePend;

    exports.uploadSignatureImage = uploadSignatureImage;

    exports.commonlyItem = commonlyItem;

    function initEmployeeList(callback) {
        var selectEmployee = "select a.id,a.name,a.baseInfo_jobId,a.baseInfo_image,b.ruleType from tb_employee a,tb_job b where a.baseInfo_jobId == b.id;";
        dbInstance.execQueryV2(selectEmployee, [], function (result) {
            callback(null, result);
        }, function (error) {
            callback(error);
        });
    }

    function initCateServiceList(callback) {
        var cateServiceIdMap = {};//类型id对应服务id列表Map
        var serviceIdNameMap = {};//计次卡的服务id与name对应关系、查询计次卡会员余额时用于转换
        var recordCateList = [];

        var selectCateServices = "select a.id,a.serviceId,a.cardCateId,b.name as serviceName,a.bind_group,a.def_int1 as serviceTimes" +
            " from tb_recordCateServices a,tb_service b" +
            " where a.serviceId = b.id;";

        dbInstance.execQuery(selectCateServices, [], function (result) {
            for (var i = 0, len = result.rows.length; i < len; i++) {
                var temp = result.rows.item(i);
                serviceIdNameMap[temp.serviceId] = temp.serviceName;
                if (cateServiceIdMap[temp.cardCateId]) {
                    cateServiceIdMap[temp.cardCateId].push(temp.serviceId);
                }
                else {
                    cateServiceIdMap[temp.cardCateId] = [temp.serviceId];
                }
                recordCateList.push({
                    cardCateId: temp.cardCateId,
                    serviceName: temp.serviceName,
                    bind_group: temp.bind_group,
                    serviceTimes: temp.serviceTimes
                });
            }

            var model = {
                cateServiceIdMap: cateServiceIdMap,
                serviceIdNameMap: serviceIdNameMap,
                recordServiceInfo: _buildRecordServiceInfo(recordCateList)
            };

            callback(null, model);
        }, function (error) {
            callback(error);
        });

        function _buildRecordServiceInfo(recordCateList) {
            var recordServiceInfo = {};

            var cardCateMap = _.groupBy(recordCateList, function (item) {
                return item.cardCateId;
            });

            _.each(cardCateMap, function (value, key) {
                recordServiceInfo[key] = [];

                var grouped = _.values(_.groupBy(value, function (item) {
                    return item.bind_group;
                }));

                _.each(grouped, function (group_item) {
                    recordServiceInfo[key].push({
                        serviceNames: _.pluck(group_item, "serviceName").join(","),
                        serviceTimes: group_item[0].serviceTimes,
                        bind_group: group_item[0].bind_group
                    });
                });
            });
            return recordServiceInfo;
        }
    }

    //流水单、服务列表、会员卡、员工提成
    function fillIdCode(billInfo, callback) {
        var markId2ProjectId = {};
        var clientExtraInfo = {};

        // 该模型填充id有所区别，单独在_fillNewCard中填充
        var newCardInfoList = billInfo.newCardInfoList;
        delete billInfo.newCardInfoList;

        async.series([_fillBill, _fillNewCard], function (error) {
            if (error) {
                callback(error);
                return;
            }

            billInfo.newCardInfoList = newCardInfoList;
            _takeClientInfo();

            callback(null);
        });

        function _fillBill(callback) {
            dataUtils.fillEnterpriseIdOfModel(billInfo);

            dataUtils.fillIdOfModel(billInfo, function (error) {
                if (error) {
                    callback(error);
                    return;
                }

                _loggerClientInfo();

                var billId = billInfo.serviceBill.id;

                _.each(billInfo.projectList, function (item) {
                    item.serviceBill_id = billId;
                    markId2ProjectId[item.markId] = {
                        billItemId: item.id,
                        type: item.type
                    };

                    delete item.markId;
                    delete item.relatedCardId;
                });

                _.each(billInfo.billBalanceList, function (item) {
                    item.billId = billId;
                });

                _.each(billInfo.cardPaymentList, function (item) {
                    item.billId = billId;
                });

                _.each(billInfo.paymentDetailList, function (item) {
                    item.serviceBill_id = billId;

                    var markInfo = markId2ProjectId[item.markId] || {};
                    item.bill_item_id = markInfo.billItemId || "";
                    item.type = markInfo.type || "";

                    delete item.markId;
                    delete item.inactiveTimes;
                    delete item.inactiveMoney;
                });

                _.each(billInfo.depositList, function (item) {
                    item.bill_id = billId;
                });

                _.each(billInfo.empBonusList, function (item) {
                    item.serviceBill_id = billId;

                    if (markId2ProjectId[item.markId]) {
                        item.bill_item_id = markId2ProjectId[item.markId].billItemId;
                    }

                    delete item.markId;
                });

                _.each(billInfo.empEvaluationList, function (item) {
                    item.bill_id = billId;
                });

                _.each(billInfo.freePerformanceList, function (item) {
                    item.bill_id = billId;
                });

                _.each(billInfo.quarterPresentList, function (item) {
                    item.billId = billId;
                    var temp = _.find(billInfo.quarterRefPresentList, function (temp) {
                        return temp.__customIndex == item.__customIndex;
                    });
                    if(temp){
                        temp.present_id = item.id;
                    }
                    delete item.__customIndex;
                });

                _.each(billInfo.quarterRefPresentList, function (item) {
                    delete item.__customIndex;
                });

                callback(null);
            });

            function _loggerClientInfo() {
                //为了定位paymentDetail中bill_item_id重复问题，在使用额外代码记录客户端的一些信息，当出现一场情况时将信息带到服务器，并且记录下来
                clientExtraInfo.billProject = JSON.parse(JSON.stringify(billInfo.projectList));
                clientExtraInfo.paymentDetail = JSON.parse(JSON.stringify(billInfo.paymentDetailList));
                clientExtraInfo.empBonusList = JSON.parse(JSON.stringify(billInfo.empBonusList));
            }
        }

        function _fillNewCard(callback) {
            var serviceBillId = billInfo.serviceBill.id;

            async.each(newCardInfoList, _fillOneModel, callback);

            function _fillOneModel(model, callback) {
                dataUtils.fillEnterpriseIdOfModel(model);

                dataUtils.fillIdOfModel(model, function (error) {
                    if (error) {
                        callback(error);
                        return;
                    }

                    var memberId = model.member.id;
                    var cardId = model.memberCard.id;
                    var billId = model.rechargeBill.id;

                    model.rechargeBill.serviceBillId = serviceBillId;
                    model.memberCard.memberId = memberId;
                    model.rechargeBill.member_id = memberId;
                    model.rechargeBill.memberCard_id = cardId;

                    _.each(model.billBalanceList, function (item) {
                        item.memberCardId = cardId;
                        item.billId = billId;
                    });

                    _.each(model.cardBalanceList, function (item) {
                        item.memberCardId = cardId;
                    });

                    _.each(model.bonusRecords, function (item) {
                        item.serviceBill_id = billId;

                        if (markId2ProjectId[item.markId]) {
                            item.bill_item_id = markId2ProjectId[item.markId].billItemId;
                        }

                        delete item.markId;
                    });

                    if (model.quarterPresentBill && model.quarterRefPresents && model.quarterPresents) {
                        _.each(model.quarterPresents, function (item) {
                            item.billId = model.quarterPresentBill.id;
                        });
                        _.each(model.quarterRefPresents, function (item) {
                            item.memberCard_id = cardId;
                            var temp = _.find(model.quarterPresents, function (present) {
                                return present.serviceId == item.serviceId;
                            });
                            if (temp) {
                                item.present_id = temp.id;
                            }
                            delete item.serviceId;
                        });
                    }


                    callback(null);
                });
            }
        }

        function _takeClientInfo() {
            var itemList = billInfo.projectList || [];
            var paymentDetailList = billInfo.paymentDetailList || [];

            var itemIdCount = _.uniq(_.pluck(itemList, 'id')).length;
            var paymentItemIdCount = _.uniq(_.pluck(paymentDetailList, 'bill_item_id')).length;

            if (itemIdCount !== paymentItemIdCount) {
                clientExtraInfo.markId2ProjectId = markId2ProjectId;
                billInfo.clientExtraInfo = clientExtraInfo;
            }
        }
    }

    //收银台操作订单
    function checkout(billInfo, callback) {
        var url = "/pos/checkout/" + YILOS.MASTERID + "/" + YILOS.ENTERPRISEID;

        httpHelper.postRequest(url, billInfo, function (data) {
            callback(null, data.result);
        }, function (error) {
            callback(error);
        });
    }

    //初始化挂单订单列表
    function initPendOrderList(callback) {
        var url = "/pos/queryPendingOrder/" + YILOS.MASTERID + "/" + YILOS.ENTERPRISEID;

        httpHelper.getRequest(url, function (data) {
            callback(null, data.result);
        }, function (error) {
            callback(error);
        });
    }

    //挂单订单
    function pendOrder(model, callback) {
        dataUtils.fillEnterpriseIdOfModel(model);

        async.series([_fillId, _doPost], callback);

        function _fillId(callback) {
            dataUtils.fillIdOfModel(model, function (error) {
                if (error) {
                    callback(error);
                    return;
                }

                var billId = model.pendBill.id;

                _.each(model.itemList, function (item) {
                    item.serviceBill_id = billId;
                });
                callback(null);
            });
        }

        function _doPost(callback) {
            var url = "/pos/pendOrder/" + YILOS.MASTERID + "/" + YILOS.ENTERPRISEID;

            httpHelper.postRequest(url, model, function (data) {
                callback(null, data.result);
            }, function (error) {
                callback(error);
            });
        }
    }

    //删除挂单
    function deletePend(delPendId, callback) {
        var url = "/pos/deletePendingOrder/" + YILOS.MASTERID + "/" + YILOS.ENTERPRISEID;

        httpHelper.postRequest(url, {billId: delPendId}, function (data) {
            callback(null, data.result);
        }, function (error) {
            callback(error);
        });
    }

    //上传签名图片
    function uploadSignatureImage(model, callback) {
        var url = "/pos/uploadSignature/" + YILOS.MASTERID + "/" + YILOS.ENTERPRISEID;

        httpHelper.postRequest(url, model, function (data) {
            callback(null, data.result);
        }, function (error) {
            callback(error);
        });
    }

    //获取共同的项目
    function commonlyItem(callback) {
        var url = "/pos/commonlyItemIdList/" + YILOS.MASTERID + "/" + YILOS.ENTERPRISEID + "?count=20";

        httpHelper.getRequest(url, function (data) {
            callback(null, data.result);
        }, function (error) {
            callback(error);
        });
    }
});
