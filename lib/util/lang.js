v'use strict';

/**
 * copy all properties in the supplier to the receiver
 * @param r {Object} receiver
 * @param s {Object} supplier
 * @param or {boolean=} whether override the existing property in the receiver
 * @param cl {(Array.<string>)=} copy list, an array of selected properties
 */
exports.mix = function mix (r, s, or, cl) {
    if (!s || !r) return r;
    var i = 0, c, len;
    or = or || or === undefined;

    if (cl && (len = cl.length)) {
        for (; i < len; i++) {
            c = cl[i];
            if ( (c in s) && (or || !(c in r) ) ) {
                r[c] = s[c];
            }
        }
    } else {
        for (c in s) {
            if (or || !(c in r)) {
                r[c] = s[c];
            }
        }
    }
    return r;
};


exports.merge = function merge (receiver, supplier, override){
    var key;
    var origin;

    override = override || override === undefined;

    for(key in supplier){
        origin = receiver[key];

        if( Object(origin) === origin && supplier[key]){
            merge(origin, supplier[key], override);

        }else if( override || !(key in receiver) ){
            receiver[key] = supplier[key];
        }
    }

    return receiver;
};


exports.each = function(obj, callback) {
    var key;

    if(obj){
        for(key in obj){
            callback(key, obj[key]);
        }
    }
};