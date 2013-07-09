'use strict';

var neuropil = require('./lib/neuropil')


neuropil.unpublish({
    name: 'fs-sync',
    version: '0.1.8-SNAPSHOT'

}, function(err, res, json) {
    if(err){
        return console.log(err)
    }
    
    console.log(json);
});