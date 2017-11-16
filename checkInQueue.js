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
     * @desc 排队显示机制, 排队显示以保护时间与自由时间
     * @param 配置 [object] 配置信息请参考_config默认配置
     * */
    function CheckInQueue (config) {
        this._init(config);
        return this;
    }
    CheckInQueue.prototype = {
        // 时间容忍值, 用于定时器到指定时间后是否满足时长的判断
        _torrence: 10,
        // 排队队列
        queue: null,
        // 默认配置
        _config: {
            // 队列的最大排队数量
            enterListMaxLength: 200,
            /*时长配置*/
            // 获取自由时间的方法
            getFreeTime: function(){return 1000;},
            // 获取保护时间的方法
            getProtectTime: function(){return 1000;},
            /*hook事件*/
            // 队列插入新的排队触发的事件
            onPushQueue: function (queue) {},
            // 队列最后的事件
            onEnd:null,
            // 队列第一个执行成功的事件
            onFirstShow:null,
            // 队列每个执行成功的事件
            onShow:null,
            // 报错事件
            error:null
        },
        // 初始化方法
        _init: function (config) {
            // 配置
            this.config = Object.assign ? Object.assign({}, this._config, config) : window.$.extend({}, this._config, config);
            // 重置实例状态与缓存
            this._reset();
        },
        // 重置实例状态与缓存
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
         * @param callback [function] 回调方法
         * @param arg [object] 数据, 这个数据会提供给getFreeTime与getProtectTime, onPushQueue使用, 方便判断数据对应的自由时间与保护时间与队列排队
         * */
        push: function (callback, data) {
            data = data || {};
            // 数据必须是对象
            if (typeof data !== 'object') {
                return false;
            }
            // 超于进房队列容量的话, 放弃处理
            if (this.queue.length > this.config.enterListMaxLength) {
                return false;
            }
            // 排队item的数据结构
            var item = {
                callback: callback,
                data: data,
                _queueTime: Date.now(),
                getFreeTime: data.getFreeTime || this.config.getFreeTime,
                getProtectTime: data.getProtectTime || this.config.getProtectTime
            };
            this.queue.push(item);
            // 触发排队事件, 提供队列重新排序的整理时机
            this.trigger('onPushQueue', [this.queue, data]);
            // 执行
            this.runStep(0);
            return true;
        },
        _setGap: function(time){
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
         * func
         * @desc 轮询器的定时执行, 请注意调用, 不要重复与泄露
         * */
        _nextGap: function(time) {
            if(time){
                // 设置定时器执行
                var _this = this;
                this._timer = window.setTimeout(function(){
                    _this._timer = null;
                    _this.runStep(time);
                }, time);
            }
        },
        /*
         * runStep
         * @desc 轮询器
         * */
        runStep: function (time) {
            this.trigger('runStep', [this.queue, time]);
            // 检查排队队列
            if(this.queue.length){
                var cItem = this.onShowItem;
                if(cItem){
                    // 有排队的item, 且有显示中的item, 那么需要检测显示中的item是否已经超过保护时间
                    var onShowDuration = Date.now() - cItem._showTime;
                    var protectTime = cItem.getProtectTime(cItem.data);
                    if(onShowDuration >= (protectTime-this._torrence)){
                        // 若显示的item超过了保护时间, 那么可以执行排队item了, 但若超过了自由时间, 那么报错
                        if(onShowDuration > cItem.getFreeTime(cItem.data)){
                            this.trigger('error', ['超时展示', cItem.data, onShowDuration]);
                        }
                        // 执行
                        return this._executeItem();
                    }else{
                        // 若显示的item还在保护时间内, 那么不能执行排队item
                        this.trigger('onWait', [this.queue, time]);
                        // 若正在展示的item是自由时间状态, 那么需要调整定时器为保护时间
                        if(cItem.isFree){
                            // 若显示的item还在保护时间内, 但定时器是自由时间间隔, 需要将时间间隔调整为保护时间的剩余时长
                            cItem.isFree = false;
                            this._setGap(protectTime - onShowDuration);
                        }
                        // 排队item在等待定时器执行, 所以若没有设置定时器, 需要报错
                        if(!this._timer){
                            // 若显示的item还在保护时间内, 但定时器是自由时间间隔, 需要将时间间隔调整为保护时间的剩余时长
                            this.trigger('error', ['定时器错误']);
                        }
                        return false;
                    }
                }else{
                    // 执行, 传参true表示第一个显示的item
                    return this._executeItem(true);
                }
            }else{
                // 没有排队item, 那么表示队列的最后, 重置本实例所有状态
                this.trigger('onEnd', [this.onShowItem && this.onShowItem.data]);
                // 重置状态与清理缓存
                this._reset();
            }
        },
        /*
         * _executeItem
         * @desc 排队item的执行
         * */
        _executeItem: function (isFirst) {
            var toShowItem = this.queue.shift();
            if(toShowItem){
                var hasNext = !!this.queue.length;
                // 先设置定时器, 因为callback里可能有插入排队的item
                this._setGap(
                    hasNext ? toShowItem.getProtectTime(toShowItem.data) : toShowItem.getFreeTime(toShowItem.data)
                );
                // 必须要在callback执行前记录时间与缓存, 因为callback里可能有插入队列的操作
                toShowItem._showTime = Date.now();
                // 标记当前显示的item
                this.onShowItem = toShowItem;
                // 对callback返回值进行处理, 若返回false, 那么表示本item无效, 直接跳过
                if(toShowItem.callback() !== false){
                    if(isFirst){
                        // 有排队的item, 没有显示中的item, 表示第一个显示
                        this.trigger('onFirstShow', [toShowItem.data]);
                    }
                    this.trigger('onShow', [toShowItem.data]);
                    // 标记正在展示的item是否自由时间状态
                    this.onShowItem.isFree = !hasNext;
                }else{
                    this.trigger('onFailShow', [toShowItem.data]);
                    // 若本item无效, 保护时间等于负数, 直接跳过
                    this.onShowItem.getProtectTime = function(){return -1;};
                    this._setGap(0);
                }
            }else{
                // 没有排队的item, 报错
                this.trigger('error', ['没有触发的item']);
            }
        }
    };
    return CheckInQueue;
});
