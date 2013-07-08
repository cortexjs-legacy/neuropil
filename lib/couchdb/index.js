'use strict';

module.exports = couchdb;

var request = require('request');
var querystring = require('querystring');

var lang = require('../util/lang');
var node_url = require('url');

function couchdb(options){
    return new CouchDB(options);
};

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

        return this.request(
            path, 
            lang.mix(options || {}, foreign_object), 
            callback
        );
    };
}

// select specific list of properties to mix
function select_mix(receiver, supplier, list) {
    list.forEach(function(key) {
        if(key in supplier){
            receiver[key] = supplier[key];
        }
    });
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

        select_mix(url_object, options, ['port']);

        // {
        //     username: 'abc',
        //     password: '123'
        // }
        // -> 'abc:123'
        if( Object(options.auth) === options.auth ){
            url_object.auth = options.auth.username + ':' + options.auth.password;
        
        }else if(options.auth){
            url_object.auth = options.auth;
        }

        this.url = url_object;
    },

    // @returns {Object}
    _createURL: function(path) {
        // clone 
        var url_object = lang.mix({}, this.url);
        url_object.pathname = node_url.resolve(url_object.pathname, path);

        return url_object;
    },

    escape: function(id) {
        return ~ ['_design', '_changes', '_temp_view'].indexOf( id.split('/')[0] ) ?
            id :
            querystring.escape(id);
    },

    // 
    request: function(path, options, callback) {
        var req_options = {
            url: this._createURL( this.escape(path) ),

            // default to `'GET'`
            method: 'GET',
            headers: {}
        };
        
        // TODO: more options?
        // headers: {Object}
        // json: {Object}
        // method: {string}
        select_mix(req_options, options, ['headers', 'json', 'method']);

        var headers = req_options.headers;

        headers.accept = "application/json";

        // return the `request` object so that we can pipe it
        return request(req_options, function(err, res, body) {
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
                    return callback(new Error('Error parsing json'), res, body);
                }
            }

            callback(err, res, json);
        });
    },

    put: define_method({
        method: 'PUT'
    }),

    get: define_method(),

    attachment: define_method({
        method: 'PUT',
        headers: {
            accept: 'application/json',
            'content-type': 'application/octet-stream'
        }
    })
});
