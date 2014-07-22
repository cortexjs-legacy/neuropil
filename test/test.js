'use strict';

var assert = require('chai').assert;
var neuropil = require('./lib/neuropil')

var fs = require('fs-sync');
var node_path = require('path');

var pkg = fs.readJSON('/Users/Kael/Codes/Framework/neuropil/test/fixtures/package.json');
var tar = node_path.join( __dirname, 'fixtures', 'fs-sync-0.1.6.tgz' );

////////////////////////////////////////////////////////////////////////////////////////////////////

describe('neuropil', function() {

  it('publish', function(done) {
    neuropil.publish({
      tar: tar,
      pkg: pkg,
      force: true,
      enable_snapshot: true
    }, function(err, res, json) {
      console.log(err, json);
      done(err);
    });
  });


  it('adduser', function(done) {
    neuropil.adduser({
      username: 'kael6',
      password: 'blah-blah-bie',
      email: 'i@kael.me',
      signup: true

    }, function(err, res, json) {
      if(err) return done(err);

      assert(json.ok);
      assert.equal(json.id, 'org.couchdb.user:kael6');
      done();
    });
  });
});
