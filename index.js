'use strict';

var neuropil = module.exports = function(options) {
    return new Neuropil(options); 
};

neuropil.Neuropil = Neuropil;

var util        = require('util');
var EE          = require('events').EventEmitter;
var couchdb     = require('couch-db');

var init_commander   = require('./lib/util/init-commander'); 


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

util.inherits(Neuropil, EE);

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
    this._initDbEvents();

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


// listen the events of couch-db
Neuropil.prototype._initDbEvents = function() {
    var self = this;
    this.db.on('request', function (e) {
        self.emit('request', e); 
    });

    this.db.on('response', function(e){
        self.emit('response', e);
    });
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
        commander = this.__commands[command] = init_commander(require('./lib/command/' + command), this);
    }

    return commander;
};


[
    'adduser', 
    'attachment', 
    'publish',
    'unpublish',
    'install',
    'get'

].forEach(function(method) {
    Neuropil.prototype[method] = function(options, callback) {
        var commander = this._get_commander(method);

        commander.run(options, callback);
    }
});

