'use strict';

// A simple queue

module.exports = function (callback) {
    return new Queue(callback);
};

function Queue (callback){
    this._counter = 0;
    this.callback = callback;

    this._check = this._check.bind(this);
};

Queue.prototype.createHandle = function() {
    ++ this._counter;

    return this._check
};

Queue.prototype._check = function(err) {
    if ( this.err ) {
        return;
    }

    if ( err ) {
        this.err = err;
        return this.callback.apply(null, arguments);
    }

    -- this._counter;

    if ( this._counter === 0 ) {
        this.callback(null);
    }
};
