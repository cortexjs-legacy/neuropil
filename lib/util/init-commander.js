'use strict';

module.exports = function (commander, supplier) {
    ['logger', 'db', 'options'].forEach(function (key) {
        commander[key] = supplier[key];
    });
};