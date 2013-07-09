'use strict';

var fs = require('fs-sync');
var node_path = require('path');

var pkg = fs.readJSON('/Users/Kael/Codes/Framework/neuropil/test/fixtures/package.json');
var tar = node_path.join( __dirname, 'fixtures', 'fs-sync-0.1.6.tgz' );

////////////////////////////////////////////////////////////////////////////////////////////////////


'use strict';

var neuropil = require('./lib/neuropil')


neuropil.publish({
    tar: tar,
    pkg: pkg,
    force: false,
    enable_snapshot: true,
    registry: 'http://registry.npm.dp'

}, function(err, res, json) {
    console.log(err, json);

});

