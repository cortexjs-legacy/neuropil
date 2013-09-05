'use strict';

var publish = module.exports = {};

var async = require('async');
var sha = require('sha');
var node_url = require('url');

var attachment = require('./attachment');
var unpublish = require('./unpublish');
var init_commander = require('../util/init-commander');

// @param {Object} options
// - tar: {string} tar file path
// - pkg: {Object} the object of package.json
// - force: {boolean} force publishing
publish.run = function (options, callback) {
    init_commander(attachment, this);
    init_commander(unpublish, this);

    var pkg = options.pkg;

    if(!options.info){
        // info to put into couchthis.db
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
    }

    publish.prepublish(options, function(err, res, json) {
        if(err){
            return callback(err, res, json);
        }

        if(json.error){
            return callback(json.reason, res);
        }

        async.waterfall([
            function(done) {
                publish.get_package_info(pkg.name, done);
            },

            function(res, info, done) {
                publish.check_version(options, info, done);
            }

        ], callback);
    });
}


// Try to create a new package if not exists.
// If the package already exists, the update will fail 
publish.prepublish = function(options, callback) {
    var info = options.info;
    var pkg = options.pkg;

    this.logger.verbose('{{cyan prepublish}}', pkg.name);
    this.db.put(pkg.name, {
        json: info

    }, function(err, res, json) {
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
            return callback(err, res, json);
        }

        callback(null, res, json);
    });
};


publish.get_package_info = function(name, callback) {
    this.db.get( this.db.escape(name), callback);
};


// check if there is a version conflict
publish.check_version = function(options, info, callback) {
    var pkg = options.pkg;
    var full_name = pkg.name + '@' + pkg.version;

    if(pkg.version in info.versions){
        if(options.force){
            this.logger.verbose('"--force" option found, force overriding "' + full_name + '".');
        
        }else{
            return callback(
                '"' + full_name + '" already found,' + 
                ' maybe you should use "SNAPSHOT" version or use "--force" option.'
            );
        }

        this.logger.info('{{cyan unpublish}}', full_name);

        // unpublish the current version to force publishing
        unpublish.run({
            name: pkg.name,
            version: pkg.version,
            maintain_doc: true

        }, function(err, res, json) {
            if(err){
                return callback(err, res, json);
            }

            publish.logger.info('{{cyan publish}}', full_name);
            publish.run(options, callback)

        });
    
    }else{
        publish.update_package(options, info, callback);
    }
};


// @param {Object} options of `publish`
// @param {Object} info package information
publish.update_package = function(options, info, callback) {
    var pkg = options.pkg;
    var file_name = pkg.name + '-' + pkg.version + '.tgz';

    this.logger.verbose('upload attachments:', file_name);
    
    // upload attachments(tarball)
    attachment.run({
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
            var escaped_name = publish.db.escape(pkg.name);

            var path = escaped_name + '/' + pkg.version + '/-tag/' + tag;

            pkg._id = pkg.name + '@' + pkg.version;
            // pkg.dist = pkg.dist || {}
            pkg.dist = {};
            pkg.dist.tarball = publish.db.resolve(escaped_name + '/-/' + escaped_name + '-' + pkg.version + '.tgz');
            pkg.dist.shasum = shasum;

            // update version
            publish.db.put(path, {
                json: pkg

            }, callback);
        });

    });
};

