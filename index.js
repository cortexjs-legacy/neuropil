'use strict';

var neuropil = module.exports = function(options) {
    return new Neuropil(options); 
};

var cradle = require('cradle');
var loggie = require('loggie');

var logger = loggie();


function Neuropil(options) {
    
};


var db = new cradle.Connection({
    host: 'http://localhost',
    port: 5984,
    username: 'kael',
    password: 'fLacus',
    retries: 3,
    retryTimeout: 30 * 1000

}).database('_users');


db.exists(function(err, exists) {
    logger.info('exists', err, exists); 
});

db.get('cortex', function(err, doc) {
    logger.info('get cortex', err, doc); 
});


db.save('org.couchdb.user:kael2', {
    _id: 'org.couchdb.user:kael2',
    date: new Date().toISOString(),
    salt : 'b220cbae34e34e973bdad33299278ba541f8a7f219cf34607c798ad351a9',
    password_sha : '297b3059614b7f41a0ff482c3b084582fe50861a',
    email : 'blah@gmail.com',
    type : "user",
    name: 'kael2',
    roles : []

}, function(err, result) {
    logger.info('save user', err, result);
});


logger.end();

