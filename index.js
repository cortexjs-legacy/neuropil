'use strict';

var neuropil = module.exports = function(options) {
    return new Neuropil(options); 
};

neuropil.Neuropil = Neuropil;

var util = require('util');
var events = require('events');
var couchdb = require('./lib/couchdb');


// @param {Object} options
// - username
// - password
// - email
// - port
// - host
function Neuropil(options) {
    this.options = options;

    if(options.logger){
        this.logger = options.logger;
    }

    this.db = this._createDB({
        auth: {
            username: options.username,
            password: options.password
        },

        port    : options.port,
        host    : options.host
    
    });
};

Neuropil.prototype.on = function(type, handler) {
    this.db.on(type, handler);
    return this;    
};

// - retries: 3,
// - retryTimeout: 30 * 1000
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
        var command = require('./lib/command/' + method);

        command.call(this, options, callback, this.logger, this.db);
    }
});

