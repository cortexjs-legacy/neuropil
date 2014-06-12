'use strict';

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
exports.run = function(options, callback) {
    var doc_name = '/-/user/org.couchdb.user:' + encodeURIComponent(options.username);
    var user = this.create_document(options);
    var self = this;

    var data = {
        json: user
    };

    if ( options.signup ) {
        data.auth = null;
    }

    this.context.db.put(doc_name, {
        json: user,

        // There might be a situation that user already has auth info locally,
        // and changes the registry url, and the new registry doesn't has such a user.
        // If we use auth checking here, a 401 error will occur.
        // So, always try to put new document without auth checking
        auth: null

    }, function(err, res, json) {
        if(
            // If there's no error, which means we are really lucky, that everything is done, the user just signup a new user
            !err ||

            // If error occurs, and the error is not caused by conflict of document updating, 
            // then we consider it a failure.
            err.error !== 'conflict'
        ){
            return callback(err, res, json);
        }

        self.context.db.get(doc_name, function(err, res, json) {
            if(err){
                return callback(err, res, json);
            }

            var username = options.username;
            var old_user = self.context.options.username;

            // if the current username is the same as the new one,
            // -> the user is trying to change the password
            if ( username === old_user ) {
                data.auth = {
                    username: old_user,
                    password: self.context.options.password
                };

                self.context.emit('info', {
                    code: 'IUPDATEUSER',
                    message: 'update information for current user "' + username + '" ...',
                    data: {
                        username: username,
                        type: 'update'
                    }
                });

            // -> the user is trying to switch to another acount
            } else {
                data.auth = {
                    // use the new password
                    username: options.username,
                    password: options.password
                };

                self.context.emit('info', {
                    code: 'ISWITCHUSER',
                    message: 'switch user from "' + old_user + '" to "' + username + '"...',
                    data: {
                        username: username,
                        old_user: old_user,
                        type: 'switch'
                    }
                });
            }

            lang.mix(user, json, false);

            self.context.db.put(doc_name + '/-rev/' + json._rev, data, function (err, res, json) {
                if ( err ) {
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
exports.create_document = function(options) {
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

