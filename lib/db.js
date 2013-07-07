'use strict';

var couchdb = require('./couchdb');

module.exports = couchdb({
    host: 'registry.npm.lc',
    port: 80,
    auth: {
        username: 'kael',
        password: 'fLacus'
    },
    // retries: 3,
    // retryTimeout: 30 * 1000
});