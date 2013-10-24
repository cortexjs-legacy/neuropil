'use strict';

module.exports  = storage;
storage.Storage = Storage;

var node_path   = require('path');
var node_fs     = require('fs');

var lang        = require('../../util/lang');

function storage (options) {
    return new Storage(options || {});
}

function Storage (options) {
    this.dir = options.dir;
    this._data_get = {};
    this._data_to_save = {};
};


Storage.prototype.get_pkg = function(name) {
    var pkg = this._data_get[name];

    if ( pkg ) {
        return pkg;
    }

    var file = this._get_cache_file();
    pkg = this._read_json(file);
    this._data_get[name] = pkg;

    return pkg;
};


Storage.prototype.get_version = function(name, version) {
    var pkg = this.get_pkg(name);
    var versions = pkg.versions || {};

    return versions[version] || {};
};


Storage.prototype.set_pkg = function(name, pkg) {
    var saved = this._data_to_save[name] || this.get_pkg(name);
    var saved_versions = saved.versions;
    var versions = pkg.versions;

    if ( saved_versions && versions) {
        lang.each(versions, function (sub_pkg, version) {
            if ( !sub_pkg.etag ) {
                var saved_sub_pkg = saved_versions[version] || {};
                sub_pkg.etag = saved_sub_pkg.etag;
            }
        });
    }

    this._data_to_save[name] = pkg;
};


Storage.prototype.set_version = function (name, version, sub_pkg) {
    var pkg = this.get_pkg(name);

    var versions = pkg.versions || (pkg.versions = {});
    versions[version] = sub_pkg;

    this.set_pkg(name, pkg);
};


// save cache data to local hardware
// @returns {Object} saved map
Storage.prototype.save = function() {
    var self = this;

    // save the cache
    lang.each(this._data, function (pkg, name) {
        var file = self._get_cache_file(name);

        node_fs.writeFileSync(file, JSON.stringify(pkg));
    });

    // return all related value
    return lang.mix(this._data_to_save, this._data_get, false);
};


String.prototype._get_cache_file = function(name) {
    return node_path.join(this.dir, name, 'document.json');
};


Storage.prototype._read_json = function(file) {
    var json;

    if ( node_fs.existsSync(file) ) {
        try {
            var content = node_fs.readFileSync(file);
            json = JSON.parse(content);

        } catch(e) {
            
        }
    }

    return json || {};
};

