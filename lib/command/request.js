'use strict';

var request = module.exports = {};

request.run = function (path, options, callback) {
    this.context.db.request(path, options, callback);
};

