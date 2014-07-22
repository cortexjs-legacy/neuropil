'use strict';

var neuropil = require('../../');
var node_url = require('url');
var node_path = require('path');
var logger = require('./logger');

module.exports = neuropil({
    username: 'ntest',
    password: 'ntest',
    email: 'ntest@test.com',
    port: 5984,
    host: '127.0.0.1:5984',
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
