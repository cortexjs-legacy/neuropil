'use strict';

var neuropil = module.exports = function(options) {
    return new Neuropil(options); 
};

var util = require('util');
var events = require('events');




// @param {Object} options
// - auth: {Object}
//      - username:
//      - password
//
function Neuropil(options) {
    this.options = options;

    if(options.logger){
        this.logger = options.logger;
    }

    this.logger = this.logger.bind(this);
};

util.inherits(Neuropil, events.EventEmitter);

