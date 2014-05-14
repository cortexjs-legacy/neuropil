'use strict';

var queue = require('./queue');
var installer = require('./installer');
var cacher = require('./cacher');

// ## Methods:
// - _xxx: without cache
// - xxxx: with cache

// No argument overloading and fault tolerance
// @param {Object} options
// - dependency_key: {string} cortex.dependencies
// - dir: {path}
// - modules: {Array.<string>} ['a@0.0.1', 'b@0.0.2]
// - recursive: {boolean=true} 
// @param {function(err, cache)} callback
// @param {Object} cache, see code below
exports.run = function(options, callback) {
  var cache = cacher({

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

    // The object converted from `options.modules`
    // {
    //     'jquery': ['latest']
    // }
    origins: {},

    // All modules, including duplicate modules
    // {
    //     'jquery': ['latest', '1.9.2', '~1.9.2']
    // }   
    modules: {},

    // The hashmap of documents of all downloaded packages
    packages: {}
  });

  var q = queue(function(err) {
    if (err) {
      return callback(err);
    }

    var cached = cache.plain();

    callback(null, cached);
  });


  var self = this;
  options.modules.forEach(function(module) {
    var splitted = module.split('@');
    var name = splitted[0];
    var version = splitted[1];

    cache.save_origin(name, version);

    self.one(name, version, {
      key: options.dependency_key,
      dir: options.dir,

      cache: cache,
      queue: q,
      recursive: options.recursive
    });
  });
};


// Install a single module
exports.one = function(name, version, options) {
  // prevent duplicate installation
  if (options.cache.exists(name, version)) {
    return;
  }

  options.cache.save_module(name, version);

  var self = this;
  installer({
      name: name,
      version: version,

      context: self.context,
      cache: options.cache,
      key: options.key,
      dir: options.dir
    },
    // create a new item of installing queue
    options.queue.createHandle()
  )
    .on('dependencies', function(dependencies) {
      if (!options.recursive) {
        return;
      }

      var dep_name;

      for (dep_name in dependencies) {
        self.one(dep_name, dependencies[dep_name], options);
      }
    });
};