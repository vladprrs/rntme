const fs = require('fs');
const path = require('path');
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
const target = path.join(__dirname, '..', 'dist', 'util', 'version.js');
const src = fs.readFileSync(target, 'utf8');
fs.writeFileSync(target, src.replace('__CLI_VERSION__', pkg.version));
