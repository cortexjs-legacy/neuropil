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

    this.changeDB(options);
};

Neuropil.prototype.on = function(type, handler) {
    this.db.on( type, handler.bind(this) );
    return this;    
};


Neuropil.prototype.changeDB = function(options) {
    return this.db = couchdb({
        auth: {
            username: options.username,
            password: options.password
        },

        port    : options.port,
        host    : options.host
    });
};


Neuropil.prototype._get_commander = function (command) {
    var commander = this.__commands[command];

    if(!commander){
        commander = this.__commands[command] = require('./lib/command/' + command);
        commander.logger = this.logger;
        commander.db = this.db;
        commander.options = this.options;
    }

    return commander;
};


[
    'adduser', 
    'attachment', 
    'publish',
    'unpublish',
    'install',
    'exists'

].forEach(function(method) {
    Neuropil.prototype[method] = function(options, callback) {
        var commander = this._get_commander(method);

        commander.run(options, callback);
    }
});

