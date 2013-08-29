'use strict';

var install = module.exports = {};

var node_fs     = require('fs');
var node_path   = require('path');
var node_zlib   = require('zlib');

var lang        = require('../util/lang');
var fs          = require('fs-sync');
var semver      = require('semver');
var async       = require('async');
var request     = require('request');
var fstream     = require('fstream');
var tar         = require('tar');


// No argument overloading and fault tolerance
// @param {Object} options
// - dependency_key: {string} cortex.dependencies
// - dir: {path}
// - modules: {Array.<string>} ['a@0.0.1', 'b@0.0.2]
// @param {function(err, cache)} callback
// @param {Object} cache, see code below
install.run = function (options, callback) {
    var cache = {

        // @private
        // Will be deleted at last
        callbacks: {},

        // Map: { npm flavored ranges of semver -> explicit semver }
        // {
        //     'jquery': {
        //         'latest': '1.9.2'
        //     }
        // }
        ranges: {},

        // The dependencies (B+ tree) of all related modules (recursively)
        // {
        //     'jquery': {
        //         '1.9.2': {}
        //     }
        // }
        dependencies: {},

        // Data of package.json of all downloaded modules which only includes the 
        // certain version we have just fetched
        // {
        //     'jquery': {
        //         '1.9.2': {
        //             // blah-blah-blah
        //         }
        //     }
        // }
        packages: {},

        // The object converted from `options.modules`
        // {
        //     'jquery': ['latest']
        // }
        origins: {}
    };

    async.parallel(
        options.modules.map(function (module) {
            return function (done) {
                var splitted = module.split('@');
                var name = splitted[0];
                var version = splitted[1];

                install._cache_origin_modules(cache, name, version);

                install.install({
                    name: name,
                    version: version,
                    cache: cache,
                    dir: options.dir,
                    dependency_key: options.dependency_key

                }, done);
            };
        }),

        function (err) {
            if(err){
                return callback(err);
            }

            delete cache.callbacks;

            callback(null, cache);
        }
    );
};


// Only download and extract a single module
// @param {Object} options
// - name: 
// - version:
// - dir: {path}
// - cache
// @param {function()} callback
install.download = function (options, callback) {
    async.waterfall([

        // Get module information
        function (done) {
            var version_ = options.version;

            if(lang.is_explicit_version(version_)){
                // 获取tarball地址
                install.get_module_info_by_version(options, done);

            }else{
                install.get_module_info_by_range(options, done);
            }
        },

        // Download tarball
        function (data, done) {
            install._cache_package(options.cache, data.name, data.version, data.pkg);

            var root = node_path.join(options.dir, data.name, data.version);

            if(!fs.isDir(root)){
                fs.mkdir(root);
            }

            var filename = get_filename(data.tarball);
            var filepath = node_path.join(root, filename);

            // explode to `data`
            data.extract_dir = root;
            data.file = filepath;

            var stream = node_fs.createWriteStream(filepath);
            stream.on('close', function () {
                done(null, data);
            });

            request.get(data.tarball).pipe(stream);
        },

        // extract tarball
        function (data, done) {
            fstream.Reader({
                path: data.file,
                type: 'File'
            })
            .pipe(node_zlib.Unzip())
            .pipe(tar.Extract({
                path: data.extract_dir
            }))
            .on('end', function () {
                done(null, data);
            });
        }

    ], callback);
};


// Install a single module
// - download
// - extract
// - install dependencies

// @param {Object} options
// - cache: {Object}
// - name:
// - version:  
// - key: 
// - dir
install.install = function (options, callback) {
    var module = options.name + '@' + options.version;
    var callbacks = options.cache.callbacks;
    var module_callbacks = callbacks[module];

    if(!module_callbacks){
        module_callbacks = callbacks[module] = [];
        install._register_install(options, function (err, data) {
            var cbs = callbacks[module];

            callbacks[module] = {
                error: err,
                data: data
            };

            cbs.forEach(function (cb) {
                cb(err, data); 
            });

            cbs.length = 0;
        });
    }

    if( Array.isArray(module_callbacks) ){
        module_callbacks.push(callback);
    }else{
        callback(module_callbacks.error, module_callbacks.data);
    }
};


install._cache_package = function (cache, name, exact_version, pkg) {
    var packages = cache.packages;

    if(!packages[name]){
        packages[name] = {};
    }

    packages[name][exact_version] = pkg;
};


install._cache_dependencies = function (cache, name, exact_version, dependencies) {
    var deps = cache.dependencies;

    if(!deps[name]){
        deps[name] = {};
    }

    deps[name][exact_version] = dependencies;
};


install._cache_range = function (cache, name, range, exact_version) {
    var ranges = cache.ranges;

    if(!ranges[name]){
        ranges[name] = {};
    }

    ranges[name][range] = exact_version;
};


install._cache_origin_modules = function (cache, name, version) {
    var origins = cache.origins;

    if(!origins[name]){
        origins[name] = [];
    }

    origins[name].push(version);
};


// Parameters same as `install.install`
install._register_install = function (options, callback) {
    install.download(options, function (err, data) {
        if(err){
            return callback(err);
        }

        var dependencies = lang.object_member_by_namespaces(data.pkg, options.dependency_key, {});
        var parallel = [];

        install._cache_dependencies(options.cache, data.name, data.version, dependencies);

        lang.each(dependencies, function (name, version) {
            parallel.push(function (done) {
                install.install({
                    cache: options.cache,
                    name: name,
                    version: version,
                    dir: options.dir,
                    dependency_key: options.dependency_key
                }, done);
            });
        });

        async.parallel(parallel, function (err) {
            callback(err);
        });
    });
};


function santitize_tarball_url(url){
    return url.replace(/\/registry\/_design\/[a-z]+\/_rewrite/i, '');
};


var REGEX_MATCH_FILENAME = /[^\/]+$/;

function get_filename(url){
    return url.match(REGEX_MATCH_FILENAME)[0];
};


// @param {Object} options
// - name: {string}
// - range: {string} npm flavored semver range
install.get_module_info_by_range = function (options, callback) {
    var name = options.name;

    this.db.get(this.db.escape(options.name), function (err, res, json) {
        if(err){
            return callback(err, json);
        }

        if(json.error){
            return callback(json.reason);
        }

        var versions = json.versions;
        var matched_version = lang.get_matched_version(versions, options.version);

        if(!matched_version){
            return callback(
                'No version of module "' + 
                options.name + 
                '" matched "' +
                options.version +
                '".'  
            );
        }

        install._cache_range(options.cache, options.name, options.version, matched_version);

        var pkg = versions[matched_version];
        var tarball = pkg.dist.tarball;

        callback(null, {
            pkg: pkg,
            name: name,
            version: matched_version,
            tarball: santitize_tarball_url(tarball)
        });
    });
};


// @param {string} version semver 
// @param {Object} options
// - registry
install.get_module_info_by_version = function (options, callback) {
    var name = options.name;
    var version = options.version;

    this.db.get(this.db.escape(name) + '/' + version, function (err, res, json) {
        if(err){
            return callback(err, json);
        }

        if(json.error){
            return callback(json.reason || json.error);
        }

        callback(null, {
            pkg: json,
            name: name,
            version: version,
            tarball: santitize_tarball_url(json.dist.tarball)
        });
    });
};


