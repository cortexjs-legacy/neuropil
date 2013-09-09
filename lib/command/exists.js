'use strict';


var lang = require('../util/lang');


// @param {Object} options
// - name
// - version
exports.run = function (options, callback) {
    this.db.get(this.db.escape(options.name), function (err, res, json) {
        if(err){
            if(err.error === 'not_found'){
                return callback(null, {
                    exists: false
                });

            }else{
                return callback(err);
            }
        }

        var version = options.version;
        var versions = json.versions;

        if(!version){
            return callback(null, {
                exists: true
            });
        }


        if(lang.is_explicit_version(version)){
            callback(null, {
                exists: version in versions
            });
        
        }else{
            version = lang.get_matched_version(versions, version);

            callback(null, {
                exists: !!version
            });
        }
    });
};