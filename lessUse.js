/**
 * Created by 77387_000 on 2015/8/15.
 */
var less = require('less');
less.render('.class1 {width: 1+1;}',function(e,css){
    console.log(css);
    var re = /he/;//最简单的正则表达式,将匹配he这个单词
    var str = "he";
    alert(re.test(str));//true
});