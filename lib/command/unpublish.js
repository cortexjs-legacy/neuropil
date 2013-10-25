'use strict';


var semver = require('semver');
var node_url = require('url');

// Neuropil will do nothing about checking '--force' option,
// and this command will just only unpublish them without comfirm

// @param {Object} options
// - name: {string} must specified
// - version: {string} semver or '*'. must specified
// - maintain_doc: {Boolean=} if true, neuropil will maintain package document even if there's no versions in it after removing specific versions 
exports.run = function (options, callback) {

    // never use `exports.context.db`
    if ( !this.context.db.hasAuth() ) {
        return callback({
            code: 'ENEEDAUTH',
            message: 'auth and email required for unpublishing',
            data: {
                method: 'unpublish'
            },
            module: 'neuropil'
        });
    }

    var name = options.name;
    var version = options.version;
    var self = this;

    this.context.db.get( this.context.db.escape(name), function(err, res, json) {
        if(err){
            if(err.error === 'not_found'){
                return callback({
                    code: 'ENOTFOUND',
                    message: 'Package "' + name + '" not unpublished. Reason: not found.',
                    data: {
                        name: name,
                        res: res,
                        json: json
                    },
                    module: 'neuropil'
                });

            }else{
                return callback(err, res, json);
            }
        }

        if(
            // to remove all
            version === '*' || 
            // There might be an error, the package has no versions and need to be eliminated
            !json.versions || Object.keys(json.versions).length === 0 ||
            // The only version
            !options.maintain_doc && (version in json.versions) && Object.keys(json.versions).length === 1
        ){
            self.context.emit('info', {
                code: 'IUNPUBLISHALL',
                message: 'all versions of "' + name + '"',
                data: {
                    label: 'unpublish',
                    name: name
                }
            });

            return self.all({
                name: options.name,
                rev: json._rev

            }, callback);
        }

        if( version in json.versions ){
            var module = name + '@' + version;

            self.context.emit('info', {
                code: 'IUNPUBLISH',
                message: module,
                data: {
                    label: 'unpublish',
                    name: name,
                    version: version
                }
            });

            return self.one({
                name: name,
                version: version,
                rev: json._rev,
                info: json

            }, callback);

        }else{
            return callback('Version "' + version + '" not found.', res, json);
        }
    });
}


// unpublish the entire package with all versions
// @param {Object} options
// - name
// - rev
exports.all = function(options, callback) {
    this.context.db.del( this.context.db.escape(options.name) + '/-rev/' + options.rev, callback);
};


// unpublish one version
// - info: {Object} package information
// - version: {string} semver
// - name
// - rev
exports.one = function(options, callback) {
    var info = options.info;
    var version = options.version;
    var versions = info.versions;
    var dist_tags = info['dist-tags'];
    var tarball = versions[version].dist.tarball;

    delete versions[version];
    
    delete info._revisions;
    delete info._attachments;

    var latest = dist_tags.latest;
    if(latest === version){
        Object.keys(dist_tags).forEach(function(tag) {
            if(dist_tags[tag] === version){
                delete dist_tags[tag];
            }
        });
    }

    if(latest === version){
        dist_tags.latest = Object.getOwnPropertyNames(versions).sort(semver.compare).pop();
    }

    var self = this;

    this.context.db.put( this.context.db.escape(options.name) + '/-rev/' + options.rev, {
        json: info

    }, function(err, res, json) {
        if(err){
            return callback(err, res, json);
        }

        self.detach({
            name: options.name,
            tarball: tarball

        }, callback);
    });
};


// detach an attachment
// @param {Object} options
// - tarball: {}
// - rev
exports.detach = function(options, callback) {
    var self = this;

    this.context.db.get( this.context.db.escape(options.name), function(err, res, json) {
        if(err){
            return callback(err, res, json);
        }

        var path = santitize_tarball(node_url.parse(options.tarball).pathname) + '/-rev/' + json._rev;

        self.context.db.del(path, callback);
    });
};


function santitize_tarball(tarball_pathname) {
    return tarball_pathname.replace(/^\/registry\/_design\/[a-z]+\/_rewrite/i, '');  
};

