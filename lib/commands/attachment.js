'use strict';

module.exports = attachment;

var node_fs = require('fs');


// @param {Object} options
// - tar: {string} absolute path of tarball file
// - pkg: {string} package name
// - rev: {string} couchdb rev of the pkg document
// - name: {string} file name of couchdb attachment

// {
//     pkg: 'neuronjs',
//     name: 'neuronjs-2.0.1.tgz',
//     rev: '10-xxxxxxxxxxxxxxxx',
//     tar: '/blah'
// }
function attachment(options, callback, logger, db) {
    var path = '/' + options.pkg + '/-/' + db.escape(options.name) + '/-rev/' + options.rev;

    var db_stream = db.put(path, callback);

    var file_stream = node_fs.createReadStream(options.tar);

    db_stream.on('error', callback);

    logger.debug('upload', options.tar, path);
    file_stream.pipe(db_stream);
}

