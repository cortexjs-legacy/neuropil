'use strict';

var attachment = module.exports = {};

var node_fs = require('fs');


// @param {Object} options
// - tar: {string} absolute path of tarball file
// - pkg: {string} package name
// - rev: {string} couchthis.db rev of the pkg document
// - name: {string} file name of couchthis.db attachment

// {
//     pkg: 'neuronjs',
//     name: 'neuronjs-2.0.1.tgz',
//     rev: '10-xxxxxxxxxxxxxxxx',
//     tar: '/blah'
// }
attachment.run = function (options, callback) {
    var path = '/' + options.pkg + '/-/' + this.db.escape(options.name) + '/-rev/' + options.rev;
    var self = this;

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

