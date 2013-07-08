'use strict';

module.exports = unpublish;

var db = require('../db');
var semver = require('semver');


// @param {Object} options
// - name: {string} must specified
// - version: {string} semver or '*'. must specified
function unpublish(options, callback, logger) {
    var name = options.name;
    var version = options.version;

    db.get( db.escape(name), function(err, res, json) {
        if(err){
            return callback(err, res, json);
        }

        if(json.error === 'not_found'){
            return callback(new Error('Package "' + name + '" not published.'), res, json);
        }

        if(
            // to remove all
            version === '*' || 
            // There might be an error, the package has no versions and need to be eliminated
            !json.versions || Object.keys(json.versions).length === 0 ||
            // The only version
            (version in json.versions) && Object.keys(json.versions).length === 1
        ){
            logger.log('')
            return unpublish.all({
                name: options.name,
                rev: json._rev
            }, callback, logger);
        }

        if( version in json.versions ){
            return unpublish.one({
                name: name,
                version: version,
                rev: json._rev,
                info: json

            }, callback, logger);

        }else{
            return callback(new Error('Version "' + version + '" not found.'), res, json);
        }
    });
}


// @param {Object} options
// - name
// - rev
unpublish.all = function(options, callback, logger) {
    db.del( db.escape(options.name) + '/-rev/' + options.rev, callback);
};


// - info: {Object} package information
// - version: {string} semver
// - name
// - rev
unpublish.one = function(options, callback, logger) {
    var info = options.info;
    var version = options.version;
    var versions = info.versions;
    var dists = info['dist-tags'];

    delete versions[version];
    info.time && 
    delete info.time[version];
    delete info._revisions;
    delete info._attachments;

    var latest = dists.latest;
    if(latest === version){
        Object.keys(dists).forEach(function(tag) {
            if(dists[tag] === version){
                delete dists[tag];
            }
        });
    }

    if(latest === version){
        dists.latest = Object.getOwnPropertyNames(versions).sort(semver.compare).pop();
    }

    logger.debug('update', db.escape(options.name) + '/-rev/' + options.rev);
    db.put( db.escape(options.name) + '/-rev/' + options.rev, info, function(err, res, json) {
        if(err){
            return callback(err, res, json);
        }

        unpublish.detach({

        }, callback);
    });
};


// detach an attachment
// @param {Object} options
// - info
unpublish.detach = function(options, callback) {
    callback();
};

