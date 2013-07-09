'use strict';

var neuropil = require('./lib/neuropil')


neuropil.adduser({
    username: 'kael2',
    password: 'blah-blah-bie',
    email: 'i@kael.me'

}, function(err, res, json) {
    console.log(err, json);

});