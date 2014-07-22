'use strict';

var assert = require('chai').assert;
var neuropil = require('./lib/neuropil')


describe('adduser', function() {
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
