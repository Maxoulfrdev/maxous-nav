'use strict';
// Maxou's Nav — interface

const NEWTAB = new URL('newtab.html', location.href).href;
const HOME = NEWTAB;
const SETTINGS_URL = 'maxou://parametres';
const WEBSTORE = 'https://chromewebstore.google.com/category/extensions?hl=fr';
let prefs = { startup: 'restore', startupPages: [], home: { mode: 'newtab', url: '' }, showHome: true, showBookmarksBar: true, bookmarks: [] };
const isInternal = (url) => /^maxou:/i.test(url || '');
function homeUrl() {
  return prefs.home && prefs.home.mode === 'url' && prefs.home.url ? toUrl(prefs.home.url) : NEWTAB;
}
const SEARCH = 'https://www.google.com/search?q=';
const SLEEP_AFTER = 10 * 60 * 1000; // onglets inutilisés mis en veille après 10 min
const api = window.maxou;

const $ = (id) => document.getElementById(id);
const tabsEl = $('tabs');
const viewsEl = $('views');
const omnibox = $('omnibox');
const address = $('address');
const sugEl = $('suggestions');
const siteIcon = $('site-icon');
const backBtn = $('back');
const fwdBtn = $('forward');
const reloadBtn = $('reload');
const progress = $('progress');
const zoomChip = $('zoom-chip');
const shieldBtn = $('shield');
const shieldBadge = $('shield-badge');

if (api.mica) document.body.classList.add('mica');

let tabs = [];
let activeId = null;
let nextId = 1;
const closedTabs = [];
let adblock = { ready: false, enabled: true, total: 0 };

const ICON_GLOBE = '<svg class="fav-default" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 3.6 5.4 3.6 8.5s-1.1 5.9-3.6 8.5c-2.5-2.6-3.6-5.4-3.6-8.5s1.1-5.9 3.6-8.5z"/></svg>';
const ICON_SPARK = '<img class="fav" src="assets/logo-small.svg" alt="">';
const ICON_SOUND = '<svg viewBox="0 0 24 24"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>';
const ICON_MUTED = '<svg viewBox="0 0 24 24"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="m16 9.5 5 5M21 9.5l-5 5"/></svg>';
const ICON_GEAR = '<svg class="fav-default" viewBox="0 0 24 24" style="color:var(--cyan)"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>';
const ICON_X = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';

// ================= Adresse : URL ou recherche Google =================
function toUrl(text) {
  const t = text.trim();
  if (!t) return HOME;
  if (/^(maxou|chrome|edge|about):\/*(parametres|settings)/i.test(t)) return SETTINGS_URL;
  if (/^(maxou|chrome|edge|about):\/*extensions/i.test(t)) return SETTINGS_URL + '#extensions';
  if (/^maxou:/i.test(t)) return t;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(t) || /^(about|data|file|view-source):/i.test(t)) return t;
  if (/^localhost(:\d+)?(\/.*)?$/i.test(t)) return 'http://' + t;
  if (/^\d{1,3}(\.\d{1,3}){3}(:\d+)?(\/.*)?$/.test(t)) return 'http://' + t;
  if (!/\s/.test(t) && /^[^/?#\s]+\.[a-z]{2,}(:\d+)?([/?#].*)?$/i.test(t)) return 'https://' + t;
  return SEARCH + encodeURIComponent(t);
}
const isNewtab = (url) => !url || url.startsWith(NEWTAB);
function displayUrl(url) {
  if (isNewtab(url)) return '';
  if (isInternal(url)) return url;
  try {
    const u = new URL(url);
    if (u.hostname.endsWith('google.com') && u.pathname === '/search' && u.searchParams.get('q')) {
      return u.searchParams.get('q'); // affiche juste la recherche
    }
  } catch {}
  return url;
}

// ================= Onglets =================
function createTab(url = HOME, opts = {}) {
  const { activate = true, asleep = false, title, favicon, index } = opts;
  const tab = {
    id: nextId++, url, wv: null, wcId: null,
    title: title || (isNewtab(url) ? 'Nouvel onglet' : isInternal(url) ? 'Paramètres' : url),
    favicon: favicon || null,
    loading: false, zoom: 0, blocked: 0,
    audible: false, muted: false,
    lastActive: Date.now()
  };

  const el = document.createElement('div');
  el.className = 'tab';
  el.draggable = true;
  el.innerHTML = `<span class="ico"></span><span class="title"></span>
    <button class="audio" hidden title="Couper le son"></button>
    <button class="close" title="Fermer (Ctrl+W)">${ICON_X}</button>`;
  tab.el = el;
  if (index != null && tabsEl.children[index]) {
    tabsEl.insertBefore(el, tabsEl.children[index]);
    tabs.splice(index, 0, tab);
  } else {
    tabsEl.appendChild(el);
    tabs.push(tab);
  }

  el.addEventListener('mousedown', (e) => {
    if (e.button === 1) { e.preventDefault(); closeTab(tab.id); return; }
    if (e.button === 0 && !e.target.closest('button')) activateTab(tab.id);
  });
  el.addEventListener('auxclick', (e) => e.preventDefault());
  el.querySelector('.close').addEventListener('click', (e) => { e.stopPropagation(); closeTab(tab.id); });
  el.querySelector('.audio').addEventListener('click', (e) => {
    e.stopPropagation();
    if (!tab.wv) return;
    tab.muted = !tab.muted;
    tab.wv.setAudioMuted(tab.muted);
    renderTab(tab);
  });
  setupTabDrag(tab);

  if (isInternal(url)) tab.title = 'Paramètres';
  else if (!asleep) spawnWebview(tab);
  else el.classList.add('asleep');
  renderTab(tab);
  layoutTabs();
  if (activate) activateTab(tab.id);
  saveSession();
  return tab;
}

function renderTab(tab) {
  const el = tab.el;
  const ico = el.querySelector('.ico');
  let html;
  if (tab.loading) html = '<span class="spinner"></span>';
  else if (isNewtab(tab.url)) html = ICON_SPARK;
  else if (isInternal(tab.url)) html = ICON_GEAR;
  else if (tab.favicon) html = `<img class="fav" src="${escapeAttr(tab.favicon)}" alt="">`;
  else html = ICON_GLOBE;
  if (ico.dataset.html !== html) {
    ico.dataset.html = html;
    ico.innerHTML = html;
    const img = ico.querySelector('img.fav');
    if (img && tab.favicon) img.onerror = () => { tab.favicon = null; renderTab(tab); };
  }
  el.querySelector('.title').textContent = tab.title;
  el.title = tab.title;
  const audio = el.querySelector('.audio');
  audio.hidden = !(tab.audible || tab.muted);
  audio.innerHTML = tab.muted ? ICON_MUTED : ICON_SOUND;
  audio.title = tab.muted ? 'Réactiver le son' : 'Couper le son';
}

function escapeAttr(s) { return String(s).replace(/[&"<>]/g, (c) => ({ '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' }[c])); }

function layoutTabs() {
  requestAnimationFrame(() => {
    for (const t of tabs) t.el.classList.toggle('narrow', t.el.offsetWidth < 92);
  });
}
window.addEventListener('resize', layoutTabs);

function spawnWebview(tab) {
  if (isInternal(tab.url)) return;
  const wv = document.createElement('webview');
  wv.setAttribute('allowpopups', '');
  wv.setAttribute('webpreferences', 'contextIsolation=yes, spellcheck=no');
  wv.setAttribute('src', tab.url || HOME);
  tab.wv = wv;
  tab.el.classList.remove('asleep');
  wireWebview(tab);
  viewsEl.appendChild(wv);
  if (tab.id === activeId) wv.classList.add('active');
}

function sleepTab(tab) {
  if (!tab.wv || tab.id === activeId || tab.loading || tab.audible) return;
  tab.wv.remove();
  tab.wv = null;
  tab.wcId = null;
  tab.el.classList.add('asleep');
}

// Mise en veille automatique des onglets inutilisés = moins de RAM et de CPU
setInterval(() => {
  const now = Date.now();
  for (const t of tabs) if (t.wv && t.id !== activeId && now - t.lastActive > SLEEP_AFTER) sleepTab(t);
}, 60 * 1000);

function wireWebview(tab) {
  const wv = tab.wv;
  const paintBg = () => wv.classList.toggle('dark-bg', isNewtab(tab.url) || (tab.url || '').startsWith('data:') || !!tab.errorUrl);
  paintBg();

  // Identifiant récupéré dès l'attache : le compteur de pubs ne rate rien
  wv.addEventListener('did-attach', () => {
    try { tab.wcId = wv.getWebContentsId(); } catch {}
    if (tab.onAttach) { const cbs = tab.onAttach; tab.onAttach = null; cbs.forEach((cb) => cb(tab.wcId)); }
    if (tab.id === activeId && tab.wcId) api.ext.tabSelected(tab.wcId);
  });

  wv.addEventListener('dom-ready', () => {
    try { tab.wcId = wv.getWebContentsId(); } catch {}
    if (tab.zoom) wv.setZoomLevel(tab.zoom);
    if (tab.muted) wv.setAudioMuted(true);
    if (tab.id === activeId) updateToolbar();
  });

  wv.addEventListener('did-start-loading', () => {
    tab.loading = true;
    renderTab(tab);
    if (tab.id === activeId) updateToolbar();
  });

  wv.addEventListener('did-stop-loading', () => {
    tab.loading = false;
    renderTab(tab);
    if (tab.id === activeId) updateToolbar();
    saveSession();
  });

  wv.addEventListener('did-start-navigation', (e) => {
    if (e.isMainFrame && !e.isSameDocument && tab.interstitial && e.url !== tab.interstitial.url &&
        !e.url.startsWith('data:') && !e.url.startsWith('about:blank') && e.url !== tab.interstitial.url.replace(/^http:/, 'https:')) {
      tab.interstitial = null;
      if (tab.id === activeId) { renderInterstitial(); updateToolbar(); }
    }
    if (e.isMainFrame && !e.isSameDocument) {
      tab.blocked = 0;
      if (tab.id === activeId) updateShield();
    }
  });

  wv.addEventListener('page-title-updated', (e) => {
    tab.title = e.title || displayUrl(tab.url) || 'Nouvel onglet';
    renderTab(tab);
    if (tab.id === activeId) document.title = tab.title + " — Maxou's Nav";
    saveSession();
  });

  wv.addEventListener('page-favicon-updated', (e) => {
    if (e.favicons && e.favicons.length) {
      tab.favicon = e.favicons[0];
      renderTab(tab);
      saveSession();
    }
  });

  const onNav = (e) => {
    if (e.isMainFrame === false) return;
    if (e.url.startsWith('data:') && tab.errorUrl) { tab.url = tab.errorUrl; tab.errorUrl = null; }
    else {
      if (tab.url !== e.url && e.type !== 'did-navigate-in-page') tab.favicon = null;
      tab.url = e.url;
    }
    if (isNewtab(tab.url)) tab.title = 'Nouvel onglet';
    paintBg();
    renderTab(tab);
    if (tab.id === activeId) updateToolbar();
    saveSession();
  };
  wv.addEventListener('did-navigate', onNav);
  wv.addEventListener('did-navigate-in-page', onNav);

  wv.addEventListener('did-fail-load', (e) => {
    if (!e.isMainFrame || e.errorCode === -3) return; // -3 : navigation annulée
    if (tab.interstitial) return; // une page d'alerte de sécurité est déjà affichée
    tab.errorUrl = e.validatedURL || tab.url;
    const html = errorPage(tab.errorUrl, e.errorDescription || 'Erreur inconnue');
    wv.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html)).catch(() => {});
  });

  wv.addEventListener('media-started-playing', () => { tab.audible = true; renderTab(tab); });
  wv.addEventListener('media-paused', () => {
    setTimeout(() => {
      try { tab.audible = !!(tab.wv && tab.wv.isCurrentlyAudible()); } catch { tab.audible = false; }
      renderTab(tab);
    }, 400);
  });

  wv.addEventListener('enter-html-full-screen', () => document.body.classList.add('html-fs'));
  wv.addEventListener('leave-html-full-screen', () => document.body.classList.remove('html-fs'));

  wv.addEventListener('found-in-page', (e) => {
    const r = e.result;
    if (r.finalUpdate !== false) $('find-count').textContent = r.matches ? `${r.activeMatchOrdinal}/${r.matches}` : '0/0';
  });

  wv.addEventListener('close', () => closeTab(tab.id));
}

function errorPage(url, msg) {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Page inaccessible</title><style>
  body{margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:#0B0C14;color:#ECEEF6;font-family:"Segoe UI",system-ui,sans-serif}
  .c{max-width:520px;padding:24px}.e{font-size:56px;margin-bottom:8px}
  h1{font-weight:600;font-size:26px;margin:0 0 12px;background:linear-gradient(135deg,#8B5CF6,#6366F1 50%,#22D3EE);-webkit-background-clip:text;color:transparent}
  code{color:#8E93AD;word-break:break-all;font-size:13px}p{color:#B4B8CC;line-height:1.5}
  .m{display:inline-block;margin-top:6px;padding:3px 10px;border-radius:8px;background:#1B1E31;color:#8E93AD;font-size:12px}
  </style></head><body><div class="c"><div class="e">🛰️</div><h1>Impossible d'afficher cette page</h1>
  <code>${esc(url)}</code><p>Vérifie ta connexion Internet ou l'adresse saisie, puis appuie sur F5.</p>
  <span class="m">${esc(msg)}</span></div></body></html>`;
}

const activeTab = () => tabs.find((t) => t.id === activeId);
const tabByWcId = (id) => tabs.find((t) => t.wcId === id);

function activateTab(id) {
  const prev = activeTab();
  if (prev) prev.lastActive = Date.now();
  activeId = id;
  const tab = activeTab();
  if (!tab) return;
  if (!tab.wv) spawnWebview(tab);
  tab.lastActive = Date.now();
  for (const t of tabs) {
    const on = t.id === id;
    t.el.classList.toggle('active', on);
    if (t.wv) t.wv.classList.toggle('active', on);
  }
  const internal = isInternal(tab.url);
  $('settings-view').hidden = !internal;
  renderInterstitial();
  if (internal) window.renderSettings && window.renderSettings(tab.url.split('#')[1]);
  if (tab.wcId) api.ext.tabSelected(tab.wcId);
  document.title = tab.title + " — Maxou's Nav";
  tab.el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  closeFind();
  hideSuggestions();
  updateToolbar();
  updateShield();
  if (isNewtab(tab.url)) focusAddress();
  else if (document.activeElement === address && tab.wv) tab.wv.focus();
  saveSession();
}

function closeTab(id) {
  const i = tabs.findIndex((t) => t.id === id);
  if (i < 0) return;
  const [t] = tabs.splice(i, 1);
  if (!isNewtab(t.url)) closedTabs.push({ url: t.url, title: t.title, favicon: t.favicon, index: i });
  t.el.remove();
  if (t.wv) t.wv.remove();
  if (tabs.length === 0) { createTab(HOME); return; }
  if (id === activeId) activateTab(tabs[Math.min(i, tabs.length - 1)].id);
  layoutTabs();
  saveSession();
}

function cycleTab(dir) {
  if (tabs.length < 2) return;
  const i = tabs.findIndex((t) => t.id === activeId);
  activateTab(tabs[(i + dir + tabs.length) % tabs.length].id);
}

// Glisser-déposer pour réordonner les onglets
let dragTab = null;
function setupTabDrag(tab) {
  const el = tab.el;
  el.addEventListener('dragstart', (e) => { dragTab = tab; el.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
  el.addEventListener('dragend', () => { el.classList.remove('dragging'); dragTab = null; saveSession(); });
  el.addEventListener('dragover', (e) => {
    if (!dragTab || dragTab === tab) return;
    e.preventDefault();
    const r = el.getBoundingClientRect();
    const after = e.clientX > r.left + r.width / 2;
    tabsEl.insertBefore(dragTab.el, after ? el.nextSibling : el);
    tabs.splice(tabs.indexOf(dragTab), 1);
    tabs.splice([...tabsEl.children].indexOf(dragTab.el), 0, dragTab);
  });
}

// ================= Session (onglets restaurés au démarrage) =================
let sessionTimer = null;
function saveSession() {
  clearTimeout(sessionTimer);
  sessionTimer = setTimeout(() => {
    const data = {
      tabs: tabs.map((t) => ({ url: t.url, title: t.title, favicon: t.favicon })),
      active: tabs.findIndex((t) => t.id === activeId)
    };
    try { localStorage.setItem('maxou.session', JSON.stringify(data)); } catch {}
  }, 500);
}

function restoreSession() {
  let data = null;
  try { data = JSON.parse(localStorage.getItem('maxou.session')); } catch {}
  const list = (data && Array.isArray(data.tabs)) ? data.tabs.filter((t) => t && t.url && !t.url.startsWith('data:')) : [];
  if (!list.length) { createTab(HOME); return; }
  const active = Math.max(0, Math.min(list.length - 1, data.active | 0));
  list.forEach((t, i) => {
    const url = isNewtab(t.url) ? HOME : t.url; // le chemin de l'appli peut changer
    // Seul l'onglet actif est chargé : démarrage instantané
    createTab(url, { activate: false, asleep: i !== active, title: t.title, favicon: t.favicon });
  });
  activateTab(tabs[active].id);
}

// ================= Barre d'outils =================
const safe = (fn, fb) => { try { return fn(); } catch { return fb; } };

function updateToolbar() {
  const t = activeTab();
  if (!t) return;
  const wv = t.wv;
  backBtn.disabled = !(wv && safe(() => wv.canGoBack(), false));
  fwdBtn.disabled = !(wv && safe(() => wv.canGoForward(), false));
  reloadBtn.classList.toggle('loading', t.loading);
  reloadBtn.title = t.loading ? 'Arrêter (Échap)' : 'Actualiser (F5)';

  if (document.activeElement !== address) address.value = displayUrl(t.url);

  let url = t.url || '';
  if (t.interstitial) url = t.interstitial.url;
  siteIcon.className = t.interstitial ? (t.interstitial.kind === 'http' ? 'warn' : 'danger') : isNewtab(url) ? 'search' : url.startsWith('https://') ? 'lock' : url.startsWith('http://') ? 'warn' : 'search';
  if (t.interstitial && document.activeElement !== address) address.value = url;
  siteIcon.title = siteIcon.className === 'lock' ? 'Connexion sécurisée' : siteIcon.className === 'warn' ? 'Connexion non sécurisée — n\'y tape pas de mot de passe' : siteIcon.className === 'danger' ? 'Site dangereux' : '';

  const starOk = /^https?:/i.test(url);
  $('star').hidden = !starOk;
  $('star').classList.toggle('on', starOk && !!findBookmark(url));
  $('star').title = findBookmark(url) ? 'Modifier ce favori' : 'Ajouter aux favoris (Ctrl+D)';

  const pct = Math.round(Math.pow(1.2, t.zoom) * 100);
  zoomChip.textContent = t.zoom === 0 ? '' : pct + ' %';
  $('menu-zoom').textContent = pct + ' %';

  progress.classList.remove('loading', 'done');
  void progress.offsetWidth;
  progress.classList.add(t.loading ? 'loading' : 'done');
}

function focusAddress() {
  address.focus();
  address.select();
}

async function navigate(text) {
  const t = activeTab();
  if (!t) return;
  hideSuggestions();
  let url = toUrl(text);
  if (/^https?:/i.test(url)) {
    try {
      // (le passage en HTTPS est fait par le système, qui sait revenir en arrière si besoin)
      const c = await api.security.check(url);
      if (c.action === 'danger' && t.wv && t.wcId) {
        t.interstitial = { kind: 'danger', url, wcId: t.wcId };
        address.blur();
        renderInterstitial();
        updateToolbar();
        return;
      }
    } catch {}
  }
  if (isInternal(url)) { openSettings(url.split('#')[1]); address.blur(); return; }
  const wasInternal = isInternal(t.url);
  t.url = url;
  if (wasInternal) { t.title = displayUrl(url); renderTab(t); }
  if (!t.wv) { spawnWebview(t); if (wasInternal) activateTab(t.id); }
  else t.wv.loadURL(url).catch(() => {});
  address.blur();
  if (t.wv) t.wv.focus();
  updateToolbar();
}

function setZoom(delta) {
  const t = activeTab();
  if (!t || !t.wv) return;
  t.zoom = delta === null ? 0 : Math.max(-5, Math.min(8, t.zoom + delta));
  t.wv.setZoomLevel(t.zoom);
  updateToolbar();
}

// ================= Suggestions Google dans la barre d'adresse =================
let sugItems = [];
let sugIndex = -1;
let sugTyped = '';
let sugSeq = 0;

const ICON_SEARCH_SM = '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></svg>';
const ICON_GO_SM = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 3.6 5.4 3.6 8.5s-1.1 5.9-3.6 8.5c-2.5-2.6-3.6-5.4-3.6-8.5s1.1-5.9 3.6-8.5z"/></svg>';

function renderSuggestions() {
  if (!sugItems.length) { hideSuggestions(); return; }
  sugEl.innerHTML = '';
  sugItems.forEach((s, i) => {
    const li = document.createElement('li');
    if (i === sugIndex) li.className = 'sel';
    const isUrl = !toUrl(s).startsWith(SEARCH);
    li.innerHTML = (isUrl ? ICON_GO_SM : ICON_SEARCH_SM) + '<span class="txt"></span>' +
      (i === 0 ? `<span class="hint">${isUrl ? 'Ouvrir' : 'Recherche Google'}</span>` : '');
    const txt = li.querySelector('.txt');
    const q = sugTyped.toLowerCase();
    if (i > 0 && s.toLowerCase().startsWith(q) && q) {
      txt.append(document.createTextNode(s.slice(0, q.length)));
      const b = document.createElement('b'); b.textContent = s.slice(q.length); txt.append(b);
    } else txt.textContent = s;
    li.addEventListener('mousedown', (e) => { e.preventDefault(); navigate(s); });
    sugEl.appendChild(li);
  });
  sugEl.hidden = false;
  omnibox.classList.add('open');
}
function hideSuggestions() {
  sugEl.hidden = true;
  omnibox.classList.remove('open');
  sugItems = []; sugIndex = -1;
}

let sugTimer = null;
address.addEventListener('input', () => {
  sugTyped = address.value;
  sugIndex = -1;
  const q = sugTyped.trim();
  if (!q) { hideSuggestions(); return; }
  sugItems = [q];
  renderSuggestions();
  clearTimeout(sugTimer);
  const seq = ++sugSeq;
  sugTimer = setTimeout(async () => {
    const list = await api.suggest(q);
    if (seq !== sugSeq || document.activeElement !== address) return;
    sugItems = [q, ...list.filter((s) => s.toLowerCase() !== q.toLowerCase())].slice(0, 7);
    renderSuggestions();
  }, 90);
});

address.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    if (!sugItems.length) return;
    e.preventDefault();
    sugIndex = (sugIndex + (e.key === 'ArrowDown' ? 1 : -1) + sugItems.length + 1) % (sugItems.length + 1);
    if (sugIndex === sugItems.length) sugIndex = -1;
    address.value = sugIndex < 0 ? sugTyped : sugItems[sugIndex];
    renderSuggestions();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    navigate(address.value);
  } else if (e.key === 'Escape') {
    if (!sugEl.hidden) { hideSuggestions(); address.value = sugTyped; return; }
    updateToolbarAddress();
    address.blur();
    const t = activeTab(); if (t && t.wv) t.wv.focus();
  }
});
function updateToolbarAddress() { const t = activeTab(); if (t) address.value = displayUrl(t.url); }

address.addEventListener('focus', () => { omnibox.classList.add('focused'); setTimeout(() => address.select(), 0); });
address.addEventListener('blur', () => {
  omnibox.classList.remove('focused');
  hideSuggestions();
  updateToolbarAddress();
});
$('omnibox').addEventListener('mousedown', (e) => { if (e.target !== address && e.target.id !== 'zoom-chip') { e.preventDefault(); address.focus(); } });

// ================= Recherche dans la page =================
const findbar = $('findbar');
const findInput = $('find-input');
function openFind() { closePops(); findbar.hidden = false; findInput.focus(); findInput.select(); if (findInput.value) doFind(true, false); }
function closeFind() {
  if (findbar.hidden) return;
  findbar.hidden = true;
  $('find-count').textContent = '';
  const t = activeTab();
  if (t && t.wv) safe(() => t.wv.stopFindInPage('clearSelection'));
}
function doFind(forward = true, findNext = true) {
  const t = activeTab();
  if (!t || !t.wv) return;
  const q = findInput.value;
  if (!q) { safe(() => t.wv.stopFindInPage('clearSelection')); $('find-count').textContent = ''; return; }
  t.wv.findInPage(q, { forward, findNext });
}
findInput.addEventListener('input', () => doFind(true, false));
findInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doFind(!e.shiftKey, true);
  if (e.key === 'Escape') closeFind();
});
$('find-next').onclick = () => doFind(true, true);
$('find-prev').onclick = () => doFind(false, true);
$('find-close').onclick = closeFind;

// ================= Popovers (bloqueur, menu, téléchargements) =================
const pops = { shield: $('shield-pop'), menu: $('menu-pop'), dl: $('dl-pop') };
function closePops(except) {
  for (const [k, el] of Object.entries(pops)) if (k !== except) el.hidden = true;
}
function togglePop(name, anchor) {
  const el = pops[name];
  const open = el.hidden;
  closePops();
  if (!open) return;
  el.hidden = false;
  const r = anchor.getBoundingClientRect();
  el.style.top = (r.bottom + 6) + 'px';
  el.style.right = Math.max(8, window.innerWidth - r.right - 4) + 'px';
}
document.addEventListener('mousedown', (e) => {
  if (!e.target.closest('.pop') && !e.target.closest('#shield, #menu-btn, #dl-btn')) closePops();
});
// Un clic dans la page ferme aussi les menus
window.addEventListener('blur', () => setTimeout(() => { if (document.activeElement && document.activeElement.tagName === 'WEBVIEW') closePops(); }, 0));

// ---- Bloqueur de pubs ----
function updateShield() {
  const t = activeTab();
  const on = adblock.enabled;
  shieldBtn.classList.toggle('on', on);
  const n = t ? t.blocked : 0;
  shieldBadge.textContent = on && n ? (n > 99 ? '99+' : String(n)) : '';
  shieldBtn.title = on ? `Bloqueur de pubs : ${n} élément(s) bloqué(s) sur cette page` : 'Bloqueur de pubs désactivé';
  $('shield-toggle').checked = on;
  pops.shield.classList.toggle('off', !on);
  $('shield-status').textContent = !adblock.ready && on ? 'Démarrage…' : on ? 'Actif — tu es protégé' : 'Désactivé';
  $('stat-page').textContent = n.toLocaleString('fr-FR');
  $('stat-total').textContent = (adblock.total || 0).toLocaleString('fr-FR');
}
shieldBtn.onclick = () => { updateShield(); togglePop('shield', shieldBtn); };
$('shield-toggle').addEventListener('change', async (e) => {
  adblock = await api.adblock.set(e.target.checked);
  updateShield();
  const t = activeTab();
  if (t && t.wv) t.wv.reload();
});
api.on('adblock:blocked', (wcId) => {
  adblock.total++;
  const t = tabByWcId(wcId);
  if (t) { t.blocked++; if (t.id === activeId) scheduleShield(); }
});
let shieldRaf = 0;
function scheduleShield() { if (!shieldRaf) shieldRaf = requestAnimationFrame(() => { shieldRaf = 0; updateShield(); }); }
api.on('adblock:state', (s) => { adblock = s; updateShield(); });
api.adblock.get().then((s) => { adblock = s; updateShield(); });

// ---- Menu ----
$('menu-btn').onclick = () => { updateToolbar(); togglePop('menu', $('menu-btn')); };
pops.menu.addEventListener('click', (e) => {
  const b = e.target.closest('[data-cmd]');
  if (!b) return;
  const cmd = b.dataset.cmd;
  if (!cmd.startsWith('zoom')) closePops();
  runCommand(cmd);
});

// ---- Téléchargements ----
const dlState = new Map();
const dlBtn = $('dl-btn');
function fmtBytes(n) {
  if (!n) return '0 o';
  const u = ['o', 'Ko', 'Mo', 'Go']; let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return n.toFixed(i && n < 10 ? 1 : 0).replace('.', ',') + ' ' + u[i];
}
function renderDownloads() {
  const list = $('dl-list');
  if (!dlState.size) { list.innerHTML = '<p class="empty">Aucun téléchargement pour l\'instant.</p>'; return; }
  list.innerHTML = '';
  for (const d of [...dlState.values()].reverse()) {
    const item = document.createElement('div');
    item.className = 'dl-item ' + (d.state === 'completed' ? 'done' : (d.state === 'cancelled' || d.state === 'interrupted') ? 'failed' : '');
    const pct = d.total ? Math.round(d.received / d.total * 100) : 0;
    let meta;
    if (d.state === 'completed') meta = fmtBytes(d.total || d.received) + ' — Terminé';
    else if (d.state === 'cancelled') meta = 'Annulé';
    else if (d.state === 'interrupted') meta = 'Échec du téléchargement';
    else meta = `${fmtBytes(d.received)}${d.total ? ' sur ' + fmtBytes(d.total) : ''}${d.state === 'paused' ? ' — En pause' : ''}`;
    item.innerHTML = `<div class="dl-name"></div>
      <div class="dl-actions"></div>
      <div class="dl-meta"></div>
      <div class="dl-bar"><i style="width:${pct}%"></i></div>`;
    item.querySelector('.dl-name').textContent = d.name;
    item.querySelector('.dl-meta').textContent = meta;
    const actions = item.querySelector('.dl-actions');
    const btn = (title, svg, fn) => {
      const b = document.createElement('button');
      b.className = 'icon-btn sm'; b.title = title; b.innerHTML = svg; b.onclick = fn;
      actions.appendChild(b);
    };
    if (d.state === 'completed') {
      item.querySelector('.dl-name').onclick = () => api.download.open(d.id);
      btn('Afficher dans le dossier', '<svg viewBox="0 0 24 24"><path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/></svg>', () => api.download.show(d.id));
    } else if (d.state === 'progressing' || d.state === 'paused') {
      btn('Annuler', ICON_X, () => api.download.cancel(d.id));
    }
    list.appendChild(item);
  }
}
function updateDlButton() {
  const active = [...dlState.values()].filter((d) => d.state === 'progressing' || d.state === 'paused');
  dlBtn.classList.toggle('active', active.length > 0);
  if (active.length) {
    const rec = active.reduce((a, d) => a + d.received, 0);
    const tot = active.reduce((a, d) => a + (d.total || 0), 0);
    dlBtn.style.setProperty('--p', (tot ? Math.round(rec / tot * 100) : 5) + '%');
  }
}
api.on('download', (d) => {
  const isNew = !dlState.has(d.id);
  dlState.set(d.id, d);
  updateDlButton();
  if (!pops.dl.hidden) renderDownloads();
  if (isNew) toast(`Téléchargement de « ${d.name} »…`);
  if (d.state === 'completed') {
    dlBtn.classList.add('done');
    setTimeout(() => dlBtn.classList.remove('done'), 4000);
    toast(`✓ « ${d.name} » est dans Téléchargements`);
  }
});
dlBtn.onclick = () => { renderDownloads(); togglePop('dl', dlBtn); };
$('dl-open-folder').onclick = () => api.download.folder();

// ---- Petites notifications ----
let toastTimer = null;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2800);
}

// ---- Mises à jour ----
let upd = { status: 'idle' };
const updBtn = $('update-btn');
function renderUpdate() {
  // Bouton dans la barre (comme Chrome)
  if (upd.status === 'ready') {
    updBtn.hidden = false;
    $('update-label').textContent = 'Redémarrer pour mettre à jour';
    updBtn.title = `La version ${upd.version} est prête`;
  } else if (upd.status === 'available') {
    updBtn.hidden = false;
    $('update-label').textContent = `Nouvelle version ${upd.version}`;
    updBtn.title = 'Télécharger la nouvelle version';
  } else updBtn.hidden = true;

  // Fenêtre À propos
  const box = $('about-update');
  const bar = box.querySelector('.about-bar');
  box.className = '';
  bar.hidden = true;
  let txt;
  switch (upd.status) {
    case 'checking': txt = 'Recherche de mises à jour…'; break;
    case 'uptodate': txt = '✓ Maxou\'s Nav est à jour'; box.className = 'ok'; break;
    case 'downloading':
      txt = `Téléchargement de la version ${upd.version}… ${Math.round((upd.progress || 0) * 100)} %`;
      bar.hidden = false; bar.firstElementChild.style.width = Math.round((upd.progress || 0) * 100) + '%';
      break;
    case 'ready': txt = `✓ Version ${upd.version} prête — redémarre pour l'installer`; box.className = 'ok'; break;
    case 'available': txt = `Version ${upd.version} disponible (version portable : à télécharger)`; break;
    case 'error': txt = 'Impossible de vérifier les mises à jour pour le moment'; box.className = 'err'; break;
    case 'dev': txt = 'Mises à jour désactivées (mode développement)'; break;
    case 'disabled': txt = 'Mises à jour non configurées'; break;
    default: txt = 'Mises à jour automatiques activées';
  }
  $('about-update-text').textContent = txt;
  const chk = $('about-check');
  chk.disabled = upd.status === 'checking' || upd.status === 'downloading';
  chk.textContent = upd.status === 'ready' ? 'Redémarrer maintenant' : 'Rechercher des mises à jour';
}
api.on('update', (s) => {
  const wasReady = upd.status === 'ready';
  upd = s;
  renderUpdate();
  if (s.status === 'ready' && !wasReady) toast(`✨ Maxou's Nav ${s.version} est prêt — clique sur « Redémarrer pour mettre à jour »`);
  if (s.manual && s.status === 'uptodate') toast('✓ Maxou\'s Nav est à jour');
});
api.update.get().then((s) => { upd = s; renderUpdate(); });
updBtn.onclick = () => {
  if (upd.status === 'ready') api.update.install();
  else if (upd.status === 'available' && upd.page) createTab(upd.page);
};
$('about-check').onclick = () => {
  if (upd.status === 'ready') api.update.install();
  else api.update.check();
};

// ---- À propos ----
async function showAbout() {
  const i = await api.info();
  $('about-version').textContent = `Version ${i.version} · Chromium ${i.chrome.split('.')[0]}`;
  renderUpdate();
  $('about').hidden = false;
}
$('about-close').onclick = () => { $('about').hidden = true; };
$('about').addEventListener('mousedown', (e) => { if (e.target.id === 'about') $('about').hidden = true; });

// ================= Boutons =================
$('new-tab').onclick = () => createTab();
backBtn.onclick = () => runCommand('back');
fwdBtn.onclick = () => runCommand('forward');
reloadBtn.onclick = () => { const t = activeTab(); if (t && t.wv) (t.loading ? t.wv.stop() : t.wv.reload()); };
$('home').onclick = () => runCommand('home');
zoomChip.onclick = () => setZoom(null);
$('titlebar').addEventListener('dblclick', (e) => {
  if (e.target.id === 'tabs') createTab();
});

// ================= Commandes (clavier + menu) =================
function runCommand(cmd) {
  const t = activeTab();
  const wv = t && t.wv;
  switch (cmd) {
    case 'new-tab': createTab(); break;
    case 'close-tab': if (t) closeTab(t.id); break;
    case 'reopen-tab': {
      const c = closedTabs.pop();
      if (c) { const nt = createTab(c.url, { title: c.title, favicon: c.favicon, index: c.index }); activateTab(nt.id); }
      break;
    }
    case 'next-tab': cycleTab(1); break;
    case 'prev-tab': cycleTab(-1); break;
    case 'focus-address': focusAddress(); break;
    case 'reload': if (wv) wv.reload(); else if (t && isInternal(t.url)) window.renderSettings(); break;
    case 'hard-reload': if (wv) wv.reloadIgnoringCache(); break;
    case 'back': if (wv && safe(() => wv.canGoBack(), false)) wv.goBack(); break;
    case 'forward': if (wv && safe(() => wv.canGoForward(), false)) wv.goForward(); break;
    case 'home': navigate(homeUrl()); break;
    case 'settings': openSettings(); break;
    case 'extensions': openSettings('extensions'); break;
    case 'webstore': createTab(WEBSTORE); break;
    case 'bookmark': if (t && /^https?:/i.test(t.url)) openBookmarkPop(); break;
    case 'toggle-bookmarks-bar': savePrefs({ showBookmarksBar: !prefs.showBookmarksBar }); break;
    case 'find': openFind(); break;
    case 'downloads': renderDownloads(); togglePop('dl', dlBtn); break;
    case 'dl-folder': api.download.folder(); break;
    case 'zoom-in': setZoom(1); break;
    case 'zoom-out': setZoom(-1); break;
    case 'zoom-reset': setZoom(null); break;
    case 'fullscreen': api.toggleFullscreen(); break;
    case 'devtools': if (wv) (wv.isDevToolsOpened() ? wv.closeDevTools() : wv.openDevTools()); break;
    case 'about': showAbout(); break;
    case 'check-update': showAbout(); api.update.check(); break;
    case 'escape':
      if (!$('clear-dlg').hidden) $('clear-dlg').hidden = true;
      else if (!$('about').hidden) $('about').hidden = true;
      else if (!Object.values(pops).every((p) => p.hidden)) closePops();
      else if (!$('bm-pop').hidden || !$('ctx').hidden) { $('bm-pop').hidden = true; $('ctx').hidden = true; }
      else if (!findbar.hidden) closeFind();
      else if (t && t.loading && wv) wv.stop();
      break;
    default:
      if (cmd.startsWith('tab-')) {
        const n = parseInt(cmd.slice(4), 10);
        const target = n === 9 ? tabs[tabs.length - 1] : tabs[n - 1];
        if (target) activateTab(target.id);
      }
  }
}

api.on('cmd', runCommand);
api.on('open-tab', (url, foreground) => {
  const tab = createTab(url || HOME, { activate: !!foreground, index: url ? tabs.indexOf(activeTab()) + 1 : undefined });
  if (!foreground) toast('Ouvert dans un nouvel onglet');
  return tab;
});

// ================= Pages d'alerte (sites dangereux, site sans HTTPS) =================
const INT_TEXT = {
  danger: {
    title: 'Site dangereux bloqué',
    text: 'Ce site est signalé pour hameçonnage (faux site qui vole les mots de passe et les cartes bancaires) ou pour diffusion de logiciels malveillants. Maxou\'s Nav l\'a bloqué avant qu\'il ne s\'affiche.',
    more: 'Le site figure sur les listes publiques de sites malveillants (Phishing URL Blocklist et URLhaus, mises à jour plusieurs fois par jour). Si tu es certain qu\'il s\'agit d\'une erreur, tu peux continuer, mais ne saisis jamais de mot de passe ni de carte bancaire sur une page arrivée par un lien inattendu.',
    proceed: 'Je comprends le risque, ouvrir quand même'
  },
  http: {
    title: 'Ce site n\'a pas de connexion sécurisée',
    text: 'Maxou\'s Nav a essayé d\'ouvrir la version sécurisée (HTTPS) de ce site, sans succès. Sur la version non sécurisée, ce que tu envoies (mots de passe, messages…) peut être lu ou modifié par d\'autres personnes sur le réseau.',
    more: 'Si tu continues, n\'y saisis aucun mot de passe ni information personnelle.',
    proceed: 'Continuer vers la version non sécurisée'
  }
};
function renderInterstitial() {
  const t = activeTab();
  const el = $('interstitial');
  const it = t && t.interstitial;
  el.hidden = !it;
  if (!it) return;
  const tx = INT_TEXT[it.kind] || INT_TEXT.danger;
  el.className = it.kind;
  $('int-title').textContent = tx.title;
  $('int-text').textContent = tx.text;
  $('int-url').textContent = it.url;
  $('int-more').textContent = tx.more;
  $('int-proceed').textContent = tx.proceed;
  $('int-details').open = false;
}
api.on('security:interstitial', ({ wcId, kind, url }) => {
  const t = tabByWcId(wcId);
  if (!t) return;
  t.interstitial = { kind, url, wcId };
  t.loading = false;
  renderTab(t);
  if (t.id === activeId) { renderInterstitial(); updateToolbar(); }
});
$('int-back').onclick = () => {
  const t = activeTab();
  if (!t) return;
  t.interstitial = null;
  renderInterstitial();
  if (t.wv && safe(() => t.wv.canGoBack(), false)) t.wv.goBack();
  else if (t.wv) t.wv.loadURL(NEWTAB).catch(() => {});
  updateToolbar();
};
$('int-proceed').onclick = () => {
  const t = activeTab();
  if (!t || !t.interstitial) return;
  const { kind, url } = t.interstitial;
  t.interstitial = null;
  renderInterstitial();
  if (t.wcId) api.security.proceed(t.wcId, kind, url);
  updateToolbar();
};

// ================= Effacer les données de navigation =================
function openClearDialog() { $('clear-dlg').hidden = false; }
$('clr-cancel').onclick = () => { $('clear-dlg').hidden = true; };
$('clear-dlg').addEventListener('mousedown', (e) => { if (e.target.id === 'clear-dlg') $('clear-dlg').hidden = true; });
$('clr-go').onclick = async () => {
  const what = { cache: $('clr-cache').checked, cookies: $('clr-cookies').checked, permissions: $('clr-perms').checked };
  $('clear-dlg').hidden = true;
  await api.data.clear(what);
  toast('✓ Données effacées');
  if (window.renderSettings && activeTab() && isInternal(activeTab().url)) window.renderSettings();
};

// ================= Paramètres / préférences =================
function savePrefs(patch) {
  prefs = { ...prefs, ...patch };
  applyPrefs();
  return api.prefs.set(patch);
}
function applyPrefs() {
  $('home').hidden = prefs.showHome === false;
  $('bookmarks-bar').hidden = !prefs.showBookmarksBar;
  $('menu-bm-label').textContent = prefs.showBookmarksBar ? 'Masquer la barre de favoris' : 'Afficher la barre de favoris';
  renderBookmarksBar();
  updateToolbar();
  const t = activeTab();
  if (t && isInternal(t.url) && window.renderSettings) window.renderSettings();
}
api.on('prefs', (p) => { prefs = p; applyPrefs(); });

function openSettings(section) {
  const url = SETTINGS_URL + (section ? '#' + section : '');
  const existing = tabs.find((t) => isInternal(t.url));
  if (existing) { existing.url = url; activateTab(existing.id); window.renderSettings && window.renderSettings(section); }
  else createTab(url);
}

// ================= Favoris =================
const bmId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const normUrl = (u) => (u || '').replace(/#.*$/, '').replace(/\/$/, '');
function findBookmark(url) { return (prefs.bookmarks || []).find((b) => normUrl(b.url) === normUrl(url)); }

function bmIcon(b) {
  return b.favicon ? `<img src="${escapeAttr(b.favicon)}" alt="">` : ICON_GLOBE;
}

function renderBookmarksBar() {
  const box = $('bm-items');
  box.innerHTML = '';
  const list = prefs.bookmarks || [];
  if (!list.length) {
    box.innerHTML = '<span class="bm-empty">Pour ajouter un favori, clique sur l\'étoile ☆ dans la barre d\'adresse ou appuie sur Ctrl+D.</span>';
    $('bm-more').hidden = true;
    return;
  }
  for (const b of list) {
    const el = document.createElement('button');
    el.className = 'bm';
    el.title = `${b.title}\n${b.url}`;
    el.draggable = true;
    el.innerHTML = bmIcon(b) + '<span></span>';
    el.querySelector('span').textContent = b.title || b.url;
    const img = el.querySelector('img');
    if (img) img.onerror = () => { img.outerHTML = ICON_GLOBE; };
    el.addEventListener('click', (e) => {
      if (e.ctrlKey) createTab(b.url, { activate: false });
      else navigate(b.url);
    });
    el.addEventListener('auxclick', (e) => { if (e.button === 1) { e.preventDefault(); createTab(b.url, { activate: false }); } });
    el.addEventListener('contextmenu', (e) => { e.preventDefault(); bookmarkMenu(b, e.clientX, e.clientY); });
    // Glisser pour réordonner
    el.addEventListener('dragstart', () => { el.classList.add('dragging'); el.dataset.dragId = b.id; dragBm = b.id; });
    el.addEventListener('dragend', () => { el.classList.remove('dragging'); dragBm = null; });
    el.addEventListener('dragover', (e) => { if (dragBm && dragBm !== b.id) e.preventDefault(); });
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      const arr = [...prefs.bookmarks];
      const from = arr.findIndex((x) => x.id === dragBm);
      const to = arr.findIndex((x) => x.id === b.id);
      if (from < 0 || to < 0) return;
      const [m] = arr.splice(from, 1);
      arr.splice(to, 0, m);
      savePrefs({ bookmarks: arr });
    });
    box.appendChild(el);
  }
  requestAnimationFrame(layoutBookmarks);
}
let dragBm = null;
function layoutBookmarks() {
  const box = $('bm-items');
  const items = [...box.querySelectorAll('.bm')];
  items.forEach((i) => i.classList.remove('hide'));
  const limit = box.getBoundingClientRect().right;
  let hidden = 0;
  for (const i of items) if (i.getBoundingClientRect().right > limit + 1) { i.classList.add('hide'); hidden++; }
  $('bm-more').hidden = hidden === 0;
}
window.addEventListener('resize', () => requestAnimationFrame(layoutBookmarks));
$('bm-more').onclick = (e) => {
  const hiddenOnes = (prefs.bookmarks || []).filter((b, i) => $('bm-items').children[i] && $('bm-items').children[i].classList.contains('hide'));
  const r = e.currentTarget.getBoundingClientRect();
  showCtx(hiddenOnes.map((b) => ({ label: b.title || b.url, click: () => navigate(b.url) })), r.right - 240, r.bottom + 4);
};

function showCtx(items, x, y) {
  const ctx = $('ctx');
  ctx.innerHTML = '';
  for (const it of items) {
    if (it.sep) { const d = document.createElement('div'); d.className = 'sep'; ctx.appendChild(d); continue; }
    const b = document.createElement('button');
    b.textContent = it.label;
    if (it.danger) b.className = 'danger';
    b.onclick = () => { ctx.hidden = true; it.click(); };
    ctx.appendChild(b);
  }
  ctx.hidden = false;
  const w = ctx.offsetWidth, h = ctx.offsetHeight;
  ctx.style.left = Math.max(8, Math.min(x, innerWidth - w - 8)) + 'px';
  ctx.style.top = Math.max(8, Math.min(y, innerHeight - h - 8)) + 'px';
}
document.addEventListener('mousedown', (e) => {
  if (!e.target.closest('#ctx')) $('ctx').hidden = true;
  if (!e.target.closest('#bm-pop') && !e.target.closest('#star')) $('bm-pop').hidden = true;
});

function bookmarkMenu(b, x, y) {
  showCtx([
    { label: 'Ouvrir', click: () => navigate(b.url) },
    { label: 'Ouvrir dans un nouvel onglet', click: () => createTab(b.url) },
    { sep: true },
    { label: 'Modifier…', click: () => openBookmarkPop(b) },
    { label: 'Supprimer', danger: true, click: () => removeBookmark(b.id) }
  ], x, y);
}

function removeBookmark(id) {
  savePrefs({ bookmarks: prefs.bookmarks.filter((b) => b.id !== id) });
  toast('Favori supprimé');
}

let editingBm = null;
function openBookmarkPop(existing) {
  const t = activeTab();
  let b = existing || (t && findBookmark(t.url));
  let isNew = false;
  if (!b) {
    if (!t || !/^https?:/i.test(t.url)) return;
    b = { id: bmId(), title: t.title || displayUrl(t.url), url: t.url, favicon: t.favicon || null };
    savePrefs({ bookmarks: [...(prefs.bookmarks || []), b] });
    isNew = true;
  }
  editingBm = b.id;
  $('bm-pop-title').textContent = isNew ? 'Favori ajouté ✓' : 'Modifier le favori';
  $('bm-name').value = b.title || '';
  $('bm-url').value = b.url;
  const pop = $('bm-pop');
  closePops();
  pop.hidden = false;
  const r = (existing ? $('bookmarks-bar') : $('star')).getBoundingClientRect();
  pop.style.top = (r.bottom + 6) + 'px';
  pop.style.right = existing ? '' : Math.max(8, innerWidth - r.right - 10) + 'px';
  pop.style.left = existing ? '50%' : '';
  pop.style.transform = existing ? 'translateX(-50%)' : '';
  setTimeout(() => { $('bm-name').focus(); $('bm-name').select(); }, 0);
}
function saveBookmarkPop() {
  const arr = (prefs.bookmarks || []).map((b) => b.id === editingBm
    ? { ...b, title: $('bm-name').value.trim() || b.title, url: toUrl($('bm-url').value) } : b);
  savePrefs({ bookmarks: arr });
  $('bm-pop').hidden = true;
}
$('bm-save').onclick = saveBookmarkPop;
$('bm-delete').onclick = () => { $('bm-pop').hidden = true; removeBookmark(editingBm); };
[$('bm-name'), $('bm-url')].forEach((i) => i.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') saveBookmarkPop();
  if (e.key === 'Escape') $('bm-pop').hidden = true;
}));
$('star').onclick = (e) => { e.stopPropagation(); openBookmarkPop(); };

// ================= Extensions : onglets demandés par les extensions =================
api.on('ext:create-tab', ({ reqId, url, active }) => {
  const tab = createTab(url || HOME, { activate: active });
  const done = (wcId) => api.ext.tabCreated(reqId, wcId);
  if (tab.wcId) done(tab.wcId);
  else (tab.onAttach = tab.onAttach || []).push(done);
});
api.on('ext:select-tab', (wcId) => { const t = tabByWcId(wcId); if (t) activateTab(t.id); });
api.on('ext:remove-tab', (wcId) => { const t = tabByWcId(wcId); if (t) closeTab(t.id); });
api.on('toast', (msg) => toast(msg));

// ================= Démarrage =================
function startup() {
  if (prefs.startup === 'pages' && (prefs.startupPages || []).length) {
    prefs.startupPages.forEach((u, i) => createTab(toUrl(u), { activate: false, asleep: i > 0 }));
    activateTab(tabs[0].id);
  } else if (prefs.startup === 'newtab') {
    createTab(NEWTAB);
  } else {
    restoreSession();
  }
}
api.prefs.get().then((p) => { prefs = { ...prefs, ...p }; applyPrefs(); startup(); })
  .catch(() => startup());
