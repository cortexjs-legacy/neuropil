'use strict';

module.exports = installer;
installer.Installer = Installer;

var async     = require('async');
var _         = require('underscore');
var request   = require('request');
var fstream   = require('fstream');
var tar       = require('tar');
var semver    = require('semver-extra');

var EE        = require('events').EventEmitter;
var node_util = require('util');
var node_path = require('path');
var node_url  = require('url');
var fs        = require('fs');
var fse       = require('fs-extra');
var node_zlib = require('zlib');
var cacher    = require('./cacher');

function installer(options, callback) {
  return new Installer(options, callback);
}


// @param {Object} options
// - name
// - version
// - db
// - cache
function Installer(options, callback) {
  this.cache = options.cache;
  this.name = options.name;
  this._version = options.version;
  this.context = options.context;
  this.doc = options.doc;
  this.key = options.key;
  this.dir = options.dir;
  this.prerelease = options.prerelease;
  this.stable = options.stable;
  this.save = options.save;
  this.callback = callback; 
}
node_util.inherits(Installer, EE);


Installer.prototype.init = function() {
  var methods = [
    '_get_module_info',
    '_deal_dependencies',
    '_download',
    '_extract'
  ];

  async.eachSeries(methods, function(method, done) {
    if (this.is_skipped()) {
      return done(null);
    }
    this[method](done);

  }.bind(this), this.callback);
};


// Get module information
// - resolve semver range
// - get tarball url
Installer.prototype._get_module_info = function(callback) {
  var name = this.name;
  var _version = this._version;
  var cache = this.cache;

  var versions = this.doc.versions;
  var is_explicit_version = !!semver.valid(_version);

  // # 1. install from dependencies
  // could occur in all situations

  // ## Case: the latest match is stable
  // - dependencies: a: '^1.3.0'
  // - prerelease: any!
  // - couch: 1.3.2, 1.3.2-beta
  // -> install a@1.3.2

  // ## Case: something is found
  // - dependencies: a: '^1.3.0'
  // - prerelease: alpha
  // - couch:
  //   // normal
  //   - 1.3.2-alpha, 1.3.2-beta -> install a@1.3.0-alpha
  //   // the stable version is newer
  //   - 1.3.3, 1.3.2-alpha -> install a@1.3.3
  //   // the pr version is newer
  //   - 1.3.3-alpha, 1.3.2 -> install a@1.3.3-alpha

  // ## Case 4: the specified pr is not found
  // - 1.3.0-alpha 1.3.0-rc
  // - dependencies: a: '^1.3.0'
  // - prerelease: beta
  // cortex install -> not found

  // # 2. install --save
  // Only available in dev

  // ## install range
  // - found stable -> ignore pr, install found
  // - only found prerelease -> refuse install pr, error
  // - nothing found -> error

  // ## recursive install --save -> install from dependencies

  // ## install version
  // - in versions: -> install
  // - or: error

  var version;
  if (is_explicit_version) {
    version = _version in versions
      // cortex install hippo@1.2.3-beta
      // -> 1.2.3-beta
      ? _version
      : null;

    return finish();
  }

  var range = _version === 'latest'
    // Legacy, there once were 'latest' ranges
    ? '*'
    : _version;

  var matched = Object.keys(versions).filter(function (version) {
    return semver.satisfies(version, range);
  });

  var stable_found = semver.maxStable(matched);
  var pr_found = semver.maxPrerelease(this.prerelease);
  var unstable_found = this.stable
    // on pro: do not get unstable version
    ? null
    // on dev: prerelease -> undefined -> get the max pr of any type
    // on alpha: prerelease -> 'alpha' -> only the the max alpha
    : pr_found

  if (!stable_found && !unstable_found) {
    // If `pr_found` exists, 
    if (pr_found) {
      this.context.emit(
        'warn', 
          '   neuropil runs in {{cyan stable-only}} mode,\n'
        + '   which means only stable versions are allowed to install.'
      );
    }

    // error
    return finish();
  }

  // stable win
  if (
    stable_found
    && (
      !unstable_found
      || semver.gt(stable_found, unstable_found)
    )
  ) {
    version = stable_found;
    return finish();
  }

  // else, unstable win

  // But we refuse to save an unstable version by default
  if (this.save) {
    var message = 
        'No {{bold STABLE}} version of package "' + name + '" matched "' + _version + '".\n'
      + '   Cortex Refuses to save an unstable version by default.\n'
      + '   For local development, try to run\n\n'
      + '      `{{bold cortex install ' + name + '@' + unstable_version + ' --save}}`\n\n'
      + '   to force an unstable version.'

    return callback({
      code: 'REFUSE_INSTALL_UNSTABLE',
      data: {
        name: name,
        version: _version
      },
      message: message,
      from: 'neuropil'
    });
  }

  version = unstable_found;
  finish();
  // END /////////////////////////////////////////////////////////////////////
  

  var self = this;
  function finish () {
    if (!version) {
      return callback({
        code: 'VERSION_NOT_FOUND',
        message: 'Package "' + name + '@' + _version + '" not found.',
        data: {
          name: name,
          version: _version
        },
        from: 'neuropil'
      });
    }

    var pkg = versions[version];

    // save the explicit version
    self.version = version;
    // the json of package info of the specific version
    self.pkg = pkg;
    self._deal_tarball(pkg);

    if (!is_explicit_version) {
      cache.save_range(name, _version, version);

      // When we install a module with the semver range, 
      // we should check if the explicit version of the module has already been installed.
      self._check_range();
    }

    callback(null);
  }
};


Installer.prototype._check_range = function() {
  // The current version has already been installed, prevent downloading that.
  if (this.cache.exists(this.name, this.version)) {
    this.skip();
  } else {
    this.cache.save_package(this.name, this.version);
  }
};


Installer.prototype.skip = function() {
  this._skipped = true;
  this.emit('skip', this.name, this._version);
};


Installer.prototype.is_skipped = function() {
  return !!this._skipped;
};


Installer.prototype._deal_tarball = function(pkg) {
  this.tarball = santitize_tarball_url(pkg.dist.tarball);
  this.shasum = pkg.dist.shasum;
};


Installer.prototype._deal_dependencies = function(callback) {
  var dependencies = this.pkg[this.key];

  if (dependencies) {
    this.emit('dependencies', dependencies);
  }

  this.cache.save_deps(this.name, this.version, dependencies || {});

  this.extract_dir = node_path.join(this.dir, this.name, this.version);

  var self = this;
  this._saved_shasum(function (err, shasum) {
    // ignores errors.
    if (!err && shasum.toString() === self.shasum) {
      self.skip();
    }

    callback(null);
  });
};


// Only download and extract a single module
// @param {Object} options
// - name: 
// - version:
// - dir: {path}
// - cache
// @param {function()} callback
Installer.prototype._download = function(callback) {
  var filename = get_filename(this.tarball);
  var filepath = node_path.join(this.extract_dir, filename);

  this.file = filepath;

  var dir = node_path.dirname(filepath);
  var self = this;
  fse.mkdirs(dir, function (err) {
    if (err) {
      return callback(err);
    }

    self._download_tarball(self.tarball, self.file, callback);
  });
};


Installer.prototype._download_tarball = function(tarball, filepath, callback) {
  var cb = _.once(callback);

  var stream =
    fs.createWriteStream(filepath)
    .on('close', cb)
    .on('error', cb);

  var db = this.context.db;

  tarball = this._clean_tarball_host(tarball);

  request
    .get(tarball, {
      proxy: this.context.proxy
    })
    .on('complete', function(res) {
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

      if (code !== 200) {
        return cb({
          code: 'EGETTARBALL',
          message: 'error fetching tarball "' + tarball + '", code: ' + code,
          data: {
            tarball: tarball,
            statusCode: code
          }
        });
      }
    })
    .pipe(stream);
};


Installer.prototype._clean_tarball_host = function(tarball) {
  var parsed = node_url.parse(tarball);
  var host = this.context.host;
  var port = this.context.port;

  port = Number(port) === 80
    ? null
    : String(port);

  if (!~host.indexOf('://')) {
    host = 'http://' + host;
  }
  host = node_url.parse(host).hostname;
  // 'abc.com/' -> 'abc.com'

  parsed.port = port;
  parsed.hostname = host;
  parsed.host = host + (
    port
      ? ':' + port
      : ''
  );

  return parsed.format();
};


Installer.prototype._saved_shasum = function(callback) {
  var file = this._shasum_file();
  fs.readFile(file, callback);
};


Installer.prototype._save_shasum = function(callback) {
  var file = this._shasum_file();
  fse.outputFile(file, this.shasum, callback);
};


Installer.prototype._shasum_file = function() {
  return node_path.join(this.extract_dir, 'shasum');
};


Installer.prototype._extract = function(callback) {
  var self = this;
  var extract_dir = this.extract_dir;
  var package_dir = node_path.join(extract_dir, 'package');

  function extract () {
    fstream.Reader({
      path: self.file,
      type: 'File'
    })
    .pipe(node_zlib.Unzip())
    .pipe(tar.Extract({
      path: extract_dir
    }))
    .on('end', function() {
      self._save_shasum(callback);
    })
    .on('error', callback);
  }

  // #56
  // Removes current existing `package_dir` if exists.
  // If user delete some files from a package, and publish --force, 
  // we must remove the `package_dir`, or the files could not be actually "deleted"
  fs.exists(package_dir, function (exists) {
    if (!exists) {
      return extract();
    }

    fse.remove(package_dir, function (err) {
      if (err && err.code !== 'ENOENT') {
        return callback(err);
      }

      extract();
    });
  });
};


function santitize_tarball_url(url) {
  return url.replace(/\/registry\/_design\/[a-z]+\/_rewrite/i, '');
};


var REGEX_MATCH_FILENAME = /[^\/]+$/;

function get_filename(url) {
  return url.match(REGEX_MATCH_FILENAME)[0];
};
