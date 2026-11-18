// Crée dist/latest.json : le fichier que le navigateur lit pour savoir
// quelle version installer et vérifier que le téléchargement est intact.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const version = require('../package.json').version;
const file = `Maxous-Nav-Installation-${version}.exe`;
const full = path.join(__dirname, '..', 'dist', file);
const data = fs.readFileSync(full);
const latest = {
  version,
  file,
  sha256: crypto.createHash('sha256').update(data).digest('hex'),
  size: data.length
};
fs.writeFileSync(path.join(__dirname, '..', 'dist', 'latest.json'), JSON.stringify(latest, null, 2));
console.log(latest);
