'use strict';

module.exports = cacher;

cacher.Cacher = Cacher;

function cacher (container, options) {
    return new Cacher(container, options);
}


function Cacher (cache) {
    this._cache = cache;
};


// Returns the plain cache object
Cacher.prototype.plain = function() {
    return this._cache;
};


// Save the origin module
// @param {string} version the explicit version or range
Cacher.prototype.save_origin = function(name, version) {
    this._push('origins', name, version)
};


Cacher.prototype.save_range = function(name, range, version) {
    this._set('ranges', name, range, version);
};


// Cacher.prototype.save_pkg = function(name, version, pkg) {
//     this._set('packages', name, version, pkg);
// };


Cacher.prototype.save_deps = function(name, version, dependencies) {
    this._set('dependencies', name, version, dependencies);
};

Cacher.prototype.save_module = function(name, version) {
    this._push('modules', name, version);
};


// Cacher.prototype.get_range = function (name, range) {
//     return this._get('ranges', name, range); 
// };


// Cacher.prototype.get_pkg = function(name, version) {
//     version = this.get_range(name, version) || version;

//     return this._get('packages', name, version);
// };


Cacher.prototype.exists = function(name, version) {
    return ~ this._indexOf('modules', name, version);
};


// Set to 
// {
//     <name>: {
//         <key>: <value>
//     }
// }
Cacher.prototype._set = function(namespace, name, key, value) {
    var wrap = this._cache[namespace];

    if(!wrap[name]){
        wrap[name] = {};
    }

    wrap[name][key] = value;

    return this;
};


Cacher.prototype._get = function(namespace, name, key) {
    var wrap = this._cache[namespace];

    return wrap[name] && wrap[name][key] || null;
};


// Push to
// {
//     <name>: [
//         <key>
//     ]
// }
Cacher.prototype._push = function(namespace, name, key) {
    var wrap = this._cache[namespace];

    if ( !wrap[name] ) {
        wrap[name] = [];
    }

    if ( ! ~ wrap[name].indexOf(key) ) {
        wrap[name].push(key);
    }
};


Cacher.prototype._indexOf = function(namespace, name, key) {
    var wrap = this._cache[namespace];

    if ( !wrap[name] ) {
        return -1;
    }

    return wrap[name].indexOf(key);
};

