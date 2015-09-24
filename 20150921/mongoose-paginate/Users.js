/**
 * Created by sisilai on 2015/9/21.
 */

var mongodb = require('./db');

function Users(user){
    this.name = user.name;
    this.password = user.password;
};
module.exports = Users;

Users.get = function get(username, callback){
    mongodb.open(function(err, db){
        if(err){
            return callback(err);
        }
        //读取users集合
        db.collection('users', function(err, collection){
            if(err){
                mongodb.close();
                return callback(err);
            }
            //查找name属性为username的文档
            collection.findOne({name: username}, function(err, doc){
                mongodb.close();
                if(doc){
                    //封装文档为User对象
                    var user = new Users(doc);
                    callback(err, user);
                }else{
                    callback(err, null);
                }
            });
        });
    });
};