'use strict';

var neuropil = require('../../');
var node_url = require('url');
var node_path = require('path');
var logger = require('./logger');

module.exports = neuropil({
    username: 'kael2dd',
    password: 'blah-blah-biedd',
    email: 'i@kael.me',

    port: 80,
    host: '127.0.0.1:5984',
    cacheMapper: function (options, callback) {
      // no cache by default
      var url = node_url.parse(options.url || options.uri);
      var filepath = [
        '.node_modified', 
        url.protocol && url.protocol.replace(/:$/, '') || 'unknown',
        // 'user:pass' -> 'user%3Apass'
        url.auth,
        url.hostname,
        url.port,
        url.pathname,
        url.query
      ]
        .filter(Boolean)
        .map(encodeURIComponent)
        .join(node_path.sep);
      var USER_HOME   = process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
      var file = node_path.join(USER_HOME, filepath);
      console.log(USER_HOME, filepath,  file, node_path.dirname(file));
      callback(null, node_path.join(USER_HOME, filepath) );
    }
}).on('request', function(e) {
    logger.info(
        'CTX', 
        logger.template('{{magenta method}} {{url}}', {
            url     : e.safe_url,
            method  : e.method
        }) 
    );

    e.json && logger.debug('json', e.json);

}).on('response', function(e){
    logger.info(
        'CTX',
        e.err ? '{{red ' + (e.res.statusCode || 'ERR') + '}}' : '{{green ' + (e.res.statusCode || 'OK!') + '}}',
        e.req.safe_url
    );

    logger.debug(
        '{{magenta ' + e.req.method + '}}',
        node_url.parse(e.req.safe_url).pathname,
        e.err,
        e.body
    );
});
