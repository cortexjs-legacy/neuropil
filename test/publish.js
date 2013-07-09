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



// http://registry.npm.lc/fs-sync/0.1.7/-tag/latest

// { 
//     name: 'loggie',
//     version: '0.1.7',
//     description: 'An easy-to-use but powerful node.js command-line logger',
//     main: 'index.js',
//     scripts: { test: 'echo "Error: no test specified" && exit 1' },
//     repository: { type: 'git', url: 'git://github.com/kaelzhang/loggie.git' },
//     author: { name: 'kael' },
//     license: 'BSD',
//     bugs: { url: 'https://github.com/kaelzhang/loggie/issues' },
//     keywords:
//     [ 'console',
//      'warn',
//      'verbose',
//      'error',
//      'log',
//      'logger',
//      'log file',
//      'command-line',
//      'cli' ],
//     readme: '# Loggie\n\nLoggie is a lovely logger for node.js which is **SMART**, **SMALL**, and **EASY-TO-USE**.\n\nLoggie has few options, which makes it work at your will.\n\n\n## Installation\n\n```bash\nnpm install loggie --save\n```\n\t\n## Usage\n\n```js\nvar loggie = require(\'loggie\');\nlogger = loggie({\n\tlevel: \'log,error,warn\' \n});\n\nlogger.debug(\'blah-blah\'); // will do nothing, \'coz `\'debug\'` is not in `options.level`\nlogger.log(\'{{cyan install}}\', \'loggie\'); // will print a cyan \'install\', space, and \'loggie\'.\n```\n\nYou could use [typo](https://github.com/kaelzhang/typo) template here to format your output.\n\n### loggie(options)\nWill create a new loggie instance\n\n##### options.level\n`Array.<String>|String`\n\n`options.level` is just the loggie methods you want to activate. For example:\n\n```js\nvar logger = loggie({\n\tlevel: [\'info\', \'error\'] // can also be \'info,error\'\n});\n```\n\nThen, `logger.warn(\'blah-blah\')` will be deactivated and do nothing.\n\nIf set to `\'*\'`, Loggie will enable all log methods.\n\n\n##### options.use_exit\n`Boolean=`\n\nDefault to `true`\n\nIf set to `true`, Loggie will detect `\'exit\'` event of process, if process exited without `logger.end()` method, it will be considered as a failure.\n\n### Best practices\n\n```js\nvar logger = loggie({\n\tlevel: process.env[\'MY_LOG_LEVEL\'] || \n\t\n\t\t// log level for production\n\t\t\'info, error, warn\'\n});\n```\nAnd your environment variables (maybe on Mac OS) could be:\n\n```bash\n# file: ~/.profile\nexport MY_LOG_LEVEL=debug,info,error,warn\n```\n\nSo, you can use local settings for debugging and development, and will never worry about the possible forgetness of changing debug configurations to production.\n\n\n## Define custom log methods\n\n```js\nlogger.register({\n\tdetail: {\n\t\ttemplate: \'{{cyan Detail}} {{arguments}}\', // \n\t\targv: \'--detail\'\n\t}\n});\n```\nThen, we defined a log method `logger.detail()`:\n\n```js\nlogger.detail(\'a\'); // might print a cyan \'detail\', a whitespace, and an \'a\'\n```\n\nBy default, `logger.detail()` will do nothing because it is not in the log level list(`options.level`), but it will be activated if your app is started with \'--detail\' argument.\n\nYou can also use `logger.addLevel(\'detail\')` to add `\'detail\'` to level list.\n\n\n### .register(methods)\n\n### .register(name, setting)\n\nDefine your own log method. You can also use this method to override existing log methods.\n\n##### name\n`String`\n\nThe name of the log method you want. If you `register()` with `name = \'verbose\'`, there will be a `logger.verbose()` method.\n\n\n##### setting.template\n`String`\n\nA [typo](https://github.com/kaelzhang/typo) syntax template.\n\nThere are several built-in template parameters to be used:\n\n`\'arguments\'`: arguments joined by a single whitespace (`\' \'`)\n\n`number`: such as `\'0\'`, the argument at index `0`\n\nIf you use the template, all arguments will be stringified\n\n\n#### Example\n\n```js\nlogger.register(\'verbose\', {\n\ttemplate: \'{{gray verbose}} {{0}} {{arguments}}\'\n});\nlogger.verbose(\'mylabel\', \'blah\', new Error(\'error:blah-blah\'));\n```\n\nWill print: verbose(gray) mylabel mylabel blah error:blah-blah\n\n\n##### setting.fn\n`function()`\n\nThe log method.\n\nNotice that if `setting.template` is defined, \t`setting.fn` will be overridden.\n\n\n### Built-in log methods\n\nMethod  | Enabled By default | Binded Argv | Leading String\n------- | ------------------ | ----------- | -------------------\nverbose | no                 | --verbose   | `\'verbose \'` in gray\ndebug   | no                 | --debug     | `\'[D] \'` in magenta\nerror   | yes                |             | bold `\'ERROR \'` in red\nwarn    | yes                |             | `\'WARN \'` in yellow\nlog     | yes                |             | (nothing)\n\n',
//     readmeFilename: 'README.md',
//     _id: 'loggie@0.1.7',
//     dist:
//     { shasum: '1132ad0d2c33f94d84ea08370410066671d87783',
//      tarball: 'http://registry.npmjs.org/loggie/-/loggie-0.1.7.tgz' },
//     _from: '.',
//     _npmVersion: '1.2.21',
//     _npmUser: { name: 'kael', email: 'i@kael.me' } 
// }