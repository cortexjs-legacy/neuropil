'use strict';

var crypto = require('crypto');
var db = require('../connection').database('_users');


function sha (s) {
    return crypto.createHash("sha1").update(s).digest("hex");
};


var adduser = module.exports = function(options, callback) {
    var doc_name = 'org.couchdb.user:' + encodeURIComponent(options.username);

    db.save(doc_name, adduser.create_document(options), callback);
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

// adduser.get_user = function(doc_name, callback) {
//     db.get(doc_name, callback);
// };

