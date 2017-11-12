/**
 * Created by Administrator on 2017/11/12.
 */
var checkInQueue = require('../checkInQueue.js');

var q = new checkInQueue({
  // 获取时间的方法
  getFreeTime: function(){return 1000;},
  getProtectTime: function(){return 1000;},
  onPushQueue: function (queue) {},
  error: function () {console.log('_______ ', arguments);},
  // 队列的最大排队数量
  enterListMaxLength: 200 // 进房信息缓存的最大长度
});

