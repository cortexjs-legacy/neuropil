'use strict';

var neuropil = module.exports = function(options) {
    return new Neuropil(options); 
};

var util = require('util');
var events = require('events');
var couchdb = require('./lib/couchdb');


function Neuropil(options) {
    this.options = options;

    if(options.logger){
        this.logger = options.logger;
    }

    this.db = this._createDB(options);
};

// @param {Object} options
// - auth: {Object}
//      - username:
//      - password
// - port: {number}
// - host: 'registry.npm.lc'
// // - retries: 3,
// // - retryTimeout: 30 * 1000
Neuropil.prototype._createDB = function(options) {
    return couchdb(options);  
};


[
    'adduser', 
    'attachment', 
    'publish',
    'unpublish'

].forEach(function(method) {
    Neuropil.prototype[method] = function(options, callback) {
        var command = require('./lib/commands/' + method);

        command(options, callback, this.logger, this.db);
    }
});

