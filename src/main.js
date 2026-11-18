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

// ---------- Une seule instance ----------
if (!app.requestSingleInstanceLock()) {
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
  bookmarks: []                // { id, title, url, favicon }
};
const PREF_KEYS = ['startup', 'startupPages', 'home', 'showHome', 'showBookmarksBar', 'bookmarks'];
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
      color: mica ? '#00000000' : '#0D0E19',
      symbolColor: '#E8EAF2',
      height: 42
    },
    backgroundColor: mica ? '#00000000' : '#0B0C14',
    ...(mica ? { backgroundMaterial: 'mica' } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // nécessaire pour la barre d'icônes des extensions (interface locale de confiance)
      webviewTag: true,
      spellcheck: false,
      additionalArguments: [mica ? '--maxou-mica' : '--maxou-solid']
    }
  });

  if (settings.maximized) mainWindow.maximize();
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

  if (contents.getType() === 'webview') {
    contents.setWindowOpenHandler(({ url, disposition }) => {
      // Vraies fenêtres popup (connexion Google/Facebook sur un site, paiement…)
      if (disposition === 'new-window') {
        return {
          action: 'allow',
          overrideBrowserWindowOptions: {
            width: 520, height: 700, autoHideMenuBar: true,
            backgroundColor: '#ffffff',
            icon: path.join(__dirname, 'icon.png')
          }
        };
      }
      // target=_blank, clic molette… → nouvel onglet
      toUI('open-tab', url, disposition !== 'background-tab');
      return { action: 'deny' };
    });
  }
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

ipcMain.handle('adblock:get', () => adblockState());
ipcMain.handle('adblock:set', (_e, on) => {
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
    item.once('done', (_ev, state) => send(state, true));
  });
}

ipcMain.on('download:open', (_e, id) => { const d = downloads.get(id); if (d) shell.openPath(d.file); });
ipcMain.on('download:show', (_e, id) => { const d = downloads.get(id); if (d) shell.showItemInFolder(d.file); });
ipcMain.on('download:cancel', (_e, id) => { const d = downloads.get(id); if (d) d.item.cancel(); });
ipcMain.on('download:folder', () => shell.openPath(app.getPath('downloads')));

// ---------- Suggestions de recherche Google ----------
ipcMain.handle('suggest', async (_e, q) => {
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
ipcMain.handle('update:get', () => updater.getState());
ipcMain.handle('update:check', () => updater.check(true));
ipcMain.handle('update:install', () => updater.installNow());

ipcMain.on('fullscreen',() => { if (mainWindow) mainWindow.setFullScreen(!mainWindow.isFullScreen()); });
ipcMain.handle('app:info', () => ({
  version: app.getVersion(),
  chrome: process.versions.chrome,
  electron: process.versions.electron
}));

// ---------- Préférences (page Paramètres, favoris…) ----------
ipcMain.handle('prefs:get', () => prefs());
ipcMain.handle('prefs:set', (_e, patch) => {
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
ipcMain.on('ext:tab-created', (_e, { reqId, wcId }) => {
  const resolve = pendingTabs.get(reqId);
  if (!resolve) return;
  pendingTabs.delete(reqId);
  const wc = webContents.fromId(wcId);
  if (wc) resolve([wc, mainWindow]);
});
ipcMain.on('ext:tab-selected', (_e, wcId) => {
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

    ipcMain.handle('ext:list', () => extList());
    ipcMain.handle('ext:remove', async (_e, id) => {
      try { await uninstallExtension(id, { session: ses }); } catch (err) {
        try { (ses.extensions || ses).removeExtension(id); } catch {}
      }
      return extList();
    });
    notify();
  } catch (err) {
    console.error('Extensions indisponibles :', err);
    ipcMain.handle('ext:list', () => []);
    ipcMain.handle('ext:remove', () => []);
  }
}

// ---------- Démarrage ----------
app.whenReady().then(() => {
  loadSettings();
  Menu.setApplicationMenu(null);
  const ses = session.defaultSession;
  setupPermissions(ses);
  setupDownloads(ses);
  initExtensions().finally(() => {});
  createWindow();
  initAdblock();
  updater.init((s) => toUI('update', s));
});

app.on('window-all-closed', () => {
  saveSettings(true);
  app.quit();
});
