// Télécharge les listes de sites dangereux (hameçonnage + logiciels malveillants)
// livrées avec l'appli. Elles sont ensuite remises à jour par le navigateur toutes les 12 h.
const fs = require('fs');
const path = require('path');

const LISTS = [
  [
    'https://malware-filter.gitlab.io/malware-filter/phishing-filter-domains.txt',
    'https://curbengh.github.io/malware-filter/phishing-filter-domains.txt',
    'https://malware-filter.pages.dev/phishing-filter-domains.txt'
  ],
  [
    'https://malware-filter.gitlab.io/malware-filter/urlhaus-filter-domains-online.txt',
    'https://curbengh.github.io/malware-filter/urlhaus-filter-domains-online.txt',
    'https://malware-filter.pages.dev/urlhaus-filter-domains-online.txt'
  ]
];

async function first(urls) {
  for (const u of urls) {
    try {
      const r = await fetch(u);
      if (r.ok) {
        const t = await r.text();
        if (t.split('\n').length > 50) { console.log('OK', u); return t; }
      }
    } catch (e) { console.log('échec', u, e.message); }
  }
  return '';
}

(async () => {
  const parts = [];
  for (const urls of LISTS) parts.push(await first(urls));
  const out = path.join(__dirname, '..', 'build', 'blocklist.txt');
  fs.writeFileSync(out, parts.join('\n'));
  const n = parts.join('\n').split('\n').filter((l) => l && !l.startsWith('#')).length;
  console.log(`Sites dangereux connus : ${n}`);
  if (n < 1000) {
    console.error('Listes de sites dangereux incomplètes');
    process.exit(1);
  }
})();
