'use strict';

module.exports = function (commander, supplier) {
    var new_commander = {};

    new_commander.context = supplier.context;

    // prevent pollution
    new_commander.__proto__ = commander;

    return new_commander;
};