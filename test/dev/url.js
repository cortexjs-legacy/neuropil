'use strict';

var node_url = require('url');

console.log( node_url.parse('http://user:pass@domain.com:1234/pathname?query=a&b=2#hash') );

// {
//     protocol: 'http:',
//     slashes: true,
//     auth: 'user:pass',
//     host: 'domain.com:1234',
//     port: '1234',
//     hostname: 'domain.com',
//     hash: '#hash',
//     search: '?query=a&b=2',
//     query: 'query=a&b=2',
//     pathname: '/pathname',
//     path: '/pathname?query=a&b=2',
//     href: 'http://user:pass@domain.com:1234/pathname?query=a&b=2#hash'
// }

console.log( node_url.format({
    protocol: 'http:',
    // slashes: true,
    auth: 'user:pass',
    // host: 'domain.com:1234',
    port: '1234',
    hostname: 'domain.com',
    hash: '#hash',
    // search: '?query=a&b=2',
    query: 'query=a&b=2',
    pathname: '/pathname',
    // path: '/pathname?query=a&b=2',
    // href: 'http://user:pass@domain.com:1234/pathname?query=a&b=2#hash'
}) )