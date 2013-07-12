'use strict';

module.exports = unpublish;

var semver = require('semver');
var node_url = require('url');

// Neuropil will do nothing about checking '--force' option
// @param {Object} options
// - name: {string} must specified
// - version: {string} semver or '*'. must specified
function unpublish(options, callback, logger, db) {
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

            logger.verbose('{{cyan unpublish}} all');
            return unpublish.all({
                name: options.name,
                rev: json._rev

            }, callback, logger, db);
        }

        if( version in json.versions ){
            logger.verbose(
                logger.template('{{cyan unpublish}} {{name}}@{{version}}', {
                    name: name,
                    version: version
                })
            );

            return unpublish.one({
                name: name,
                version: version,
                rev: json._rev,
                info: json

            }, callback, logger, db);

        }else{
            return callback(new Error('Version "' + version + '" not found.'), res, json);
        }
    });
}


// @param {Object} options
// - name
// - rev
unpublish.all = function(options, callback, logger, db) {
    db.del( db.escape(options.name) + '/-rev/' + options.rev, callback);
};


// - info: {Object} package information
// - version: {string} semver
// - name
// - rev
unpublish.one = function(options, callback, logger, db) {
    var info = options.info;
    var version = options.version;
    var versions = info.versions;
    var dist_tags = info['dist-tags'];
    var tarball = versions[version].dist.tarball;

    delete versions[version];
    
    delete info._revisions;
    delete info._attachments;

    var latest = dist_tags.latest;
    if(latest === version){
        Object.keys(dist_tags).forEach(function(tag) {
            if(dist_tags[tag] === version){
                delete dist_tags[tag];
            }
        });
    }

    if(latest === version){
        dist_tags.latest = Object.getOwnPropertyNames(versions).sort(semver.compare).pop();
    }

    db.put( db.escape(options.name) + '/-rev/' + options.rev, {
        json: info

    }, function(err, res, json) {


        if(err){
            return callback(err, res, json);
        }

        unpublish.detach({
            tarball: tarball,
            rev: options.rev

        }, callback, logger, db);
    });
};


// detach an attachment
// @param {Object} options
// - tarball: {}
// - rev
unpublish.detach = function(options, callback, logger, db) {
    var path = node_url.parse(options.tarball).pathname + '/-rev/' + options.rev;

    logger.verbose('delete attachments', path);
    db.del(path, callback);
};

