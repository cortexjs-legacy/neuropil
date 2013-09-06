'use strict';

var attachment = module.exports = {};

var node_fs = require('fs');


// @param {Object} options
// - tar: {string} absolute path of tarball file
// - name: {string} package name
// - rev: {string} couchdb rev of the pkg document
// - filename: {string} file name of couchthis.db attachment

// {
//     name: 'neuronjs',
//     filename: 'neuronjs-2.0.1.tgz',
//     rev: '10-xxxxxxxxxxxxxxxx',
//     tar: '/blah/xxx.tgz'
// }
attachment.run = function (options, callback) {
    var path = '/' + options.name + '/-/' + this.db.escape(options.filename) + '/-rev/' + options.rev;
    var self = this;

    // Nginx configurations may require 'content-length' headers
    node_fs.stat(options.tar, function (err, stat) {
        if(err){
            return callback(err);
        }

        var db_stream = self.db.attachment(path, {
            headers: {
                'content-length': stat.size
            }

        }, callback);

        var file_stream = node_fs.createReadStream(options.tar);

        db_stream.on('error', callback);

        file_stream.pipe(db_stream);
    });
}

