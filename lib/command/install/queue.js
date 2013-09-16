'use strict';

// A simple queue

module.exports = function (callback) {
    return new Queue(callback);
};

function Queue (callback){
    this._counter = 0;
    this.callback = callback;
};

Queue.prototype.createHandle = function() {
    var self = this;
    ++ this._counter;

    return function(err){
        self._check(err);
    }
};

Queue.prototype._check = function(err) {
    if ( this.err ) {
        return;
    }

    if ( err ) {
        this.err = err;
        return this.callback(err);
    }

    -- this._counter;

    if ( this._counter === 0 ) {
        this.callback(null);   
    }
};
