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
adduser.run = function(options, callback) {
    var doc_name = '/-/user/org.couchthis.db.user:' + encodeURIComponent(options.username);
    var user = adduser.create_document(options);
    var self = this;

    this.db.put(doc_name, {
        json: user
    }, function(err, res, json) {
        if(
            err ||

            // if document update conflict, we will update a new rev
            json.error !== 'conflict'
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
            }, callback);
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
        _id             : 'org.couchthis.db.user:' + username,
        type            : 'user',
        roles           : [],
        date            : new Date().toISOString()
    };
};

