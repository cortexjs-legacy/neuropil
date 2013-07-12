'use strict';

module.exports = publish;

var async = require('async');
var sha = require('sha');
var node_url = require('url');

var attachment = require('./attachment');
var unpublish = require('./unpublish');

var REGEX_IS_SNAPSHOT = /\-SNAPSHOT$/;


// @param {Object} options
// - tar: {string} tar file path
// - pkg: {Object} the object of package.json
// - force: {boolean} force publishing
// - enable_snapshot: {boolean} whether to enable snapshot version
// - registry: {string} absolute url
function publish (options, callback, logger, db) {
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
            {
                name: this.options.username,
                email: this.options.email
            }
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
                publish.get_package_info(pkg.name, done, logger, db);
            },

            function(res, info, done) {
                publish.check_version(options, info, function(err, res, json) {
                    if(err){
                        return done(err, res, json);
                    }

                    publish.update_package(options, info, done, logger, db);

                }, logger, db);
            }

        ], callback);
        
    }, logger, db);
}


// Try to create a new package if not exists.
// If the package already exists, the update will fail 
publish.prepublish = function(options, callback, logger, db) {
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


publish.get_package_info = function(name, callback, logger, db) {

    db.get( db.escape(name), callback);
};


// check if there is a version conflict
publish.check_version = function(options, info, callback, logger, db) {
    var pkg = options.pkg;
    var snapshot_enabled = options.enable_snapshot;

    if(pkg.version in info.versions){

        // if is a snapshot version, force publishing
        if(snapshot_enabled && options.is_snapshot){
            logger.verbose(
                logger.template('Override an existing snapshot: "{{name}}-{{version}}"', {
                    name: pkg.name,
                    version: pkg.version
                })
            );
        
        }else if(options.force){
            logger.verbose('"--force" option found, force overriding.');
        
        }else{
            return callback(
                new Error('"' + pkg.name + '-' + pkg.version + '" already found, maybe you should use "SNAPSHOT" version or use "--force" option.')
            );
        }

        logger.verbose('Unpublish package');

        // unpublish the current version to force publishing
        unpublish({
            name: pkg.name,
            version: pkg.version

        }, callback, logger, db);
    
    }else{
        callback();
    }
};


// @param {Object} options of `publish`
// @param {Object} info package information
publish.update_package = function(options, info, callback, logger, db) {
    var pkg = options.pkg;
    var file_name = pkg.name + '-' + pkg.version + '.tgz';

    logger.verbose('upload attachments:', file_name);
    
    // upload attachments(tarball)
    attachment({
        pkg     : pkg.name,
        name    : file_name,
        rev     : info._rev,
        tar     : options.tar

    }, function(err) {
        if(err){
            return callback(err);
        }

        sha.get(options.tar, function(err, shasum) {
            if(err){
                return callback(err);
            }

            var pkg = options.pkg;
            var tag = pkg.tag || 'latest';
            var escaped_name = db.escape(pkg.name);

            var path = escaped_name + '/' + pkg.version + '/-tag/' + tag;

            pkg._id = pkg.name + '@' + pkg.version;
            // pkg.dist = pkg.dist || {}
            pkg.dist = {};
            pkg.dist.tarball = node_url.resolve(options.registry, escaped_name + '/-/' + escaped_name + '-' + pkg.version + '.tgz');
            pkg.dist.shasum = shasum;

            logger.debug('update dist-tags:', pkg._id, path);

            // update version
            db.put(path, {
                json: pkg

            }, callback);
        });

    }, logger, db);
};

