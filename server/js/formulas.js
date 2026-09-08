
var Utils = require("./utils");

var Formulas = {};

Formulas.dmg = function(weaponLevel, armorLevel) {
    var w = Math.max(1, Number(weaponLevel) || 1),
        a = Math.max(1, Number(armorLevel) || 1),
        dealt = w * Utils.randomInt(5, 10),
        absorbed = a * Utils.randomInt(1, 3),
        dmg = dealt - absorbed;

    if(dmg <= 0) {
        return Utils.randomInt(0, 3);
    } else {
        return dmg;
    }
};

Formulas.hp = function(armorLevel) {
    var level = Math.max(1, Number(armorLevel) || 1);
    return 80 + ((level - 1) * 30);
};

if(!(typeof exports === 'undefined')) {
    module.exports = Formulas;
}