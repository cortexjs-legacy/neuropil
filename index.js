'use strict';

var neuropil = module.exports = function(options) {
    return new Neuropil(options); 
};

neuropil.Neuropil = Neuropil;

var util = require('util');
var events = require('events');
var couchdb = require('couch-db');


// @param {Object} options
// - username
// - password
// - email
// - port
// - host
function Neuropil(options) {
    this.options = options;

    this.__commands = {};

    if(options.logger){
        this.logger = options.logger;
    }

    this.db = this._create_db({
        auth: {
            username: options.username,
            password: options.password
        },

        port    : options.port,
        host    : options.host
    
    });
};

Neuropil.prototype.on = function(type, handler) {
    this.db.on( type, handler.bind(this) );
    return this;    
};

// - retries: 3,
// - retryTimeout: 30 * 1000
Neuropil.prototype._create_db = function(options) {
    return couchdb(options);
};


Neuropil.prototype._get_commander = function (command) {
    var commander = this.__commands[command];

    if(!commander){
        commander = this.__commands[command] = require('./lib/command/' + command);
        commander.logger = this.logger;
        commander.db = this.db;
    }

    return commander;
};


[
    'adduser', 
    'attachment', 
    'publish',
    'unpublish',
    'install'

].forEach(function(method) {
    Neuropil.prototype[method] = function(options, callback) {
        var commander = this._get_commander(method);

        commander.run(options, callback);
    }
});

