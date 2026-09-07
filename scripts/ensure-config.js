/**
 * Seed local client/server config files from *-dist templates when missing.
 */
var fs = require('fs');
var path = require('path');

var root = path.resolve(__dirname, '..');

var copies = [
    {
        from: path.join(root, 'client', 'config', 'config_build.json-dist'),
        to: path.join(root, 'client', 'config', 'config_build.json'),
        contents: JSON.stringify({ host: 'localhost', port: 8000 }, null, 4) + '\n'
    },
    {
        from: path.join(root, 'client', 'config', 'config_local.json-dist'),
        to: path.join(root, 'client', 'config', 'config_local.json'),
        contents: JSON.stringify({ host: 'localhost', port: 8000, dispatcher: false }, null, 4) + '\n'
    },
    {
        from: path.join(root, 'server', 'config_local.json-dist'),
        to: path.join(root, 'server', 'config_local.json'),
        contents: null
    }
];

copies.forEach(function(item) {
    if (fs.existsSync(item.to)) {
        return;
    }

    var data = item.contents;
    if (data === null) {
        data = fs.readFileSync(item.from, 'utf8');
    }

    fs.writeFileSync(item.to, data, 'utf8');
    console.log('Created ' + path.relative(root, item.to));
});
