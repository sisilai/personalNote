/**
 * Created by sisilai on 2015/9/10.
 */
var express = require('express');
var app = express();

// 一个中间件栈，处理指向 /user/:id 的 GET 请求
app.get('/user/:id', function (req, res, next) {
    console.log('ID:', req.params.id);
    next();
}, function (req, res, next) {
    res.send('User Info');
});

// 处理 /user/:id， 打印出用户 id
app.get('/user/:id', function (req, res, next) {
    res.end(req.params.id);
});

var server = app.listen(3000, function () {
    var host = server.address('127.0.0.1:80').address;
    var port = server.address('127.0.0.1:80').port;

    console.log('Example app listening at http://%s:%s', host, port);
});