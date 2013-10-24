'use strict';

var neuropil = module.exports = function(options) {
    return new Neuropil(options); 
};

neuropil.Neuropil = Neuropil;

var util    = require('util');
// var EE      = require('events').EventEmitter;
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

// util.inherits(Neuropil, EE);

Neuropil.prototype.on = function(type, handler) {
    this.db.on( type, handler.bind(this) );
    return this;
};


Neuropil.prototype.changeDB = function(options) {
    this.db = couchdb({
        auth: {
            username: options.username,
            password: options.password
        },

        port    : options.port,
        host    : options.host,
        makeCallback: make_callback
    });

    this._hookDbGet();

    return this.db;
};

// all get 
Neuropil.prototype._hookDbGet = function() {
    var db = this.db;
    var get_method = db.get;

    db.get = function (doc, options, callback) {
        if ( arguments.length === 2 ) {
            callback = options;
            options = {};
        }

        options.auth = null;

        return get_method.call(db, doc, options, callback);
    };
};

function make_callback (callback) {
    return function (err, res, json) {
        if ( !err && json && json.error ) {

            // Convert couchdb error to javascript error
            err = {};
            // compatible
            err.message = json.reason;
            err.error = json.error;
            err.toString = function () {
                return json.reason;
            };
        }

        callback(err, res, json);
    };
}


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

