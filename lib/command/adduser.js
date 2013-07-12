'use strict';

var crypto = require('crypto');
var lang = require('../util/lang');


function sha (s) {
    return crypto.createHash("sha1").update(s).digest("hex");
};


var adduser = module.exports = function(options, callback, logger, db) {
    var doc_name = '/-/user/org.couchdb.user:' + encodeURIComponent(options.username);
    var user = adduser.create_document(options);

    db.put(doc_name, {
        json: user
    }, function(err, res, json) {
        logger.debug('{{magenta PUT}}', doc_name, '{{cyan res}}:', err, json);

        if(
            err ||

            // if document update conflict, we will update a new rev
            json.error !== 'conflict'
        ){
            return callback(err, res, json);
        }

        logger.verbose(options.username, 'already exists, try to update.');

        db.get(doc_name, function(err, res, json) {
            logger.debug('{{magenta GET}}', doc_name, '{{cyan res}}:', err, json);

            if(err){
                return callback(err, res, json);
            }

            lang.mix(user, json, false);

            db.put(doc_name + '/-rev/' + user._rev, {
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
        _id             : 'org.couchdb.user:' + username,
        type            : 'user',
        roles           : [],
        date            : new Date().toISOString()
    };
};

