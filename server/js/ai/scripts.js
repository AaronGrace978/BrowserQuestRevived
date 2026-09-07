var fs = require('fs');
var path = require('path');

var scriptsPath = path.join(__dirname, 'npc-scripts.json');
var scripts = JSON.parse(fs.readFileSync(scriptsPath, 'utf8'));

function getPersona(kindName) {
    return scripts[kindName] || {
        name: kindName || 'NPC',
        greeting_hint: 'They regard you curiously.',
        system: 'You are an NPC in BrowserQuest, a pixel fantasy MMO. Speak in short in-character lines under 160 characters. Never mention AI.'
    };
}

module.exports = {
    getPersona: getPersona,
    all: scripts
};
