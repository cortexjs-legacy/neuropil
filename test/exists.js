'use strict';

var neuropil = require('./lib/neuropil');

neuropil.exists({
    name: 'fs-sync',
    version: '0.1.2'

}, function (err, data) {
    console.log(err, 'exists', data.exists)
})