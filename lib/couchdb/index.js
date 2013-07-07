'use strict';

module.exports = couchdb;

var request = require('request');
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
        lang.mix(options, foreign_object);

        return this.request(path, options, callback);
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
    //     // path: '/pathname?query=a&b=2',
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
        var url_object = node_url.parse(options.host);

        if(!url_object.protocol){
            url_object.protocol = 'http:'
        }

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
    _createURL: function(path, options) {
        // clone 
        var url_object = lang.mix({}, this.url);
        url_object.path = node_url.resolve(url_object.path, path);

        return url_object;
    },

    // 
    request: function(path, options, callback) {
        var req_options = {
            url: this._createURL(path, options)
        };
        
        // headers: {Object}
        // json: {Object}
        select_mix(req_options, options, ['headers', 'json']);

        // return the `request` object so that we can pipe it
        return request(req_options, callback);
    },

    put: define_method({
        method: 'PUT'
    }),

    attachment: define_method({
        method: 'PUT',
        headers: {
            accept: 'application/json',
            'content-type': 'application/octet-stream'
        }
    })
});
