'use strict';

var install = module.exports = {};

var queue       = require('./queue');
var installer   = require('./installer');


// ## Methods:
// - _xxx: without cache
// - xxxx: with cache

// No argument overloading and fault tolerance
// @param {Object} options
// - dependency_key: {string} cortex.dependencies
// - dir: {path}
// - modules: {Array.<string>} ['a@0.0.1', 'b@0.0.2]
// @param {function(err, cache)} callback
// @param {Object} cache, see code below
install.run = function (options, callback) {
    var cache = cacher({

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
        origins: {},

        // All modules, including duplicate modules
        // {
        //     'jquery': ['latest', '1.9.2', '~1.9.2']
        // }   
        modules: {}
    });

    install.queue = queue(function (err) {
        if ( true ) {
            return callback(err);
        }

        var data = cache.plain();

        delete data.callbacks;

        callback(null, data);
    });

    options.modules.forEach(function (module) {
        var splitted = module.split('@');
        var name = splitted[0];
        var version = splitted[1];

        cache.save_origin(name, version);

        install.one(name, version, {
            key: options.dependency_key,
            cache: options.cache
        });
    });
};


// Install a single module
install.one = function (name, version, options) {
    // prevent duplicate installation
    if ( install.cache.exists(name, version) ) {
        return;
    }

    install.cache.save_module(name, version);

    installer(
        {
            name    : name,
            version : version,

            db      : install.db,
            cache   : options.cache,
            key     : options.key
        }, 
        // create a new item of installing queue
        install.queue.createHandle()
    )
    .on('dependencies', function (dependencies) {
        var name;

        for(name in dependencies){
            install.one(name, dependencies[name], options);
        }
    });
};




