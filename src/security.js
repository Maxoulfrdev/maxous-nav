// Maxou's Nav — protections de navigation
//  • Sites dangereux (hameçonnage / logiciels malveillants) bloqués avant chargement
//  • HTTPS forcé avec repli contrôlé (comme le mode « HTTPS-First » de Chrome)
//  • Applications externes (mailto:, zoommtg:…) ouvertes seulement après confirmation
//  • Connexion Google : identité Firefox sur accounts.google.com uniquement
const { app, net, shell, dialog, webContents } = require('electron');
const path = require('path');
const fs = require('fs');

const LISTS = {
  phishing: [
    'https://malware-filter.gitlab.io/malware-filter/phishing-filter-domains.txt',
    'https://curbengh.github.io/malware-filter/phishing-filter-domains.txt',
    'https://malware-filter.pages.dev/phishing-filter-domains.txt'
  ],
  malware: [
    'https://malware-filter.gitlab.io/malware-filter/urlhaus-filter-domains-online.txt',
    'https://curbengh.github.io/malware-filter/urlhaus-filter-domains-online.txt',
    'https://malware-filter.pages.dev/urlhaus-filter-domains-online.txt'
  ]
};
const REFRESH_EVERY = 12 * 3600 * 1000;

// Schémas que les pages peuvent ouvrir directement
const WEB_SCHEMES = new Set(['http:', 'https:', 'about:', 'data:', 'blob:', 'file:', 'chrome-extension:', 'devtools:', 'view-source:']);
// Applications externes proposées (après confirmation)
const EXTERNAL_OK = /^(mailto|tel|sms|callto|skype|zoommtg|zoomus|msteams|slack|discord|spotify|steam|com\.epicgames\.launcher|roblox|roblox-player|ms-[a-z-]+|vscode|magnet|webcal|itms-apps|whatsapp|tg|facetime|maps|geo):/i;

let ctx = null; // { getSettings, saveSettings, toUI, isHost }
const blocked = new Set();
const allowDanger = new Set(); // hôtes autorisés par l'utilisateur (session en cours)
const allowHttp = new Set();
const upgrades = new Map(); // webContents.id → URL http d'origine en cours de passage en https

// ---------- Listes de sites dangereux ----------
function parseList(text) {
  const out = [];
  for (let line of text.split(/\r?\n/)) {
    line = line.trim().toLowerCase();
    if (!line || line.startsWith('#') || line.startsWith('!')) continue;
    if (/^[a-z0-9.-]+$|^[0-9a-f:.]+$/.test(line)) out.push(line.replace(/\.$/, ''));
  }
  return out;
}

function listFile() { return path.join(app.getPath('userData'), 'blocklist.txt'); }
function bundledListFile() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'blocklist.txt')
    : path.join(__dirname, '..', 'build', 'blocklist.txt');
}

function loadListFrom(file) {
  try {
    const items = parseList(fs.readFileSync(file, 'utf8'));
    if (items.length < 50) return false; // fichier vide ou abîmé : on l'ignore
    blocked.clear();
    for (const d of items) blocked.add(d);
    return true;
  } catch { return false; }
}

async function fetchFirst(urls) {
  for (const u of urls) {
    try {
      const r = await net.fetch(u, { cache: 'no-store' });
      if (r.ok) {
        const t = await r.text();
        if (parseList(t).length > 50) return t;
      }
    } catch {}
  }
  return null;
}

async function refreshLists() {
  const [a, b] = await Promise.all([fetchFirst(LISTS.phishing), fetchFirst(LISTS.malware)]);
  if (!a && !b) return false;
  const merged = [a || '', b || ''].join('\n');
  try { fs.writeFileSync(listFile(), merged); } catch {}
  return loadListFrom(listFile());
}

function initLists() {
  let fresh = false;
  try { fresh = Date.now() - fs.statSync(listFile()).mtimeMs < REFRESH_EVERY; } catch {}
  if (!loadListFrom(listFile())) loadListFrom(bundledListFile());
  if (!fresh) refreshLists();
  setInterval(refreshLists, REFRESH_EVERY);
}

function hostOf(url) {
  try { return new URL(url).hostname.toLowerCase().replace(/^\[|\]$/g, ''); } catch { return ''; }
}

function isDangerous(url) {
  if (!ctx.getSettings().safeBrowsing) return false;
  if (!/^https?:/i.test(url)) return false;
  let h = hostOf(url);
  if (!h || allowDanger.has(h)) return false;
  // vérifie l'hôte et ses domaines parents (a.b.exemple.com → b.exemple.com → exemple.com)
  for (;;) {
    if (blocked.has(h)) return true;
    const i = h.indexOf('.');
    if (i < 0) return false;
    h = h.slice(i + 1);
    if (!h.includes('.')) return false;
  }
}

// ---------- HTTPS forcé ----------
function isLocalHost(h) {
  return h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') ||
    /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h) || h === '::1' || !h.includes('.');
}
function shouldUpgrade(url) {
  if (!ctx.getSettings().httpsOnly) return false;
  if (!/^http:\/\//i.test(url)) return false;
  const h = hostOf(url);
  return !!h && !isLocalHost(h) && !allowHttp.has(h);
}
const toHttps = (url) => url.replace(/^http:/i, 'https:');

// ---------- Page d'alerte (affichée par l'interface, pas par la page web) ----------
function interstitial(contents, kind, url) {
  ctx.toUI('security:interstitial', { wcId: contents.id, kind, url });
}

// ---------- Applications externes ----------
async function openExternal(contents, url) {
  if (!EXTERNAL_OK.test(url)) return;
  const scheme = url.split(':')[0];
  const host = contents && !contents.isDestroyed() ? hostOf(contents.getURL()) : '';
  const r = await dialog.showMessageBox({
    type: 'question',
    title: "Maxou's Nav",
    message: `Ouvrir l'application externe « ${scheme} » ?`,
    detail: `${host ? host + ' veut' : 'Ce lien veut'} ouvrir une application installée sur ton ordinateur.\n\n${url.slice(0, 200)}`,
    buttons: ['Ouvrir', 'Annuler'],
    defaultId: 1,
    cancelId: 1
  });
  if (r.response === 0) shell.openExternal(url).catch(() => {});
}

// ---------- Connexion Google ----------
// Google refuse la connexion depuis les navigateurs « intégrés ». Sur accounts.google.com
// uniquement, Maxou's Nav se présente comme Firefox, ce que Google accepte.
const ffPlatform = {
  win32: 'Windows NT 10.0; Win64; x64',
  darwin: 'Macintosh; Intel Mac OS X 10.15',
  linux: 'X11; Linux x86_64'
}[process.platform] || 'Windows NT 10.0; Win64; x64';
const FIREFOX_UA = `Mozilla/5.0 (${ffPlatform}; rv:146.0) Gecko/20100101 Firefox/146.0`;
function isGoogleLogin(url) {
  const h = hostOf(url);
  return h === 'accounts.google.com' || h === 'accounts.youtube.com';
}

function setupSessionHeaders(ses) {
  ses.webRequest.onBeforeSendHeaders({ urls: ['http://*/*', 'https://*/*'] }, (details, cb) => {
    const h = details.requestHeaders;
    if (ctx.getSettings().gpc) h['Sec-GPC'] = '1'; // « Ne vendez pas mes données »
    if (isGoogleLogin(details.url)) {
      h['User-Agent'] = FIREFOX_UA;
      for (const k of Object.keys(h)) if (/^sec-ch-ua/i.test(k)) delete h[k];
    }
    cb({ requestHeaders: h });
  });
}

// ---------- Gardes sur chaque onglet / popup ----------
function guardContents(contents) {
  const defaultUA = () => app.userAgentFallback;

  const check = (e, url, { allowUpgrade }) => {
    let scheme = '';
    try { scheme = new URL(url).protocol; } catch { return; }
    if (!WEB_SCHEMES.has(scheme)) {
      e.preventDefault();
      openExternal(contents, url);
      return;
    }
    if (isDangerous(url)) {
      e.preventDefault();
      interstitial(contents, 'danger', url);
      return;
    }
    if (allowUpgrade && shouldUpgrade(url)) {
      e.preventDefault();
      upgrades.set(contents.id, url);
      contents.loadURL(toHttps(url)).catch(() => {});
    }
  };

  contents.on('will-navigate', (e, url) => check(e, url, { allowUpgrade: true }));
  contents.on('will-frame-navigate', (e) => {
    if (e.isMainFrame) return; // déjà couvert par will-navigate
    const url = e.url;
    if (isDangerous(url)) e.preventDefault();
  });
  contents.on('will-redirect', (e, url, _inPlace, isMainFrame) => {
    const main = e.isMainFrame !== undefined ? e.isMainFrame : isMainFrame;
    if (!main) return;
    const pending = upgrades.get(contents.id);
    // https → http : le site ne gère pas https, on le retient pour ne pas boucler
    if (pending && /^http:/i.test(url) && hostOf(url) === hostOf(pending)) {
      allowHttp.add(hostOf(url));
      upgrades.delete(contents.id);
    }
    check(e, url, { allowUpgrade: false });
  });

  // Filet de sécurité : toute navigation (historique, adresse tapée…).
  // Important : jamais d'arrêt/rechargement DANS cet événement (Electron plante) → setImmediate.
  contents.on('did-start-navigation', (e, urlArg, isInPlace, isMainFrameArg) => {
    const url = e.url || urlArg;
    const isMainFrame = e.isMainFrame !== undefined ? e.isMainFrame : isMainFrameArg;
    const same = e.isSameDocument !== undefined ? e.isSameDocument : isInPlace;
    if (!isMainFrame || same) return;
    // identité Firefox sur la page de connexion Google
    const wantFF = isGoogleLogin(url);
    const isFF = contents.getUserAgent() === FIREFOX_UA;
    if (wantFF && !isFF) contents.setUserAgent(FIREFOX_UA);
    else if (!wantFF && isFF) contents.setUserAgent(defaultUA());

    if (isDangerous(url)) {
      setImmediate(() => {
        if (contents.isDestroyed()) return;
        contents.stop();
        interstitial(contents, 'danger', url);
      });
    } else if (shouldUpgrade(url) && upgrades.get(contents.id) !== url) {
      upgrades.set(contents.id, url);
      setImmediate(() => {
        if (contents.isDestroyed()) return;
        contents.stop();
        contents.loadURL(toHttps(url)).catch(() => {});
      });
    }
  });

  // Dernier rempart : si une page dangereuse arrive malgré tout à s'afficher, on la remplace
  contents.on('did-navigate', (_e, url) => {
    if (isDangerous(url)) {
      setImmediate(() => {
        if (contents.isDestroyed()) return;
        contents.loadURL('about:blank').catch(() => {});
        interstitial(contents, 'danger', url);
      });
    }
  });

  contents.on('did-fail-load', (_e, code, _desc, url, isMainFrame) => {
    if (!isMainFrame || code === -3) return;
    const pending = upgrades.get(contents.id);
    if (pending && hostOf(url) === hostOf(pending) && /^https:/i.test(url)) {
      upgrades.delete(contents.id);
      interstitial(contents, 'http', pending);
    }
  });
  contents.on('did-navigate', (_e, url) => {
    const pending = upgrades.get(contents.id);
    if (pending && /^https:/i.test(url)) upgrades.delete(contents.id);
  });
}

// Lien "nouvelle fenêtre" vers une app externe ou un site dangereux
function checkWindowOpen(contents, url) {
  let scheme = '';
  try { scheme = new URL(url).protocol; } catch { return 'deny'; }
  if (!WEB_SCHEMES.has(scheme)) { openExternal(contents, url); return 'deny'; }
  if (scheme === 'file:' || scheme === 'data:') return 'deny'; // une page web ne peut pas ouvrir de fichier local
  if (isDangerous(url)) { interstitial(contents, 'danger', url); return 'deny'; }
  return 'ok';
}

// Vérification demandée par l'interface avant d'ouvrir une adresse
function checkUrl(url) {
  if (isDangerous(url)) return { action: 'danger' };
  if (shouldUpgrade(url)) return { action: 'upgrade', url: toHttps(url) };
  return { action: 'ok' };
}

function proceed(wcId, kind, url) {
  const wc = webContents.fromId(wcId);
  const h = hostOf(url);
  if (!wc || !h) return;
  if (kind === 'danger') allowDanger.add(h);
  if (kind === 'http') allowHttp.add(h);
  wc.loadURL(url).catch(() => {});
}

function init(context) {
  ctx = context;
  initLists();
}

module.exports = {
  init, setupSessionHeaders, guardContents, checkWindowOpen, checkUrl, proceed,
  isDangerous, refreshLists, blockedCount: () => blocked.size
};
