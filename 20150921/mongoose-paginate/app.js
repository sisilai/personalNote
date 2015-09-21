/**
 * Created by sisilai on 2015/9/21.
 */
// # app.js

var express = require('express');
var paginate = require('express-paginate');
var app = express();

var Users = db.model('Users');
Users.plugin(require('mongoose-paginate'));

// keep this before all routes that will use pagination
app.use(paginate.middleware(10, 50));

app.get('/users', function(req, res, next) {

    // This example assumes you've previously defined `Users`
    // as `var Users = db.model('Users')` if you are using `mongoose`
    // and that you've added the Mongoose plugin `mongoose-paginate`
    // to the Users model via `User.plugin(require('mongoose-paginate'))`
    Users.paginate({}, { page: req.query.page, limit: req.query.limit }, function(err, users, pageCount, itemCount) {

        if (err) return next(err);

        res.format({
            html: function() {
                res.render('users', {
                    users: users,
                    pageCount: pageCount,
                    itemCount: itemCount
                });
            },
            json: function() {
                // inspired by Stripe's API response for list objects
                res.json({
                    object: 'list',
                    has_more: paginate.hasNextPages(req)(pageCount),
                    data: users
                });
            }
        });

    });

});

app.listen(3000);