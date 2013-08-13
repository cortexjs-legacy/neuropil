'use strict';

var install = module.exports = {};

var lang        = require('../util/lang');
var fs          = require('fs-sync');
var semver      = require('semver');
var async       = require('async');
var request     = require('request');
var node_fs     = require('fs');
var node_path   = require('path');
var targz       = require('tar.gz');


// No argument overloading and fault tolerance
// @param {Object} options
// - key: {string} cortex.dependencies
// - dir: {path}
// - modules: {Array.<string>} ['a@0.0.1', 'b@0.0.2]
install.run = function (options, callback) {
    var cache = {
        callbacks: {}
    };

    async.parallel(
        options.modules.map(function (module) {
            return function (done) {
                var splitted = module.split('@');

                install.install({
                    name: splitted[0],
                    version: splitted[1] || 'latest',
                    cache: cache,
                    dir: options.dir,
                    key: options.key

                }, done);
            };
        }),

        function (err) {
            
        }
    );
};


// Only download and extract a single module
// @param {Object} options
// - name: 
// - version:
// - dir: {path}
// @param {function()} callback
install.download = function (options, calback) {
    async.waterfall([

        // Get module information
        function (done) {
            var version_ = options.version;

            if(install.is_explicit_version(version_)){
                // 获取tarball地址
                install.get_module_info_by_version(options, done);

            }else{
                install.get_module_info_by_range({
                    name: options.name,
                    range: version_

                }, done);
            }
        },

        // Download tarball
        function (data, done) {
            var root = node_path.join(options.dir, data.name, data.version);
            var filename = get_filename(data.tarball);
            var filepath = node_path.join(root, filename);

            var stream = fs.createWriteStream(filepath);

            stream.on('close', function () {
                done(null, {
                    pkg: data.pkg,
                    file: filepath,
                    extract_dir: root
                });
            });

            request.get(tarball).pipe(stream);
        },

        // extract tarball
        function (data, done) {
            new targz().extract(data.file, data.extract_dir, function (err) {
                if (err) {
                    return done(err);
                }

                done(null, data);
            });
        }

    ], callback);
};


// 'a.b', {a: {b: 1}} -> 1
// 'a.b', {a: 1}, false -> false
// 'a.b', undefined -> 'a.b'
function assign (namespaces, obj, default_value, maintain){
    if(arguments.length === 2){
        default_value = param;
    }

    // 'a.b' -> ['a', 'b'];
    var hierarchies = maintain ? [namespaces] : namespaces.split('.');
    var i = 0;
    var len = hierarchies.length;
    var key;
    var value = obj;

    for(; i < len; i ++){
        key = hierarchies[i];

        if( key in value ){
            value = value[key];
        }else{

            // 'a.b', {a: 1} -> 'a.b'
            return default_value;
        }
    }

    // 'a.b', {a: {b: 1}} -> 1
    return value;
}


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
        callbacks.push(module_callbacks);
    }else{
        callback(module_callbacks.error, module_callbacks.data);
    }
};


// Parameters same as `install.install`
install._register_install = function (options, callback) {
    install.donwload(options, function (err, data) {
        var dependencies = assign(data.pkg, options.key, {});
        var parallel = [];

        lang.each(dependencies, function (name, version) {
            parallel.push(function (done) {
                install.install({
                    cache: options.cache,
                    name: name,
                    version: version,
                    dir: options.dir,
                    key: options,key
                }, done)
            });
        });

        async.parallel(parallel, function (err) {
            callback(err);
        });
    });
};


install.is_explicit_version = function(version){
    return semver.valid(version);  
};


// Get the latest matched version
// @param {Object} versions
// {
//     '0.1.2': ...,
//     '0.2.3': ...
// }
// @param {string} pattern npm flavored sematic version
install.get_matched_version = function (versions, pattern) {

    // Ordered by version DESC 
    var choices = Object.keys(versions).sort(semver.rcompare);
    var matched = null;

    if(choices.length){
        if(pattern === 'latest'){
            matched = choices[0];
        }else{
            choices.some(function (version) {
                if( semver.satisfies(version, pattern) ){
                    matched = version;
                    return true;
                }
            }); 
        }
    }

    return matched;
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
            return callback(err, res, json);
        }

        var versions = json.versions;
        var matched_version = install.get_matched_version(versions, options.range);

        if(!matched_version){
            return callback(
                'No version of module "' + 
                options.name + 
                '" matched "' +
                options.range +
                '".'  
            );
        }

        var pkg = versions[matched_version];
        var tarball = pkg.dist.tarball;

        callback(null, res, {
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
            return callback(err, res, json);
        }

        callback(null, res, {
            pkg: json,
            name: name,
            version: version,
            tarball: santitize_tarball_url(json.dist.tarball)
        });
    });
};


