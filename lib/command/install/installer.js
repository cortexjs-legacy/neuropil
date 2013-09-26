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
    this.db = options.db;
    this.cache = options.cache;
    this.name = options.name;
    this._version = options.version;

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
    if(lang.is_explicit_version(this._version)){
        this._get_module_info_by_version(callback);
    }else{
        this._get_module_info_by_range(callback);
    }
};



Installer.prototype._get_module_info_by_range = function (callback) {
    var name = this.name;
    var range = this._version;
    var cache = this.cache;

    var self = this;

    this.db.get(this.db.escape(name), function (err, res, json) {
        if(err){
            return callback(err, json);
        }

        var versions = json.versions;
        var version = lang.get_matched_version(versions, range);

        if(!version){
            return callback({
                code: 'MODULE_NOT_FOUND',
                data: {
                    name: name,
                    version: range
                },
                message: 'No version of module "' + 
                    name + 
                    '" matched "' +
                    range +
                    '".',
                module: 'neuropil'
            });
        }

        var pkg = versions[version];

        // save the explicit version
        self.version = version;
        self.pkg = pkg;
        self.tarball = self._get_tarball(pkg);

        cache.save_range(name, range, version);
        cache.save_pkg(name, version, pkg);

        // When we install a module with the semver range, 
        // we should check if the explicit version of the module has already been installed.
        self._check_range();

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


// @param {string} version semver 
// @param {Object} options
// - name
// - version
Installer.prototype._get_module_info_by_version = function (callback) {
    var name = this.name;
    var version = this.version = this._version;
    var cache = this.cache;

    var self = this;

    this.db.get(this.db.escape(name) + '/' + version, function (err, res, json) {
        if(err){
            return callback(err, json);
        }

        var pkg = json;

        self.pkg = pkg;
        self.tarball = self._get_tarball(pkg);

        cache.save_pkg(name, version, pkg);

        callback(null);
    });
};


Installer.prototype.skip = function() {
    this._skipped = true;
    this.emit('skip', this.name, this._version);
};


Installer.prototype.is_skipped = function() {
    return !!this._skipped;
};


Installer.prototype._get_tarball = function (pkg) {
    return santitize_tarball_url(pkg.dist.tarball);
};


Installer.prototype._deal_dependencies = function(callback) {
    var dependencies = lang.object_member_by_namespaces(this.pkg, this.key);

    if ( dependencies ) {
        this.emit('dependencies', dependencies);
    }

    this.cache.save_deps(this.name, this.version, dependencies || {});

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
    var root = node_path.join(this.dir, this.name, this.version);

    if(!fs.isDir(root)){
        fs.mkdir(root);
    }

    var filename = get_filename(this.tarball);
    var filepath = node_path.join(root, filename);

    this.extract_dir = root;
    this.file = filepath;

    var stream = 
        node_fs.createWriteStream(filepath)
        .on('close', callback)
        .on('error', callback);

    request.get(this.tarball).pipe(stream);
};


Installer.prototype._extract = function(callback) {
    fstream.Reader({
        path: this.file,
        type: 'File'
    })
    .pipe(node_zlib.Unzip())
    .pipe(tar.Extract({
        path: this.extract_dir
    }))
    .on('end', function () {
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

