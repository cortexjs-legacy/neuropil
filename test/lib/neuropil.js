'use strict';

var neuropil = require('neuropil');

module.exports = neuropil({
    logger: require('./logger'),

    username: 'kael2',
    password: 'blah-blah-bie',
    email: 'i@kael.me',

    port: 80,
    host: 'registry.npm.dp'
});