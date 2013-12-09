'use strict';

var async       = require('async');
var sha         = require('sha');
var node_url    = require('url');
var semver      = require('semver');

// @param {Object} options
// - tar: {string} tar file path
// - pkg: {Object} the object of package.json
// - force: {boolean} force publishing
exports.run = function (options, callback) {
    if ( !this.context.db.hasAuth() ) {
        return callback({
            code: 'ENEEDAUTH',
            message: 'auth and email required for publishing',
            data: {
                method: 'publish'
            },
            from: 'neuropil'
        });
    }

    var pkg = options.pkg;

    if(!options.info){
        // info to put into this.context.db
        options.info = {
            _id: pkg.name,
            name: pkg.name,
            description: pkg.description,
            'dist-tags': {},
            versions: {},
            readme: pkg.readme || '',
            maintainers: [
                {
                    name: this.context.options.username,
                    email: this.context.options.email
                }
            ]
        };
    }

    var self = this;
    this.prepublish(options, function(err, res, json) {
        if(
            err &&

            // only display 'unauthorized' error
            (
                !err.error ||
                err.error === 'unauthorized'
            )
        ){
            return callback(err, res, json);
        }

        async.waterfall([
            function (done) {
                self.get_package_info(pkg.name, done);
            },

            function (res, info, done) {
                self.check_version(options, info, done);
            }

        ], callback);
    });
}


// Try to create a new package if not exists.
// If the package already exists, the update will fail 
exports.prepublish = function(options, callback) {
    var info = options.info;
    var pkg = options.pkg;

    this.context.db.put(pkg.name, {
        json: info

    }, function(err, res, json) {
        if (
            err && 
            // 409 
            // -> Document update conflict, which means the document of the package exists.
            // This is a new version of the existing package.
            // !(res && res.statusCode === 409) &&
            err.error !== 'conflict' &&
            err.reason !== 'must supply latest _rev to update existing package'
        ) {
            return callback(err, res, json);
        }

        callback(null, res, json);
    });
};


exports.get_package_info = function(name, callback) {
    this.context.db.get( this.context.db.escape(name), callback);
};


// check if there is a version conflict
exports.check_version = function(options, info, callback) {
    var pkg = options.pkg;

    var name = pkg.name;
    var version = pkg.version;

    var full_name = name + '@' + version;
    var versions = info.versions;
    var versions_list = Object.keys(versions);

    var version_obj = semver.parse(version);
    var error;
    
    if ( options.force ) {
        this.context.emit('warn', {
            code: 'WFORCE',
            message: '"--force" option found, force overriding "' + full_name + '".',
            data: {
                option: 'force',
                package: full_name
            }
        });
    }

    // see [#165](https://github.com/kaelzhang/cortex/issues/165)
    // if options._override, skip checking
    if ( !options._override && versions_list.length ) {
        // the corresponding stable version of the current version
        // '1.2.3-alpha'    -> '1.2.3'
        // '1.2.3'          -> '1.2.3'
        var stable = this.get_stable(version_obj);

        // '1.2.3' -> '~1.2'
        var minor_range = '~' + version_obj.major + '.' + version_obj.minor;
        // Get the newest version of the current minor.
        var max = semver.maxSatisfying( versions_list, minor_range);

        // if found
        if ( max ) {
            // the stable version is out of date, so all versions of the current patch are expired.
            if ( semver.gt(max, stable) ) {
                error = {
                    code: 'EPUBOUTDATE',
                    message: 'A newer patch or prerelease version "' + name + '@' + max + '" is already found.',
                    data: {
                        name    : name,
                        version : version,
                        newer   : max
                    }
                };
            
            // the current stable version is found, there is a conflict
            } else if ( max === stable && (stable in versions)) {
                // conflict
                if ( version === stable ) {
                    error = {
                        code: 'EPUBCONFLICT',
                        message: '"' + full_name + '" already found.',
                        data: {
                            name    : name,
                            version : version
                        }
                    };

                } else {
                    error = {
                        code: 'EPUBSTABLEFOUND',
                        message: 'The stable version "' + name + '@' + stable + '" is already found.',
                        data: {
                            name: name,
                            version: version,
                            stable: stable
                        }
                    };
                }
            }
        }
    }

    // if --force, ignores all errors
    if ( error && !options.force ) {
        return callback(error);
    }


    if ( version in versions ) {
        this.context.emit('info', {
            code: 'IPUBOVERIDE',
            message: 'version "' + full_name + '"',
            data: {
                label   : 'override',
                name    : name,
                version : version
            }
        });

        options._override = true;
        delete options.force;

        return this.override(options, callback);

    } else {
        return this.update_package(options, info, callback);
    } 
};


exports.get_stable = function (semver_obj) {
    if ( typeof semver_obj === 'string' ) {
        semver_obj = semver.parse(semver_obj);
    }

    return [ semver_obj.major, semver_obj.minor, semver_obj.patch ].join('.');
};


exports.override = function (options, callback) {
    var self = this;
    var pkg = options.pkg;
    
    // unpublish the current version to force publishing
    this.context.unpublish({
        name        : pkg.name,
        version     : pkg.version,
        maintain_doc: true

    }, function(err, res, json) {
        if(err){
            return callback(err, res, json);
        }

        var full_name = pkg.name + '@' + pkg.version; 

        self.context.emit('info', {
            code: 'IREPUBLISH',
            message: full_name,
            data: {
                label: 'republish',
                package: full_name
            }
        });

        self.run(options, callback);
    });
};


// @param {Object} options of `publish`
// @param {Object} info package information
exports.update_package = function(options, info, callback) {
    var pkg = options.pkg;
    var file_name = pkg.name + '-' + pkg.version + '.tgz';
    
    var self = this;
    // upload attachments(tarball)
    this.context.attachment({
        name    : pkg.name,
        filename: file_name,
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
            var escaped_name = self.context.db.escape(pkg.name);

            var path = escaped_name + '/' + pkg.version + '/-tag/' + tag;

            pkg._id = pkg.name + '@' + pkg.version;
            // pkg.dist = pkg.dist || {}
            pkg.dist = {};
            pkg.dist.tarball = self.context.db.resolve(escaped_name + '/-/' + escaped_name + '-' + pkg.version + '.tgz', null);
            pkg.dist.shasum = shasum;

            // update version
            self.context.db.put(path, {
                json: pkg

            }, callback);
        });

    });
};

