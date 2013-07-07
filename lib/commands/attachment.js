'use strict';

// var doc = savedDoc // <some saved couchdb document which has an attachment>
// var id = doc._id
// var rev = doc._rev
// var idAndRevData = {
//   id: id,
//   rev: rev
// }
// var attachmentData = {
//   name: attachmentName               // something like 'foo.txt'
//   'Content-Type': attachmentMimeType // something like 'text/plain', 'application/pdf', etc.
//   body: rawAttachmentBody            // something like 'foo document body text'
// }
// var readStream = fs.createReadStream('/path/to/file/')
// var writeStream  = db.saveAttachment(idData, attachmentData, callbackFunction)
// readStream.pipe(writeStream)

module.exports = attachment;


var db = require('../db');
var node_fs = require('fs');
var logger = require('../logger');


// @param {Object} options
// - file: {string} absolute path of tarball file
// - pkg: {string} package name
// - rev: {string} couchdb rev of the pkg document
// - name: {string} file name of couchdb attachment

// {
//     pkg: 'neuronjs',
//     name: 'neuronjs-2.0.1.tgz',
//     rev: '10-xxxxxxxxxxxxxxxx',
//     file: '/blah'
// }
function attachment(options, callback) {
    var path = '/' + options.pkg + '/-/' + options.name + '/-rev/' + options.rev;

    var db_stream = db.put(path, {
        'content-type': 'application/octet-stream'

    }, callback);

    var file_stream = node_fs.createReadStream(options.file);

    db_stream.on('error', callback);

    logger.debug('{{cyan upload}}', options.file, path);
    file_stream.pipe(db_stream);
}

