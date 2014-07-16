'use strict';

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

      console.log(err, json);
    });
  });
});
