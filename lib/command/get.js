'use strict';

var node_url = require('url');
 
exports.run = function (path, options, callback) {
    var db = this.context.db;

    if ( typeof options === 'function' ) {
        callback = options;
        options = {};
    }

    db.get(path, options, callback);
};