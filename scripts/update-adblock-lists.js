// Télécharge les listes anti-pubs à jour et les livre avec l'appli
// (le bloqueur marche ainsi dès le premier lancement, même hors ligne).
const fs = require('fs');
const path = require('path');
const { FiltersEngine } = require('@ghostery/adblocker');

const out = path.join(__dirname, '..', 'build', 'adblock-engine.bin');
FiltersEngine.fromPrebuiltAdsAndTracking(fetch)
  .then((engine) => {
    fs.writeFileSync(out, engine.serialize());
    console.log('Listes anti-pubs à jour :', fs.statSync(out).size, 'octets');
  })
  .catch((err) => {
    console.error('Impossible de télécharger les listes anti-pubs :', err.message);
    process.exit(1);
  });
