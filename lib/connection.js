'use strict';

var cradle = require('cradle');

module.exports = new cradle.Connection({
    host: 'localhost',
    port: 5984,
    auth: {
        username: 'kael',
        password: 'fLacus'
    },
    retries: 3,
    retryTimeout: 30 * 1000
});