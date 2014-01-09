'use strict';

module.exports = installer;
installer.Installer = Installer;


var fs          = require('fs-sync');
var async       = require('async');
var request     = require('request');
var fstream     = require('fstream');
var tar         = require('tar');

var EE          = require('events').EventEmitter;
var node_util   = require('util');
var node_path   = require('path');
var node_fs     = require('fs');
var node_zlib   = require('zlib');

var lang        = require('../../util/lang');
var cacher      = require('./cacher');

function installer (options, callback) {
    return new Installer(options, callback);
}


// @param {Object} options
// - name
// - version
// - db
// - cache
function Installer (options, callback) {
    this.cache = options.cache;
    this.name = options.name;
    this._version = options.version;
    this.context = options.context;

    this.key = options.key;
    this.dir = options.dir;

    var self = this;

    async.series(
        [
            '_get_module_info',
            '_deal_dependencies',
            '_download',
            '_extract'

        ].map(function (method) {
            return function (done) {
                if ( self.is_skipped() ) {
                    return done(null);
                }

                self[method](done);
            };
        }),

        callback
    );
}

node_util.inherits(Installer, EE);


// Get module information
// - resolve semver range
// - get tarball url
Installer.prototype._get_module_info = function (callback) {
    var name = this.name;
    var _version = this._version;
    var cache = this.cache;

    var self = this;

    this.context.get(this.context.db.escape(name), function (err, res, json) {
        if(err){
            if ( err.error === 'not_found' ) {
                return callback({
                    code: 'EPKGNOTFOUND',
                    message: 'Package "' + name + '" is not found in the registry.',
                    data: {
                        name: name,
                        error: err
                    }

                }, json);

            } else {
                return callback(err, json);
            }
        }

        cache.save_packages(name, json);

        var versions = json.versions;
        var version = lang.get_matched_version(versions, _version);

        if(!version){
            return callback({
                code: 'EVERNOTFOUND',
                data: {
                    name: name,
                    version: _version
                },
                message: 'No version of module "' + 
                    name + 
                    '" matched "' +
                    _version +
                    '".',
                from: 'neuropil'
            });
        }

        var pkg = versions[version];

        // save the explicit version
        self.version = version;
        // the json of package info of the specific version
        self.pkg = pkg;
        self._deal_tarball(pkg);

        if ( !lang.is_explicit_version(_version) ) {
            cache.save_range(name, _version, version);

            // When we install a module with the semver range, 
            // we should check if the explicit version of the module has already been installed.
            self._check_range();
        }

        callback(null);
    });
};


Installer.prototype._check_range = function() {
    // The current version has already been installed, prevent downloading that.
    if ( this.cache.exists(this.name, this.version) ) {
        this.skip();
    } else {
        this.cache.save_module(this.name, this.version);
    }
};


Installer.prototype.skip = function() {
    this._skipped = true;
    this.emit('skip', this.name, this._version);
};


Installer.prototype.is_skipped = function() {
    return !!this._skipped;
};


Installer.prototype._deal_tarball = function (pkg) {
    this.tarball = santitize_tarball_url(pkg.dist.tarball);
    this.shasum = pkg.dist.shasum;
};


Installer.prototype._deal_dependencies = function(callback) {
    var dependencies = lang.object_member_by_namespaces(this.pkg, this.key);

    if ( dependencies ) {
        this.emit('dependencies', dependencies);
    }

    this.cache.save_deps(this.name, this.version, dependencies || {});

    var dir = this.extract_dir = node_path.join(this.dir, this.name, this.version);

    if ( fs.isDir(dir) ) {
        if ( this._saved_shasum() === this.shasum ) {
            this.skip();
        }
        
    } else {
        fs.mkdir(dir);
    }

    callback(null);
};


// Only download and extract a single module
// @param {Object} options
// - name: 
// - version:
// - dir: {path}
// - cache
// @param {function()} callback
Installer.prototype._download = function (callback) {
    var filename = get_filename(this.tarball);
    var filepath = node_path.join(this.extract_dir, filename);

    this.file = filepath;

    function cb () {
        // there should not be more than one `callback`
        if ( err ) {
            return;
        }

        callback.apply(null, arguments);
    }

    var err;
    var db = this.context.db;
    var tarball = this.tarball;
    var stream = 
        node_fs.createWriteStream(filepath)
        .on('close', cb)
        .on('error', cb);

    request
        .get(tarball)
        .on('complete', function (res) {
            var code = res.statusCode;

            // fake response event handler
            db.emit('response', {
                res: {
                    // if is not 200, `db.emit` will never be runned
                    statusCode: res.statusCode
                },
                req: {
                    safe_url: tarball,
                    method: 'GET'
                }
            });

            if ( code !== 200 ) {
                err = {
                    code: 'EGETTARBALL',
                    message: 'error fetching tarball "' + tarball + '", code: ' + code,
                    data: {
                        tarball: tarball,
                        statusCode: code
                    }
                };
                callback(err);
            }
        })
        .pipe(stream);
};


Installer.prototype._saved_shasum = function() {
    var file = this._shasum_file();

    return fs.exists(file) ?
        fs.read(file) :
        null;
};

Installer.prototype._save_shasum = function() {
    var file = this._shasum_file();
    fs.write(file, this.shasum);
};


Installer.prototype._shasum_file = function() {
    return node_path.join(this.extract_dir, 'shasum');
};


Installer.prototype._extract = function(callback) {
    var self = this;

    fstream.Reader({
        path: this.file,
        type: 'File'
    })
    .pipe(node_zlib.Unzip())
    .pipe(tar.Extract({
        path: this.extract_dir
    }))
    .on('end', function () {
        self._save_shasum();

        callback(null);
    })
    .on('error', callback);
};


function santitize_tarball_url(url){
    return url.replace(/\/registry\/_design\/[a-z]+\/_rewrite/i, '');
};


var REGEX_MATCH_FILENAME = /[^\/]+$/;

function get_filename(url){
    return url.match(REGEX_MATCH_FILENAME)[0];
};

