/**
 * Created by 77387_000 on 2015/8/15.
 */
var less = require('less');
less.render('.class1 {width: 1+1;}',function(e,css){
    console.log(css);
});