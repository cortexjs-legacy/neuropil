'use strict';

module.exports = couchdb;

var request = require('request');
var querystring = require('querystring');

var lang = require('../util/lang');
var node_url = require('url');
var node_events = require('events');
var node_util = require('util');

function couchdb(options){
    return new CouchDB(options);
};

node_util.inherits(CouchDB, node_events.EventEmitter);


couchdb.CouchDB = CouchDB;

// host: 'registry.npm.lc',
// port: 80,
// auth: {
//     username: 'kael',
//     password: 'fLacus'
// },
// retries: 3,
// retryTimeout: 30 * 1000
function CouchDB(options){
    this.options = options;

    this._parseURL(options);
}


function define_method(foreign_object){
    return function(path, options, callback){
        if(arguments.length === 2 && typeof options === 'function'){
            callback = options;
            options = {};
        }

        // force overriding
        options = lang.merge(options, foreign_object);

        return this._request.call(this, path, options, callback);
    };
}


lang.mix(CouchDB.prototype, {

    // http://user:pass@domain.com:1234/pathname?query=a&b=2#hash
    // -> {
    //     protocol: 'http:',
    //     // slashes: true,
    //     auth: 'user:pass',
    //     // host: 'domain.com:1234',
    //     port: '1234',
    //     hostname: 'domain.com',
    //     hash: '#hash',
    //     // search: '?query=a&b=2',
    //     query: 'query=a&b=2',
    //     pathname: '/pathname',
    //     // path: '/pathname?query=a&b=2', // not used in format
    //     // href: 'http://user:pass@domain.com:1234/pathname?query=a&b=2#hash'
    // }

    // @param {Object} options
    // host: 'registry.npm.lc',
    // port: 80,
    // auth: {
    //     username: 'kael',
    //     password: 'fLacus'
    // },
    _parseURL: function(options) {
        var host = options.host;

        if( ! ~ options.host.indexOf('://') ){
            host = 'http://' + host;
        }

        var url_object = node_url.parse(host);

        if(options.port){
            url_object.port = options.port;
        }

        // {
        //     username: 'abc',
        //     password: '123'
        // }
        // -> 'abc:123'
        if( Object(options.auth) === options.auth ){
            url_object.auth = [options.auth.username, options.auth.password].filter(Boolean);
            url_object.auth = url_object.auth.length ?
                url_object.auth.join(':') : 
                null
        
        }else if(options.auth){
            url_object.auth = options.auth;
        }

        this.url = url_object;
    },

    // @returns {Object}
    resolve: function(path, auth) {
        // clone 
        var url_object = lang.mix({}, this.url);
        url_object.pathname = node_url.resolve(url_object.pathname, path);

        if(!auth){
            url_object.auth = null;
        }

        // format url, there's a bug of `request` if the url_object not formatted
        return url_object.format();
    },

    escape: function(id) {
        return ~ ['_design', '_changes', '_temp_view'].indexOf( id.split('/')[0] ) ?
            id :
            querystring.escape(id);
    },

    // no fault tolerance and arguments overloading
    _request: function(path, options, callback) {
        var safe_url = this.resolve(path);

        var req_options = {
            url: this.resolve(path, true),
            safe_url: safe_url,

            // default to `'GET'`
            method: 'GET',
            headers: {}
        };
        
        lang.mix(options, req_options, false);

        // force to json
        options.headers.accept = "application/json";

        var self = this;

        this.emit('request', options);
        // return the `request` object so that we can pipe it
        return request(options, function(err, res, body) {
            self.emit('response', {
                err : err,
                res : res,
                body: body,
                req : options
            });

            if(err){
                return callback(err, res, body);
            }

            var json;

            if (Buffer.isBuffer(body)) {
                body = body.toString();
            }

            if(Object(body) === body){
                json = body;
            }else{
                try{
                    json = JSON.parse(body);
                }catch(e){
                    return callback(new Error('Error parsing json: ' + body), res, body);
                }
            }

            callback(err, res, json);
        });
    },

    put: define_method({
        method: 'PUT'
    }),

    get: define_method(),

    del: define_method({
        method: 'DELETE'
    }),

    attachment: define_method({
        method: 'PUT',
        headers: {
            accept: 'application/json',
            'content-type': 'application/octet-stream'
        }
    })
});
