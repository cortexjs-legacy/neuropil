'use strict';

var async       = require('async');
var crypto      = require('crypto');
var node_url    = require('url');
var semver      = require('semver');
var fs          = require('fs');

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
    var self = this;
    this.read_tarball(options, function (err) {
        if ( err ) {
            return callback(err);
        }

        self.prepublish(options, function(err, res, json) {
            if ( err ) {
                // only display 'unauthorized' error
                if (
                    !err.error ||
                    err.error === 'unauthorized'
                ) {
                    return callback(err, res, json);
                }
                
            } else {
                return callback(null, res, json);
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
    });
};


exports.read_tarball = function (options, callback) {
    if ( options.size ) {
        return callback(null);
    }

    var tar = options.tar;
    fs.stat(tar, function(err, size) {
        if ( err ) {
            return callback(err);
        }

        options.size = size;
        fs.readFile(tar, 'base64', function(err, tardata) {
            if ( err ) {
                return callback(err);
            }

            options.tardata = tardata;
            callback(null);
        });
    });
};


// Try to create a new package if not exists.
// If the package already exists, the update will fail 
exports.prepublish = function(options, callback) {
    var pkg = options.pkg;

    if(!options.info){
        // info to put into this.context.db
        var info = options.info = {
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
            ],
            _attachments: {}
        };

        info.versions[pkg.version] = pkg;

        var tarball_name = pkg.name + '-' + pkg.version + '.tgz';
        info._attachments[tarball_name] = {
            content_type: 'application/octet-stream',
            data: options.tardata,
            length: options.size
        };

        var tag = pkg.tag || 'latest';
        info['dist-tags'][tag] = pkg.version;

        var escaped_name = this.context.db.escape(pkg.name);

        // `pkg.maintainers` indicate the maintainer who update the current version
        pkg.maintainers = info.maintainers;
        pkg._id = pkg.name + '@' + pkg.version;
        pkg.dist = {};
        pkg.dist.tarball = this.context.db.resolve(escaped_name + '/-/' + escaped_name + '-' + pkg.version + '.tgz', null);
        pkg.dist.shasum = crypto.createHash("sha1").update(options.tardata, 'base64').digest("hex");
    }

    this.context.db.put(pkg.name, {
        json: options.info

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
                    exitcode: 171,
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
                        exitcode: 172,
                        message: '"' + full_name + '" already found.',
                        data: {
                            name    : name,
                            version : version
                        }
                    };

                } else {
                    error = {
                        code: 'EPUBSTABLEFOUND',
                        exitcode: 173,
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

    options.info = this.merge_document(version, options.info, info);

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

    this.override(options, callback);
};


// Merge new package data to the old, so that the information won't get dirty.
exports.merge_document = function (version, neo, old) {
    old.versions[version] = neo.versions[version];
    var key;
    var value;
    var sub_key;

    // Merge new data to the old
    for (key in neo) {
        switch (key) {
            // objects that copy over the new stuffs
            case 'dist-tags':
            case 'versions':
            case '_attachments':
                value = neo[key];
                for (sub_key in value) {
                    old[key][sub_key] = value[sub_key];
                }
                break;

            // `neo.maintainers` only has the information of the current publisher,
            // We must retain the `old.maintainers` unchanged, so that coworkers will not be overidden, #33 
            case 'maintainers':
                break;

            // copy
            default:
                old[key] = neo[key];
        }
    }

    return old;
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

