// Corrige electron-chrome-extensions pour que les pop-ups d'extension se comportent comme dans Chrome.
// Exécuté automatiquement après « npm install » / « npm ci ».
//
// Problème : le pop-up est créé puis forcé à 25×25 px juste après le chargement. Les extensions qui
// s'adaptent à la taille de leur fenêtre (ex. Proton Pass) mesurent alors 25 px et restent minuscules.
// Correctif : taille de départ réaliste (600×430) et plus de réduction forcée à 25×25 ; la fenêtre s'ajuste
// ensuite au contenu, comme Chrome (la hauteur est réduite si le contenu est plus petit, sans toucher la largeur).
const fs = require('fs');
const path = require('path');

const files = ['dist/cjs/index.js', 'dist/esm/index.mjs']
  .map((f) => path.join(__dirname, '..', 'node_modules', 'electron-chrome-extensions', f))
  .filter((f) => fs.existsSync(f));

const MARK = '/* maxou-popup-fix */';
// Hauteur réelle du contenu (mode standard : la page ; mode « quirks » : le contenu du body)
const MEASURE = `(() => { const d = document; if (d.compatMode === 'CSS1Compat') return Math.ceil(d.documentElement.getBoundingClientRect().height);
  if (!d.body) return 0; const r = d.createRange(); r.selectNodeContents(d.body); const cs = getComputedStyle(d.body);
  return Math.ceil(r.getBoundingClientRect().bottom + parseFloat(cs.paddingBottom || 0) + parseFloat(cs.marginBottom || 0)); })()`;
let patched = 0;

for (const file of files) {
  let s = fs.readFileSync(file, 'utf8');
  if (s.includes(MARK)) { patched++; continue; }

  const a = /(new [\w$.]*BrowserWindow\d*\(\{\s*show: false,\s*frame: false,)/;
  const b = /if \(this\.usingPreferredSize\) \{\s*this\.setSize\(\{ width: _PopupView\.BOUNDS\.minWidth, height: _PopupView\.BOUNDS\.minHeight \}\);\s*\}/;
  if (!a.test(s) || !b.test(s)) {
    console.error(`patch-deps : motif introuvable dans ${file} (version d'electron-chrome-extensions changée ?)`);
    process.exit(1);
  }
  s = s.replace(a, `$1 ${MARK} width: 600, height: 430,`);
  const fit = 'const fit = async () => { try { if (this.destroyed || !this.browserWindow || this.browserWindow.isDestroyed()) return; ' +
    "const h = await this.browserWindow.webContents.executeJavaScript(" + JSON.stringify(MEASURE) + "); " +
    'const bb = this.browserWindow.getBounds(); if (h > 0 && h < bb.height) { this.setSize({ width: bb.width, height: h }); this.updatePosition(); } } catch {} }; ' +
    'setTimeout(fit, 300); setTimeout(fit, 1200);';
  s = s.replace(b, `if (this.usingPreferredSize) { ${MARK} ${fit} }`);
  fs.writeFileSync(file, s);
  patched++;
}

if (!patched) { console.error('patch-deps : electron-chrome-extensions introuvable'); process.exit(1); }
console.log(`patch-deps : pop-ups d'extension corrigés (${patched} fichier(s))`);
