'use strict';

module.exports = publish;

var async = require('async');
var node_url = require('url');

var db = require('../db');
var attachment = require('./attachment');

var REGEX_IS_SNAPSHOT = /\-SNAPSHOT$/;


// @param {Object} options
// - tar: {string} tar file path
// - pkg: {Object} the object of package.json
// - force: {boolean} force publishing
// - enable_snapshot: {boolean} whether to enable snapshot version
// - registry: {string} absolute url
function publish (options, callback, logger) {
    var pkg = options.pkg;

    // info to put into couchdb
    options.info = {
        _id: pkg.name,
        name: pkg.name,
        description: pkg.description,
        'dist-tags': {},
        versions: {},
        readme: pkg.readme || '',
        maintainers: [
            // {
            //     name: username,
            //     email: email
            // }
        ]
    };

    // whether is snapshot
    options.is_snapshot = REGEX_IS_SNAPSHOT.test(pkg.version);

    publish.prepublish(options, function(err, res, json) {
        if(err){
            return callback(err, res, json);
        }

        async.waterfall([
            function(done) {
                publish.get_package_info(pkg.name, done, logger);
            },

            function(res, info, done) {
                publish.update_package(options, info, done, logger)
            }

        ], callback);
    }, logger);
}


// Try to create a new package if not exists.
// If the package already exists, the update will fail 
publish.prepublish = function(options, callback, logger) {
    var info = options.info;
    var pkg = options.pkg;

    logger.verbose('{{cyan prepublish}}', pkg.name);
    db.put(pkg.name, {
        json: info

    }, function(err, res, json) {
        logger.debug('prepublish response', err, json);

        if (
            err && 
            // 409 
            // -> Document update conflict, which means the document of the package exists.
            // This is a new version of the existing package.
            !(res && res.statusCode === 409) && 
            !(
                json && 
                json.reason === "must supply latest _rev to update existing package"
            )
        ) {
            return callback(new Error(
                logger.template('Failed PUT response: {{e}}', {
                    e: err
                })
            ));
        }

        callback(null, res, json);
    });
};


publish.get_package_info = function(name, callback, logger) {
    logger.verbose('{{cyan get info}}', name)
    db.get( db.escape(name), callback);
};


// @param {Object} options of `publish`
// @param {Object} info package information
publish.update_package = function(options, info, callback, logger) {
    var pkg = options.pkg;
    var snapshot_enabled = options.enable_snapshot;

    if(pkg.version in info.versions){
        if(snapshot_enabled && options.is_snapshot){
            logger.log(
                logger.template('Override an existing snapshot: "{{name}}-{{version}}"', {
                    name: pkg.name,
                    version: pkg.version
                })
            );
        
        }else if(options.force){
            logger.log('"--force" option found, force overriding.');
        
        }else{
            return callback(
                new Error('"' + pkg.name + '-' + pkg.version + '" already found, maybe you should use "SNAPSHOT" version or use "--force" option.')
            );
        }
    }


    var file_name = pkg.name + '-' + pkg.version + '.tgz';

    logger.verbose('{{cyan upload}}', file_name);
    attachment({
        pkg     : pkg.name,
        name    : file_name,
        rev     : info._rev,
        tar     : options.tar

    }, function(err) {
        if(err){
            return callback(err);
        }

        var pkg = options.pkg;
        var tag = pkg.tag || 'latest';
        var escaped_name = db.escape(pkg.name);

        var path = escaped_name + '/' + pkg.version + '/-tag/' + tag;

        pkg._id = pkg.name + '@' + pkg.version;
        pkg.dist = pkg.dist || {}
        pkg.dist.tarball = node_url.resolve(options.registry, escaped_name + '/-/' + escaped_name + '-' + pkg.version + '.tgz');

        logger.debug('update version', pkg._id, path);
        db.put(path, {
            json: pkg

        }, callback);

    }, logger);
};

