'use strict';

var queue = require('./queue');
var installer = require('./installer');
var cacher = require('./cacher');
var EventEmitter = require('events').EventEmitter;

// ## Methods:
// - _xxx: without cache
// - xxxx: with cache

// No argument overloading and fault tolerance
// @param {Object} options
// - dependency_key: {string} cortex.dependencies
// - dir: {path}
// - packages: {Array.<string>} ['a@0.0.1', 'b@0.0.2]
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

    // All modules, including duplicate packages
    // {
    //     'jquery': ['latest', '1.9.2', '~1.9.2']
    // }   
    packages: {},

    // The hashmap of documents of all downloaded packages
    documents: {}
  });

  var q = queue(function(err) {
    if (err) {
      return callback(err);
    }

    var cached = cache.plain();
    callback(null, cached);
  });


  var self = this;
  var documents = {};
  var emitter = new EventEmitter();
  options.packages.forEach(function(module) {
    var splitted = module.split('@');
    var name = splitted[0];
    var version = splitted[1];

    cache.save_origin(name, version);

    self.one(name, version, {
      key: options.dependency_key,
      dir: options.dir,
      cache: cache,
      queue: q,
      recursive: options.recursive,
      emitter: emitter,
      documents: documents,
      save: options.save,
      stable: options.stable

    // If stable only, or save a dependency, we will force to stable version
    }, options.stable || options.save);
  });
};


// Install a single package
// @param {Boolean} entry If entry, neuropil will check stable versions
exports.one = function(name, version, options, force_stable) {
  // prevent duplicate installation
  if (options.cache.exists(name, version)) {
    return;
  }
  options.cache.save_package(name, version);

  // create a new item of installing queue
  var callback = options.queue.createHandle();
  var self = this;
  this.package_document(name, options, function (err, json) {
    if (err) {
      return callback(err);
    }

    installer({
      name: name,
      version: version,
      // `Object` Passby neuropil context to installer
      context: self.context,
      // `Object` Cache to prevent duplication
      cache: options.cache,
      // `String` Dependency key, 'dependencies'
      key: options.key,
      // `Path` Root dir where we should download packages to
      dir: options.dir,
      // `Object` Couchdb document of the package
      doc: json,
      // `String` Restrict ranges within a specific prerelease
      prerelease: options.prerelease,
      // `Boolean` Stable needs special treatment
      stable: force_stable,
      // `Boolean`
      save: options.save
    }, callback)
    .on('dependencies', function(dependencies) {
      if (!options.recursive) {
        return;
      }
      var dep_name;
      for (dep_name in dependencies) {
        self.one(
          dep_name, dependencies[dep_name], options, 

          // If `options.recursive_stable === true`,
          // we will force stable version for installing recursively
          options.stable
        );
      }
    })
    .init();
  });
};


// Gets package document
exports.package_document = function (name, options, callback) {
  var doc = options.documents[name];
  if (doc) {
    return callback(doc.error, doc.json);
  }

  var count = EventEmitter.listenerCount(options.emitter, name);
  options.emitter.once(name, callback);

  if (count !== 0) {
    return;
  }

  this.context.get(this.context.db.escape(name), function(err, res, json) {
    if (err && err.error === 'not_found') {
      err = {
        code: 'EPKGNOTFOUND',
        message: 'Package "' + name + '" is not found in the registry.',
        data: {
          name: name,
          error: err
        }
      };
    }

    options.documents[name] = {
      error: err,
      json: json
    };

    if (!err) {
      options.cache.save_document(name, json);
    }

    options.emitter.emit(name, err, json);
  });
};
