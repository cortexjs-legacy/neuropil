'use strict';

var assert = require('chai').assert;
var neuropil = require('./lib/neuropil')

var fs = require('fs-sync');
var node_path = require('path');

var pkg = fs.readJSON(node_path.join(__dirname, 'fixtures/package.json'));
var tar = node_path.join( __dirname, 'fixtures', 'fs-sync-0.1.6.tgz' );

////////////////////////////////////////////////////////////////////////////////////////////////////

describe('neuropil', function() {

  before(function(done) {
    neuropil.adduser({
      username: "ntest",
      password: "ntest",
      email: "ntest@test.com",
      signup: true
    }, function(err, res, json) {
      done(err)
    });
  });

  it('adduser', function(done) {
    neuropil.adduser({
      username: 'kael6',
      password: 'blah-blah-bie',
      email: 'i@kael.me',
      signup: false
    }, function(err, res, json) {
      console.log(json);
      if(err) return done(err);

      assert(json.ok);
      assert.equal(json.id, 'org.couchdb.user:kael6');
      done();
    });
  });

  it('publish && unpublish && exists', function(done) {
    neuropil.publish({
      tar: tar,
      pkg: pkg,
      force: true,
      enable_snapshot: true
    }, function(err, res, json) {
      console.log(json);
      if(err) return done(err);

      neuropil.exists({
        name: 'fs-sync',
        version: '0.1.8'
      }, function (err, data) {
        if(err) return done(err);
        assert(data.exists, "fs-sync@0.1.8 exists");
        
        neuropil.exists({
          name: "fs-sync",
          version: "0.1.2"
        }, function(err, data) {
          if(err) return done(err);
          assert(!data.exists, "fs-sync@0.1.2 does not exist");
          
          neuropil.unpublish({
            name: 'fs-sync',
            version: '0.1.8'
          }, function(err, res, json) {
            console.log(json);
            if(err) return done(err);
            done();
          });
        });
      });
    });
  });


});
