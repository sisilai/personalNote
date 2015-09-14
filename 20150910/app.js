/**
 * Created by sisilai on 2015/9/10.
 */
var express = require('express');
var app = express();

//var app = require('express')();

app.get('/', function (req, res) {
    res.send('Hello World!111111');
});

app.get('/example/b', function (req, res, next) {
    console.log('response will be sent by the next function ...')
    next()
}, function (req, res) {
    res.send('Hello from B!')
});

// will match anything with an a in the route name:
app.get(/a/, function(req, res) {
    res.send('/a/')
})

// will match butterfly, dragonfly; but not butterflyman, dragonfly man, and so on
app.get(/.*fly$/, function(req, res) {
    res.send('/.*fly$/')
})

app.get('/s', function (req, res) {
    res.send('Hello World!111111sss');
});

var server = app.listen(3000, function () {
    var host = server.address().address;
    var port = server.address().port;
    var __dirname = '1';
    console.info(__dirname);
    console.log('Example app listening at http://%s:%s', host, port);
});