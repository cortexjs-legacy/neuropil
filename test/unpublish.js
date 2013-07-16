'use strict';

var neuropil = require('./lib/neuropil')


neuropil.unpublish({
    name: 'fs-sync',
    version: '0.1.8'

}, function(err, res, json) {
    if(err){
        return console.log(err)
    }
});