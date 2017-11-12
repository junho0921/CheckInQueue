/**
 * Created by jiajunhe on 2017/11/10.
 */
(function(factory){
  'use strict';
  var isDefined = false;

  if(typeof define === 'function'){
    define('CheckInQueue', factory);
    isDefined = true;
  }

  if(typeof fxDefine === 'function'){
    fxDefine('CheckInQueue', factory);
    isDefined = true;
  }

  if(!isDefined){
    if(typeof module === 'object'){
      module.exports = factory();
    }else{
      try{
        window.CheckInQueue = factory();
      }catch (e) {}
    }
  }

})(function() {
  'use strict';

  /*
   * class CheckInQueue
   * @desc 时间队列
   *
   * */
  function CheckInQueue (config) {
    this._init(config);
    return this;
  }
  CheckInQueue.prototype = {
    // 排队队列
    queue: null,// 进房队列:第一个是展示中的, 第二个是准备展示的, 其余都是排队中的
    // 默认配置
    _config: {
      // 获取时间的方法
      getFreeTime: function(){return 1000;},
      getProtectTime: function(){return 1000;},
      onPushQueue: function (queue) {},
      //error: function () {console.log('_______ ', arguments);},
      // 队列的最大排队数量
      enterListMaxLength: 200 // 进房信息缓存的最大长度
    },
    // 初始化方法
    _init: function (config) {
      this.config = Object.assign ? Object.assign({}, this._config, config) : window.$.extend({}, this._config, config);
      // 创建队列
      this._reset();
    },
    _reset: function () {
      this.queue = [];
      this._timer = null;
      this.onShowItem = null;
    },
    // 触发生命周期事件
    trigger: function (hookName, arg) {
      if(hookName && typeof this.config[hookName] === 'function'){
        this.config[hookName].apply(this, arg);
      }
    },

    /*
     * func push 外部API
     * @desc 插入队列方法
     * @param callback
     * @param arg
     * */
    push: function (callback, data) {
      data = data || {};
      if (!data || typeof data !== 'object') {
        return false;
      }
      // 超于进房队列容量的话, 放弃处理
      if (this.queue.length > this.config.enterListMaxLength) {
        return false;
      }
      // 缓存本进房信息, 准备第一个结束后就展示
      /*
       * 缓存的数据结构 todo 文档
       * */
      this.queue.push({
        callback: callback,
        data: data,
        _queueTime: Date.now(), // 测试
        getFreeTime: data.getFreeTime || this.config.getFreeTime,
        getProtectTime: data.getProtectTime || this.config.getProtectTime
      });
      this.trigger('onPushQueue', [this.queue]);
      this.runStep(0);
      return true;
    },
    _setGap: function(time){
      console.log('_setGap', time);
      if(!time || time < 0){time = 1;}
      this._clearTimer();
      this._nextGap(time);
    },
    _clearTimer: function () {
      if(this._timer){
        window.clearTimeout(this._timer);
        this._timer = null;
      }
    },
    /*
     * _nextGap方法是轮询器的定时执行, 请注意调用, 不要重复与泄露
     * */
    _nextGap: function(time) {
      if(time){
        // 设置定时器执行
        var _this = this;
        this._timer = window.setTimeout(function(){
          _this.runStep(time);
        }, time);
      }
    },
    _torrence: 10,
    /*
     * func runStep
     * */
    runStep: function (time) {
      // 测试模式: 记录定时的时长与执行的当前时间
      this.trigger('runStep', [this.queue, time]);
      console.log('runStep ------------- this.onShowItem', this.onShowItem && this.onShowItem.data);
      if(this.queue.length){
        var cItem = this.onShowItem;
        if(cItem){
          var onShowDuration = Date.now() - cItem._showTime;
          var protect = cItem.getProtectTime(cItem.data);
          if(onShowDuration >= (protect-this._torrence)){
            // 测试代码:
            if(onShowDuration > cItem.getFreeTime(cItem.data)){this.trigger('error', ['超时展示', cItem.data, onShowDuration]);}
            return this.executeItem();
          }else{
            this.trigger('onWait', [this.queue, time]);
            if(cItem.isFree){
              cItem.isFree = false;
              console.error('自由时间 - ', onShowDuration, protect);
              return this._setGap(protect - onShowDuration);
            }else{
              console.error('')
            }

            return false;
          }
        }else{
          this.trigger('onFirstShow', [this.queue, time]);
          return this.executeItem();
        }
      }else{
        // 重置本实例所有状态
        this.trigger('onLast', [this.onShowItem && this.onShowItem.data]);
        this._reset();
      }
    },

    executeItem: function () {
      var toShowItem = this.queue.shift();
      console.log("executeItem", toShowItem.data);
      if(toShowItem){
        var hasNext = !!this.queue.length;
        console.log('hasNext', hasNext);
        console.log('getProtectTime', toShowItem.getProtectTime());
        console.log('getFreeTime', toShowItem.getFreeTime());
        this._setGap(
          hasNext ? toShowItem.getProtectTime() : toShowItem.getFreeTime()
        );
        // 必须要在callback执行前记录时间与缓存, 因为callback里可能有插入队列的操作
        toShowItem._showTime = Date.now();
        this.onShowItem = toShowItem;

        if(toShowItem.callback() !== false){
          this.trigger('onShow', [toShowItem.data]);
          this.onShowItem.isFree = !hasNext;
        }else{
          this.trigger('onFailShow', [toShowItem.data]);
          this.onShowItem.getProtectTime = function(){return -1;};
          this._setGap(0);
        }
      }else{
        this.trigger('error', ['没有触发的item']);
      }
    }
  };
  return CheckInQueue;
});
