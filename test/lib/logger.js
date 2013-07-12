'use strict';

var loggie = require('loggie');

module.exports = loggie({
    level: 'info,warn,error',
    use_exit: false
});