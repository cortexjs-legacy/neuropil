'use strict';

var neuropil = require('./lib/neuropil')


neuropil.adduser({
    username: 'kael6',
    password: 'blah-blah-bie',
    email: 'i@kael.me',
    signup: true

}, function(err, res, json) {
    console.log(err, json);

});