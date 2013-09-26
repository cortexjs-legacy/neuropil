'use strict';

var adduser = module.exports = {};
var crypto  = require('crypto');
var lang    = require('../util/lang');


function sha (s) {
    return crypto.createHash("sha1").update(s).digest("hex");
};


// @param {Object} options
// - username
// - email
// - password
// - signup: {boolean}
adduser.run = function(options, callback) {
    var doc_name = '/-/user/org.couchdb.user:' + encodeURIComponent(options.username);
    var user = adduser.create_document(options);
    var self = this;

    var data = {
        json: user
    };

    if ( options.signup ) {
        data.auth = null;
    }

    this.db.put(doc_name, data, function(err, res, json) {
        if(
            // If there's no error, which means we are really lucky
            !err ||

            // If error occurs, and the error is not caused by conflict of document updating, 
            // then we consider it a failure.
            err.error !== 'conflict'
        ){
            return callback(err, res, json);
        }

        self.logger.verbose(options.username, 'already exists, try to update.');

        self.db.get(doc_name, function(err, res, json) {
            if(err){
                return callback(err, res, json);
            }

            lang.mix(user, json, false);

            self.db.put(doc_name + '/-rev/' + user._rev, {
                json: user

            }, function (err, res, json) {

                // 
                if ( err && res.statusCode !== 403 ) {
                    return callback(err);
                }

                callback(null, res, json);
            });
        });
    });
};


// @param {Object} options
// - username
// - email
// - password
adduser.create_document = function(options) {
    var salt = crypto.randomBytes(30).toString('hex');
    var username = options.username;
    var email    = options.email;
    var password = options.password;

    return {
        name            : username,
        salt            : salt,
        password_sha    : sha( password + salt ),
        email           : email,
        _id             : 'org.couchdb.user:' + username,
        type            : 'user',
        roles           : [],
        date            : new Date().toISOString()
    };
};

