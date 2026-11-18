// Maxou's Nav — processus principal
const {
  app, BrowserWindow, session, ipcMain, Menu, net, shell, dialog, clipboard, webContents
} = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const os = require('os');

const APP_NAME = "Maxou's Nav";
app.setName(APP_NAME);
if (process.platform === 'win32') app.setAppUserModelId('fr.maxou.nav');

// ---------- Optimisations Chromium ----------
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('enable-features', 'BackForwardCache,ParallelDownloading,CanvasOopRasterization');
app.commandLine.appendSwitch('disable-features', 'MediaRouter,DialMediaRouteProvider');

// Identifiant de navigateur identique à Chrome : Google et les sites
// (connexion à un compte Google, etc.) le traitent comme un Chrome normal.
const chromeMajor = process.versions.chrome.split('.')[0];
const platformUA = {
  win32: 'Windows NT 10.0; Win64; x64',
  darwin: 'Macintosh; Intel Mac OS X 10_15_7',
  linux: 'X11; Linux x86_64'
}[process.platform] || 'Windows NT 10.0; Win64; x64';
app.userAgentFallback =
  `Mozilla/5.0 (${platformUA}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeMajor}.0.0.0 Safari/537.36`;

// ---------- Échanges interface ↔ système : seule l'interface de Maxou's Nav est écoutée ----------
function fromUI(e) {
  return !!(mainWindow && !mainWindow.isDestroyed() && e.sender === mainWindow.webContents &&
    e.senderFrame && e.senderFrame === mainWindow.webContents.mainFrame &&
    /^file:\/\/.*\/renderer\/index\.html$/.test(e.senderFrame.url.split(/[?#]/)[0]));
}
function uiHandle(channel, fn) {
  ipcMain.handle(channel, (e, ...args) => {
    if (!fromUI(e)) throw new Error('Accès refusé');
    return fn(e, ...args);
  });
}
function uiOn(channel, fn) {
  ipcMain.on(channel, (e, ...args) => { if (fromUI(e)) fn(e, ...args); });
}

// ---------- Auto-test (utilisé par GitHub avant chaque publication) ----------
const SELFTEST = process.argv.includes('--maxou-selftest');
if (SELFTEST) app.setPath('userData', path.join(os.tmpdir(), 'maxou-selftest-' + process.pid));

// ---------- Une seule instance ----------
if (!SELFTEST && !app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

let mainWindow = null;
const isDev = !app.isPackaged;

// ---------- Réglages persistants ----------
const settingsPath = () => path.join(app.getPath('userData'), 'settings.json');
let settings = {
  adblock: true, totalBlocked: 0, bounds: null, maximized: false, permissions: {},
  // Préférences modifiables dans la page Paramètres
  startup: 'restore',          // 'newtab' | 'restore' | 'pages'
  startupPages: [],            // pages ouvertes au démarrage (mode 'pages')
  home: { mode: 'newtab', url: '' }, // bouton Accueil
  showHome: true,
  showBookmarksBar: true,
  bookmarks: [],               // { id, title, url, favicon }
  safeBrowsing: true,          // blocage des sites d'hameçonnage / malveillants
  httpsOnly: true,             // passage automatique en HTTPS
  gpc: true                    // signal « Global Privacy Control »
};
const PREF_KEYS = ['startup', 'startupPages', 'home', 'showHome', 'showBookmarksBar', 'bookmarks', 'safeBrowsing', 'httpsOnly', 'gpc'];
function prefs() {
  const p = {};
  for (const k of PREF_KEYS) p[k] = settings[k];
  return p;
}
function loadSettings() {
  try { settings = { ...settings, ...JSON.parse(fs.readFileSync(settingsPath(), 'utf8')) }; } catch {}
}
let saveTimer = null;
function saveSettings(now = false) {
  clearTimeout(saveTimer);
  const write = () => { try { fs.writeFileSync(settingsPath(), JSON.stringify(settings)); } catch {} };
  if (now) write(); else saveTimer = setTimeout(write, 2000);
}

function urlFromArgs(argv) {
  return argv.slice(1).find((a) => /^(https?:\/\/|file:)/i.test(a)) || null;
}

function toUI(channel, ...args) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, ...args);
}

// ---------- Fenêtre ----------
function isWin11() {
  if (process.platform !== 'win32') return false;
  const build = parseInt(os.release().split('.')[2] || '0', 10);
  return build >= 22000;
}

function createWindow() {
  const mica = isWin11();
  const b = settings.bounds || {};
  mainWindow = new BrowserWindow({
    width: b.width || 1360,
    height: b.height || 860,
    x: b.x, y: b.y,
    minWidth: 520,
    minHeight: 360,
    show: false,
    title: APP_NAME,
    icon: path.join(__dirname, 'icon.png'),
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: mica ? '#00000000' : '#09091A',
      symbolColor: '#E8EAF2',
      height: 42
    },
    backgroundColor: mica ? '#00000000' : '#06070F',
    ...(mica ? { backgroundMaterial: 'mica' } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.bundle.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: true,
      spellcheck: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      navigateOnDragDrop: false,
      additionalArguments: [mica ? '--maxou-mica' : '--maxou-solid']
    }
  });

  if (settings.maximized) mainWindow.maximize();
  // L'interface ne doit jamais changer de page ni ouvrir de fenêtre
  mainWindow.webContents.on('will-navigate', (e) => e.preventDefault());
  mainWindow.webContents.on('will-redirect', (e) => e.preventDefault());
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  // Chaque onglet (webview) est forcé en mode isolé, quoi qu'il arrive
  mainWindow.webContents.on('will-attach-webview', (e, wp, params) => {
    delete wp.preload;
    delete wp.preloadURL;
    wp.nodeIntegration = false;
    wp.nodeIntegrationInSubFrames = false;
    wp.nodeIntegrationInWorker = false;
    wp.contextIsolation = true;
    wp.sandbox = true;
    wp.webSecurity = true;
    wp.allowRunningInsecureContent = false;
    wp.experimentalFeatures = false;
    wp.enableBlinkFeatures = '';
    wp.spellcheck = false;
    wp.navigateOnDragDrop = false;
    const src = params.src || '';
    if (!/^(https?:|file:|data:text\/html|about:blank)/i.test(src)) e.preventDefault();
  });
  mainWindow.webContents.on('did-attach-webview', (_e, wc) => {
    if (extensions) { try { extensions.addTab(wc, mainWindow); } catch {} }
  });
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  const startUrl = urlFromArgs(process.argv);
  if (startUrl) mainWindow.webContents.once('did-finish-load', () => toUI('open-tab', startUrl, true));

  const remember = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    settings.maximized = mainWindow.isMaximized();
    if (!settings.maximized && !mainWindow.isFullScreen()) settings.bounds = mainWindow.getBounds();
    saveSettings();
  };
  mainWindow.on('resize', remember);
  mainWindow.on('move', remember);
  mainWindow.on('close', () => { remember(); saveSettings(true); });
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.on('second-instance', (_e, argv) => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
  const url = urlFromArgs(argv);
  toUI('open-tab', url || null, true);
});

// ---------- Raccourcis clavier (marchent aussi quand le focus est dans la page) ----------
function shortcutFor(input) {
  const ctrl = input.control || input.meta;
  const k = (input.key || '').toLowerCase();
  if (ctrl && input.shift && k === 't') return 'reopen-tab';
  if (ctrl && input.shift && (k === 'tab')) return 'prev-tab';
  if (ctrl && input.shift && k === 'i') return 'devtools';
  if (ctrl && input.shift && k === 'b') return 'toggle-bookmarks-bar';
  if (ctrl && input.shift && k === 'o') return 'settings';
  if (ctrl && !input.shift && !input.alt) {
    if (k === 't') return 'new-tab';
    if (k === 'w' || k === 'f4') return 'close-tab';
    if (k === 'tab' || k === 'pagedown') return 'next-tab';
    if (k === 'pageup') return 'prev-tab';
    if (k === 'l' || k === 'e' || k === 'k') return 'focus-address';
    if (k === 'r') return 'reload';
    if (k === 'f') return 'find';
    if (k === 'd') return 'bookmark';
    if (k === ',') return 'settings';
    if (k === 'h' || k === 'j') return 'downloads';
    if (k === '=' || k === '+' || k === 'add') return 'zoom-in';
    if (k === '-' || k === 'subtract') return 'zoom-out';
    if (k === '0') return 'zoom-reset';
    if (/^[1-9]$/.test(k)) return 'tab-' + k;
  }
  if (!ctrl && input.alt && k === 'arrowleft') return 'back';
  if (!ctrl && input.alt && k === 'arrowright') return 'forward';
  if (!ctrl && input.alt && k === 'home') return 'home';
  if (k === 'browserback') return 'back';
  if (k === 'browserforward') return 'forward';
  if (k === 'f5') return input.shift || ctrl ? 'hard-reload' : 'reload';
  if (k === 'f6') return 'focus-address';
  if (k === 'f11') return 'fullscreen';
  if (k === 'f12') return 'devtools';
  return null;
}

function attachShortcuts(contents) {
  contents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const host = contents.getType() === 'webview' ? contents.hostWebContents : contents;
    if (!mainWindow || !host || host !== mainWindow.webContents) return;
    if ((input.key || '') === 'Escape') { toUI('cmd', 'escape'); return; }
    const cmd = shortcutFor(input);
    if (!cmd) return;
    event.preventDefault();
    if (cmd === 'fullscreen') { mainWindow.setFullScreen(!mainWindow.isFullScreen()); return; }
    toUI('cmd', cmd);
  });
}

// ---------- Menu clic droit ----------
function short(s, n = 32) { s = s.replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n) + '…' : s; }

function showContextMenu(contents, p) {
  const isWebview = contents.getType() === 'webview';
  const t = [];
  const sep = { type: 'separator' };
  const nav = contents.navigationHistory;

  if (isWebview && p.linkURL) {
    t.push(
      { label: 'Ouvrir le lien dans un nouvel onglet', click: () => toUI('open-tab', p.linkURL, false) },
      { label: 'Copier l’adresse du lien', click: () => clipboard.writeText(p.linkURL) },
      { label: 'Enregistrer le lien sous…', click: () => contents.downloadURL(p.linkURL) },
      sep
    );
  }
  if (isWebview && p.mediaType === 'image' && p.srcURL) {
    t.push(
      { label: 'Ouvrir l’image dans un nouvel onglet', click: () => toUI('open-tab', p.srcURL, false) },
      { label: 'Enregistrer l’image', click: () => contents.downloadURL(p.srcURL) },
      { label: 'Copier l’image', click: () => contents.copyImageAt(p.x, p.y) },
      { label: 'Copier l’adresse de l’image', click: () => clipboard.writeText(p.srcURL) },
      sep
    );
  }
  if (isWebview && (p.mediaType === 'video' || p.mediaType === 'audio') && p.srcURL && !p.srcURL.startsWith('blob:')) {
    t.push({ label: 'Enregistrer la vidéo/l’audio', click: () => contents.downloadURL(p.srcURL) }, sep);
  }

  const sel = (p.selectionText || '').trim();
  if (p.isEditable) {
    t.push(
      { label: 'Annuler', enabled: p.editFlags.canUndo, click: () => contents.undo() },
      { label: 'Rétablir', enabled: p.editFlags.canRedo, click: () => contents.redo() },
      sep,
      { label: 'Couper', enabled: p.editFlags.canCut, click: () => contents.cut() },
      { label: 'Copier', enabled: p.editFlags.canCopy, click: () => contents.copy() },
      { label: 'Coller', enabled: p.editFlags.canPaste, click: () => contents.paste() },
      { label: 'Coller sans mise en forme', enabled: p.editFlags.canPaste, click: () => contents.pasteAndMatchStyle() },
      { label: 'Tout sélectionner', click: () => contents.selectAll() }
    );
  } else if (sel) {
    t.push({ label: 'Copier', click: () => contents.copy() });
    if (isWebview) {
      t.push({
        label: `Rechercher « ${short(sel)} » sur Google`,
        click: () => toUI('open-tab', 'https://www.google.com/search?q=' + encodeURIComponent(sel), true)
      });
    }
  } else if (isWebview && !p.linkURL && p.mediaType === 'none') {
    t.push(
      { label: 'Précédent', enabled: nav.canGoBack(), click: () => nav.goBack() },
      { label: 'Suivant', enabled: nav.canGoForward(), click: () => nav.goForward() },
      { label: 'Actualiser', click: () => contents.reload() },
      sep,
      { label: 'Tout sélectionner', click: () => contents.selectAll() }
    );
  }

  if (isWebview && extensions) {
    try {
      const extItems = extensions.getContextMenuItems(contents, p);
      if (extItems && extItems.length) {
        if (t.length && t[t.length - 1].type !== 'separator') t.push(sep);
        t.push(...extItems);
      }
    } catch {}
  }

  if (isWebview) {
    if (t.length && t[t.length - 1].type !== 'separator') t.push(sep);
    t.push({ label: 'Inspecter', click: () => contents.inspectElement(p.x, p.y) });
  }
  while (t.length && t[t.length - 1].type === 'separator') t.pop();
  if (!t.length) return;
  const win = BrowserWindow.fromWebContents(isWebview ? contents.hostWebContents : contents);
  Menu.buildFromTemplate(t).popup({ window: win || undefined });
}

app.on('web-contents-created', (_e, contents) => {
  attachShortcuts(contents);
  contents.on('context-menu', (_ev, params) => showContextMenu(contents, params));

  // Réglé juste après la création (mainWindow n'est pas encore connue pour la toute première)
  setImmediate(() => {
    if (contents.isDestroyed()) return;
    if (mainWindow && contents === mainWindow.webContents) return; // l'interface a ses propres règles
    const type = contents.getType();
    if (type !== 'webview' && type !== 'window') return;
    security.guardContents(contents);
    contents.setWindowOpenHandler(({ url, disposition }) => {
      if (security.checkWindowOpen(contents, url) !== 'ok') return { action: 'deny' };
      // Vraies fenêtres popup (connexion Google/Facebook sur un site, paiement…)
      if (type === 'webview' && disposition === 'new-window') {
        return {
          action: 'allow',
          overrideBrowserWindowOptions: {
            width: 520, height: 700, autoHideMenuBar: true,
            backgroundColor: '#ffffff',
            icon: path.join(__dirname, 'icon.png'),
            webPreferences: {
              sandbox: true, contextIsolation: true, nodeIntegration: false,
              webSecurity: true, allowRunningInsecureContent: false, spellcheck: false
            }
          }
        };
      }
      // target=_blank, clic molette, liens ouverts depuis une popup… → nouvel onglet
      toUI('open-tab', url, disposition !== 'background-tab');
      return { action: 'deny' };
    });
  });
});

// ---------- Bloqueur de pubs (moteur Ghostery, listes EasyList & co) ----------
let blocker = null;
let blockerReady = false;

async function loadBlocker() {
  const { ElectronBlocker } = require('@ghostery/adblocker-electron');
  const cache = path.join(app.getPath('userData'), 'adblock-engine.bin');
  const bundled = isDev
    ? path.join(__dirname, '..', 'build', 'adblock-engine.bin')
    : path.join(process.resourcesPath, 'adblock-engine.bin');
  const MAX_AGE = 4 * 24 * 3600 * 1000;

  const tryLoad = async (file) => {
    try { return ElectronBlocker.deserialize(new Uint8Array(await fsp.readFile(file))); } catch { return null; }
  };

  let stat = null;
  try { stat = fs.statSync(cache); } catch {}
  if (stat && Date.now() - stat.mtimeMs < MAX_AGE) {
    const b = await tryLoad(cache);
    if (b) return b;
  }
  // Listes à jour depuis Internet
  try {
    const b = await ElectronBlocker.fromPrebuiltAdsAndTracking((url, init) => net.fetch(url, init));
    fsp.writeFile(cache, b.serialize()).catch(() => {});
    return b;
  } catch {}
  // Hors ligne : ancien cache, sinon listes livrées avec l'appli
  return (stat && await tryLoad(cache)) || await tryLoad(bundled);
}

async function initAdblock() {
  try {
    blocker = await loadBlocker();
    if (!blocker) return;
    const onBlocked = (req) => {
      settings.totalBlocked++;
      toUI('adblock:blocked', req.tabId);
      saveSettings();
    };
    blocker.on('request-blocked', onBlocked);
    blocker.on('request-redirected', onBlocked); // scripts de pub remplacés par une version vide
    if (settings.adblock) blocker.enableBlockingInSession(session.defaultSession);
    blockerReady = true;
    toUI('adblock:state', adblockState());
  } catch (err) {
    console.error('Bloqueur de pubs indisponible :', err);
  }
}

function adblockState() {
  return { ready: blockerReady, enabled: settings.adblock, total: settings.totalBlocked };
}

uiHandle('adblock:get', () => adblockState());
uiHandle('adblock:set', (_e, on) => {
  settings.adblock = !!on;
  saveSettings();
  if (blocker) {
    try {
      if (on) blocker.enableBlockingInSession(session.defaultSession);
      else blocker.disableBlockingInSession(session.defaultSession);
    } catch {}
  }
  return adblockState();
});

// ---------- Autorisations des sites (caméra, micro, position…) ----------
const ASK = {
  media: 'utiliser ta caméra ou ton micro',
  geolocation: 'connaître ta position',
  notifications: 'afficher des notifications',
  'clipboard-read': 'lire ton presse-papiers',
  'display-capture': 'capturer ton écran',
  midi: 'accéder à tes appareils MIDI',
  midiSysex: 'accéder à tes appareils MIDI',
  'idle-detection': 'savoir quand tu es inactif'
};
const ALWAYS = new Set(['fullscreen', 'clipboard-sanitized-write', 'pointerLock', 'keyboardLock', 'speaker-selection']);

function setupPermissions(ses) {
  ses.setPermissionRequestHandler((wc, permission, cb, details) => {
    if (ALWAYS.has(permission)) return cb(true);
    if (!ASK[permission]) return cb(false);
    let origin;
    try { origin = new URL(details.requestingUrl || wc.getURL()).origin; } catch { return cb(false); }
    const key = origin + '|' + permission;
    if (key in settings.permissions) return cb(settings.permissions[key]);
    const host = wc.getType() === 'webview' ? wc.hostWebContents : wc;
    const win = BrowserWindow.fromWebContents(host) || mainWindow;
    dialog.showMessageBox(win, {
      type: 'question',
      title: APP_NAME,
      message: `${new URL(origin).host} veut ${ASK[permission]}.`,
      buttons: ['Autoriser', 'Bloquer'],
      defaultId: 1,
      cancelId: 1,
      checkboxLabel: 'Retenir mon choix pour ce site',
      checkboxChecked: true
    }).then((r) => {
      const ok = r.response === 0;
      if (r.checkboxChecked) { settings.permissions[key] = ok; saveSettings(); }
      cb(ok);
    }).catch(() => cb(false));
  });
  // USB / HID / port série / Bluetooth : refusés (aucun site n'y a accès)
  ses.setDevicePermissionHandler(() => false);
  ses.on('select-hid-device', (e, _d, cb) => { e.preventDefault(); cb(); });
  ses.on('select-serial-port', (e, _l, _w, cb) => { e.preventDefault(); cb(''); });
  ses.on('select-usb-device', (e, _d, cb) => { e.preventDefault(); cb(); });
  ses.setPermissionCheckHandler((_wc, permission, origin) => {
    if (ALWAYS.has(permission)) return true;
    try { return settings.permissions[new URL(origin).origin + '|' + permission] === true; } catch { return false; }
  });
}

// ---------- Téléchargements ----------
const downloads = new Map();
let dlSeq = 0;

function uniquePath(dir, name) {
  name = name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_') || 'telechargement';
  const ext = path.extname(name);
  const base = name.slice(0, name.length - ext.length);
  let p = path.join(dir, name);
  for (let i = 1; fs.existsSync(p); i++) p = path.join(dir, `${base} (${i})${ext}`);
  return p;
}

function setupDownloads(ses) {
  ses.on('will-download', (_e, item) => {
    if (security.isDangerous(item.getURL())) {
      item.cancel();
      toUI('toast', '⛔ Téléchargement bloqué : il provient d\u2019un site signalé comme dangereux');
      return;
    }
    const id = ++dlSeq;
    const file = uniquePath(app.getPath('downloads'), item.getFilename());
    item.setSavePath(file);
    downloads.set(id, { item, file });
    let last = 0;
    const send = (state, force) => {
      const now = Date.now();
      if (!force && now - last < 250) return;
      last = now;
      toUI('download', {
        id, state, name: path.basename(file),
        received: item.getReceivedBytes(), total: item.getTotalBytes()
      });
    };
    send('progressing', true);
    item.on('updated', (_ev, state) => send(item.isPaused() ? 'paused' : state));
    item.once('done', (_ev, state) => {
      if (state === 'completed') markOfTheWeb(file, item.getURL());
      send(state, true);
    });
  });
}

// Fichiers qui peuvent lancer un programme
const RISKY = /\.(exe|msi|msix|appx|bat|cmd|com|scr|pif|ps1|psm1|vbs|vbe|js|jse|wsf|wsh|hta|cpl|jar|lnk|reg|dll|sys|iso|img|vhd|vhdx|application|appref-ms|msc|gadget|inf|ins|isp|scf|url|xll|xlam|docm|xlsm|pptm)$/i;

// « Marque du Web » : Windows SmartScreen et Office savent que le fichier vient d'Internet
function markOfTheWeb(file, url) {
  if (process.platform !== 'win32') return;
  let safeUrl = '';
  try { const u = new URL(url); if (/^https?:$/.test(u.protocol)) safeUrl = u.origin + u.pathname; } catch {}
  try {
    fs.writeFileSync(file + ':Zone.Identifier', `[ZoneTransfer]\r\nZoneId=3\r\n${safeUrl ? 'HostUrl=' + safeUrl + '\r\n' : ''}`);
  } catch {}
}

uiOn('download:open', async (_e, id) => {
  const d = downloads.get(id);
  if (!d) return;
  if (RISKY.test(d.file)) {
    const r = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: APP_NAME,
      message: `Ouvrir « ${path.basename(d.file)} » ?`,
      detail: 'Ce type de fichier peut lancer un programme sur ton ordinateur. Ouvre-le seulement si tu fais confiance au site d\u2019où il vient.',
      buttons: ['Ouvrir quand même', 'Annuler'],
      defaultId: 1,
      cancelId: 1
    });
    if (r.response !== 0) return;
  }
  shell.openPath(d.file);
});
uiOn('download:show', (_e, id) => { const d = downloads.get(id); if (d) shell.showItemInFolder(d.file); });
uiOn('download:cancel', (_e, id) => { const d = downloads.get(id); if (d) d.item.cancel(); });
uiOn('download:folder', () => shell.openPath(app.getPath('downloads')));

// ---------- Suggestions de recherche Google ----------
uiHandle('suggest', async (_e, q) => {
  try {
    const r = await net.fetch(
      'https://suggestqueries.google.com/complete/search?client=firefox&hl=fr&ie=utf-8&oe=utf-8&q=' + encodeURIComponent(q)
    );
    const data = JSON.parse(await r.text());
    return Array.isArray(data[1]) ? data[1].slice(0, 6) : [];
  } catch {
    return [];
  }
});

// ---------- Mises à jour ----------
const updater = require('./updater');
uiHandle('update:get', () => updater.getState());
uiHandle('update:check', () => updater.check(true));
uiHandle('update:install', () => updater.installNow());

uiOn('fullscreen',() => { if (mainWindow) mainWindow.setFullScreen(!mainWindow.isFullScreen()); });
uiHandle('app:info', () => ({
  version: app.getVersion(),
  chrome: process.versions.chrome,
  electron: process.versions.electron
}));

// ---------- Préférences (page Paramètres, favoris…) ----------
uiHandle('prefs:get', () => prefs());
uiHandle('prefs:set', (_e, patch) => {
  for (const k of PREF_KEYS) if (patch && k in patch) settings[k] = patch[k];
  saveSettings();
  toUI('prefs', prefs());
  return prefs();
});

// ---------- Extensions Chrome (Chrome Web Store) ----------
let extensions = null;
const pendingTabs = new Map();
let tabReq = 0;

function waitForTab(url, active) {
  return new Promise((resolve, reject) => {
    const id = ++tabReq;
    pendingTabs.set(id, resolve);
    toUI('ext:create-tab', { reqId: id, url: url || null, active: active !== false });
    setTimeout(() => { if (pendingTabs.delete(id)) reject(new Error('timeout')); }, 15000);
  });
}
uiOn('ext:tab-created', (_e, { reqId, wcId }) => {
  const resolve = pendingTabs.get(reqId);
  if (!resolve) return;
  pendingTabs.delete(reqId);
  const wc = webContents.fromId(wcId);
  if (wc) resolve([wc, mainWindow]);
});
uiOn('ext:tab-selected', (_e, wcId) => {
  const wc = webContents.fromId(wcId);
  if (wc && extensions) { try { extensions.selectTab(wc); } catch {} }
});

function extList() {
  const ses = session.defaultSession;
  const all = (ses.extensions && ses.extensions.getAllExtensions) ? ses.extensions.getAllExtensions() : ses.getAllExtensions();
  return all.map((e) => ({
    id: e.id,
    name: e.name,
    version: e.version,
    description: (e.manifest && e.manifest.description) || ''
  }));
}

// ---------- « externally_connectable » : sites autorisés → extension ----------
// Un motif Chrome (« https://*.proton.me/* ») correspond-il à cette adresse ?
function matchPattern(pattern, url) {
  try {
    if (pattern === '<all_urls>') return false; // jamais tous les sites
    const m = /^(\*|https?):\/\/(\*|\*\.[^/*]+|[^/*]+)(\/.*)$/.exec(pattern);
    if (!m) return false;
    const u = new URL(url);
    const scheme = u.protocol.slice(0, -1);
    if (m[1] === '*' ? !['http', 'https'].includes(scheme) : m[1] !== scheme) return false;
    const host = u.hostname.toLowerCase();
    const ph = m[2].toLowerCase();
    if (ph === '*') return false; // trop large, refusé
    if (ph.startsWith('*.')) { const base = ph.slice(2); if (host !== base && !host.endsWith('.' + base)) return false; }
    else if (host !== ph) return false;
    const re = new RegExp('^' + m[3].split('*').map((x) => x.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');
    return re.test(u.pathname + u.search);
  } catch { return false; }
}
function extsAllowing(url) {
  if (!url || !/^https?:/i.test(url)) return [];
  const ses = session.defaultSession;
  const all = (ses.extensions && ses.extensions.getAllExtensions) ? ses.extensions.getAllExtensions() : [];
  return all.filter((ext) => {
    const ec = ext.manifest && ext.manifest.externally_connectable;
    return ec && Array.isArray(ec.matches) && ec.matches.some((p) => matchPattern(p, url));
  }).map((ext) => ext.id);
}

const ecPending = new Map();
let ecSeq = 0;
function setupExternallyConnectable(ses) {
  const hooked = new WeakSet();
  ses.serviceWorkers.on('running-status-changed', ({ versionId, runningStatus }) => {
    if (runningStatus !== 'starting' && runningStatus !== 'running') return;
    const sw = ses.serviceWorkers.getWorkerFromVersionID(versionId);
    if (!sw || hooked.has(sw) || !String(sw.scope).startsWith('chrome-extension://')) return;
    hooked.add(sw);
    sw.ipc.on('maxou-ext:ec-reply', (_e, reqId, ok, response) => {
      const p = ecPending.get(reqId);
      if (!p || p.scope !== sw.scope) return;
      ecPending.delete(reqId);
      clearTimeout(p.timer);
      p.resolve(ok ? { ok: true, response } : { ok: false, error: typeof response === 'string' ? response : undefined });
    });
  });

  // La page demande à quelles extensions elle peut parler (au chargement)
  ipcMain.on('maxou-ext:ec-ids', (e) => {
    try { e.returnValue = extsAllowing(e.senderFrame && e.senderFrame.url); } catch { e.returnValue = []; }
  });

  ipcMain.handle('maxou-ext:ec-send', async (e, extId, message) => {
    const url = e.senderFrame && e.senderFrame.url;
    if (!extsAllowing(url).includes(extId)) return { ok: false };
    const scope = `chrome-extension://${extId}/`;
    let sw;
    try { sw = await ses.serviceWorkers.startWorkerForScope(scope); } catch { return { ok: false }; }
    const reqId = ++ecSeq;
    const u = new URL(url);
    const sender = {
      url, origin: u.origin, frameId: e.senderFrame && e.senderFrame.parent ? 1 : 0,
      tab: { id: e.sender.id, url: e.sender.getURL(), active: true, index: 0, windowId: 1, incognito: false, pinned: false, highlighted: true }
    };
    return new Promise((resolve) => {
      const timer = setTimeout(() => { ecPending.delete(reqId); resolve({ ok: false }); }, 20000);
      ecPending.set(reqId, { resolve, timer, scope });
      try { sw.send('maxou-ext:ec-message', reqId, message, sender); }
      catch { clearTimeout(timer); ecPending.delete(reqId); resolve({ ok: false }); }
    });
  });
}

async function initExtensions() {
  try {
    const { ElectronChromeExtensions } = require('electron-chrome-extensions');
    const { installChromeWebStore, uninstallExtension } = require('electron-chrome-web-store');
    const ses = session.defaultSession;

    extensions = new ElectronChromeExtensions({
      session: ses,
      async createTab(details) { return waitForTab(details.url, details.active); },
      selectTab(wc) { toUI('ext:select-tab', wc.id); },
      removeTab(wc) { toUI('ext:remove-tab', wc.id); },
      async createWindow(details) {
        const url = Array.isArray(details.url) ? details.url[0] : details.url;
        await waitForTab(url, true);
        return mainWindow;
      }
    });
    ElectronChromeExtensions.handleCRXProtocol(ses);

    // Service worker des extensions : messages venant des sites autorisés (voir ext-compat.preload.js)
    ses.registerPreloadScript({ id: 'maxou-ext-compat', type: 'service-worker', filePath: path.join(__dirname, 'ext-compat.preload.js') });
    setupExternallyConnectable(ses);

    await installChromeWebStore({
      session: ses,
      async beforeInstall(d) {
        const r = await dialog.showMessageBox(mainWindow, {
          type: 'question',
          title: APP_NAME,
          message: `Ajouter « ${d.localizedName} » à Maxou's Nav ?`,
          detail: 'Cette extension pourra lire et modifier certaines pages que tu visites.',
          buttons: ['Ajouter l\u2019extension', 'Annuler'],
          defaultId: 0, cancelId: 1,
          icon: d.icon && !d.icon.isEmpty() ? d.icon : undefined
        });
        return { action: r.response === 0 ? 'allow' : 'deny' };
      }
    });

    const notify = () => toUI('ext:changed', extList());
    const evSrc = ses.extensions && ses.extensions.on ? ses.extensions : ses;
    evSrc.on('extension-loaded', (_e, ext) => { notify(); toUI('toast', `🧩 « ${ext.name} » est installée`); });
    evSrc.on('extension-unloaded', notify);

    uiHandle('ext:list', () => extList());
    uiHandle('ext:remove', async (_e, id) => {
      try { await uninstallExtension(id, { session: ses }); } catch (err) {
        try { (ses.extensions || ses).removeExtension(id); } catch {}
      }
      return extList();
    });
    notify();
  } catch (err) {
    console.error('Extensions indisponibles :', err);
    uiHandle('ext:list', () => []);
    uiHandle('ext:remove', () => []);
  }
}

// ---------- Sécurité : pages d'alerte, effacement des données, autorisations ----------
const security = require('./security');
uiHandle('security:check', (_e, url) => security.checkUrl(String(url || '')));
uiOn('security:proceed', (_e, wcId, kind, url) => {
  if ((kind === 'danger' || kind === 'http') && typeof url === 'string' && /^https?:/i.test(url)) security.proceed(wcId, kind, url);
});
uiHandle('security:info', () => ({ blockedSites: security.blockedCount() }));
uiHandle('data:clear', async (_e, what) => {
  const ses = session.defaultSession;
  const storages = [];
  if (what && what.cookies) storages.push('cookies', 'localstorage', 'indexdb', 'websql', 'serviceworkers', 'cachestorage', 'filesystem', 'shadercache');
  if (storages.length) await ses.clearStorageData({ storages });
  if (what && what.cache) { await ses.clearCache(); await ses.clearHostResolverCache(); }
  if (what && what.permissions) { settings.permissions = {}; saveSettings(); }
  if (what && what.cookies) await ses.clearAuthCache();
  return true;
});
uiHandle('perms:list', () => Object.entries(settings.permissions).map(([k, v]) => {
  const [origin, permission] = k.split('|');
  return { key: k, origin, permission, allowed: v };
}));
uiHandle('perms:revoke', (_e, key) => { delete settings.permissions[key]; saveSettings(); return true; });

function runSelfTest() {
  if (!SELFTEST) return;
  const fail = (why) => { console.error('SELFTEST FAIL', why); app.exit(1); };
  setTimeout(() => fail('timeout'), 45000);
  mainWindow.webContents.once('did-finish-load', () => setTimeout(async () => {
    try {
      const ok = await mainWindow.webContents.executeJavaScript(
        `!!(window.maxou && typeof createTab === 'function' && document.querySelectorAll('.tab').length > 0 && customElements.get('browser-action-list'))`);
      if (!ok) return fail('interface');
      const sandboxed = await mainWindow.webContents.executeJavaScript(`typeof require === 'undefined' && typeof process === 'undefined'`);
      if (!sandboxed) return fail('sandbox');
      console.log('SELFTEST OK');
      app.exit(0);
    } catch (err) { fail(err.message); }
  }, 6000));
}

// ---------- Démarrage ----------
app.whenReady().then(() => {
  loadSettings();
  Menu.setApplicationMenu(null);
  const ses = session.defaultSession;
  security.init({ getSettings: () => settings, toUI });
  security.setupSessionHeaders(ses);
  ses.setSpellCheckerEnabled(false);
  // Petite retouche invisible sur la page de connexion Google (voir page-preload.js)
  ses.registerPreloadScript({ id: 'maxou-page', type: 'frame', filePath: path.join(__dirname, 'page-preload.js') });
  setupPermissions(ses);
  setupDownloads(ses);
  initExtensions().finally(() => {});
  createWindow();
  runSelfTest();
  initAdblock();
  updater.init((s) => toUI('update', s));
});

app.on('window-all-closed', () => {
  saveSettings(true);
  app.quit();
});
