'use strict';
// Maxou's Nav — page Paramètres (maxou://parametres)

(() => {
  const view = document.getElementById('settings-view');
  let extCache = [];
  let currentSection = 'demarrage';

  const ICONS = {
    demarrage: '<svg viewBox="0 0 24 24"><path d="M12 3v9M6.3 7.3a8 8 0 1 0 11.4 0"/></svg>',
    accueil: '<svg viewBox="0 0 24 24"><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z"/></svg>',
    favoris: '<svg viewBox="0 0 24 24"><path d="m12 3.8 2.5 5.1 5.6.8-4 4 1 5.6-5.1-2.7-5 2.7 1-5.6-4.1-4 5.6-.8z"/></svg>',
    extensions: '<svg viewBox="0 0 24 24"><path d="M9 4.5a2 2 0 1 1 4 0V6h4a1 1 0 0 1 1 1v4h-1.5a2 2 0 1 0 0 4H18v4a1 1 0 0 1-1 1h-4v-1.5a2 2 0 1 0-4 0V20H5a1 1 0 0 1-1-1v-4h1.5a2 2 0 1 0 0-4H4V7a1 1 0 0 1 1-1h4z"/></svg>',
    confidentialite: '<svg viewBox="0 0 24 24"><path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6z"/></svg>',
    apropos: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8v.1"/></svg>'
  };
  const SECTIONS = [
    ['demarrage', 'Au démarrage'],
    ['accueil', 'Page d’accueil'],
    ['favoris', 'Favoris'],
    ['extensions', 'Extensions'],
    ['confidentialite', 'Confidentialité et sécurité'],
    ['apropos', 'À propos']
  ];

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const favFor = (url) => { try { return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32`; } catch { return ''; } };
  const imgOrGlobe = (src) => src ? `<img src="${esc(src)}" alt="">` : ICON_GLOBE;

  function radio(name, value, current, label, desc) {
    return `<label class="s-row"><input class="radio" type="radio" name="${name}" value="${value}" ${current === value ? 'checked' : ''}>
      <div class="s-text"><div class="s-label">${label}</div>${desc ? `<div class="s-desc">${desc}</div>` : ''}</div></label>`;
  }
  function toggle(id, on, label, desc) {
    return `<label class="s-row"><div class="s-text"><div class="s-label">${label}</div>${desc ? `<div class="s-desc">${desc}</div>` : ''}</div>
      <span class="switch"><input id="${id}" type="checkbox" ${on ? 'checked' : ''}><span></span></span></label>`;
  }

  function sectionDemarrage() {
    const pages = prefs.startupPages || [];
    return `<div class="s-section" id="s-demarrage"><h2>Au démarrage</h2><div class="s-card">
      ${radio('startup', 'newtab', prefs.startup, 'Ouvrir la page « Nouvel onglet »')}
      ${radio('startup', 'restore', prefs.startup, 'Reprendre où vous vous êtes arrêté', 'Tes onglets de la dernière fois sont rouverts.')}
      ${radio('startup', 'pages', prefs.startup, 'Ouvrir une page ou un ensemble de pages spécifiques')}
      <div class="s-sub" id="startup-pages" ${prefs.startup === 'pages' ? '' : 'hidden'}>
        <div class="s-list">${pages.length ? pages.map((u, i) => `
          <div class="s-item">${imgOrGlobe(favFor(toUrl(u)))}<span class="grow">${esc(u)}</span>
            <button class="icon-btn sm" data-del-page="${i}" title="Retirer">${ICON_X}</button></div>`).join('')
          : '<div class="s-empty">Aucune page pour l’instant.</div>'}</div>
        <div class="s-add"><input class="s-input" id="add-page" placeholder="Adresse de la page (ex. youtube.com)">
          <button class="s-btn" id="add-page-btn">Ajouter</button></div>
        <button class="s-link" id="use-current">Utiliser les pages actuellement ouvertes</button>
      </div></div></div>`;
  }

  function sectionAccueil() {
    const h = prefs.home || { mode: 'newtab', url: '' };
    return `<div class="s-section" id="s-accueil"><h2>Page d’accueil</h2><div class="s-card">
      ${toggle('show-home', prefs.showHome !== false, 'Afficher le bouton Accueil', 'Le bouton maison à côté de la barre d’adresse.')}
      ${radio('home', 'newtab', h.mode, 'Page « Nouvel onglet » de Maxou’s Nav')}
      ${radio('home', 'url', h.mode, 'Une page de mon choix')}
      <div class="s-sub" id="home-url-box" ${h.mode === 'url' ? '' : 'hidden'}>
        <div class="s-add"><input class="s-input" id="home-url" placeholder="ex. google.com" value="${esc(h.url)}">
          <button class="s-btn" id="home-url-btn">Enregistrer</button></div>
      </div></div>
      <p class="s-note">Astuce : sur la page « Nouvel onglet », tu peux ajouter ou retirer des raccourcis (survole un raccourci pour le supprimer, ou clique sur « Ajouter »).</p></div>`;
  }

  function sectionFavoris() {
    const list = prefs.bookmarks || [];
    return `<div class="s-section" id="s-favoris"><h2>Favoris</h2><div class="s-card">
      ${toggle('show-bm', prefs.showBookmarksBar, 'Afficher la barre de favoris', 'Raccourci : Ctrl+Maj+B')}
      <div class="s-row" style="display:block">
        <div class="s-list">${list.length ? list.map((b) => `
          <div class="s-item">${imgOrGlobe(b.favicon || favFor(b.url))}
            <span class="grow"><b style="font-weight:500">${esc(b.title)}</b> <span class="muted">${esc(b.url)}</span></span>
            <button class="icon-btn sm" data-edit-bm="${esc(b.id)}" title="Modifier"><svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4"/></svg></button>
            <button class="icon-btn sm" data-del-bm="${esc(b.id)}" title="Supprimer">${ICON_X}</button></div>`).join('')
          : '<div class="s-empty">Pas encore de favoris. Clique sur l’étoile ☆ dans la barre d’adresse pour ajouter la page actuelle.</div>'}</div>
        <div class="s-add"><input class="s-input" id="add-bm-name" placeholder="Nom" style="max-width:180px">
          <input class="s-input" id="add-bm-url" placeholder="Adresse (ex. twitch.tv)">
          <button class="s-btn" id="add-bm-btn">Ajouter</button></div>
      </div></div></div>`;
  }

  function sectionExtensions() {
    return `<div class="s-section" id="s-extensions"><h2>Extensions</h2><div class="s-card">
      <div class="ext-hero">
        <div class="shield-big">${ICONS.extensions.replace('<svg', '<svg style="color:#fff"')}</div>
        <div class="s-text"><div class="s-label">Ajoute des extensions depuis le Chrome Web Store</div>
          <div class="s-desc">Ouvre le store, choisis une extension puis clique sur « Ajouter à Chrome ».</div></div>
        <button class="s-btn grad" id="open-store">Ouvrir le Chrome Web Store</button>
      </div>
      <div id="ext-list">${extListHtml()}</div>
    </div>
    <p class="s-note">Les icônes des extensions apparaissent à droite de la barre d’adresse. La plupart des extensions récentes fonctionnent (Dark Reader, gestionnaires de mots de passe, traducteurs…). Certaines, très liées à Chrome, peuvent ne pas marcher entièrement.</p></div>`;
  }
  function extListHtml() {
    if (!extCache.length) return '<div class="s-row"><div class="s-empty">Aucune extension installée.</div></div>';
    return extCache.map((e) => `
      <div class="ext-card"><img src="crx://extension-icon/${esc(e.id)}/48/2" alt="">
        <div class="s-text"><div class="s-label">${esc(e.name)} <span class="muted" style="font-size:11.5px">${esc(e.version)}</span></div>
          <div class="s-desc">${esc(e.description)}</div></div>
        <button class="s-link" data-ext-page="${esc(e.id)}">Détails</button>
        <button class="s-btn" data-ext-del="${esc(e.id)}" data-ext-name="${esc(e.name)}">Supprimer</button></div>`).join('');
  }

  let permsCache = [];
  let secInfo = { blockedSites: 0 };
  const PERM_LABEL = {
    media: 'Caméra / micro', geolocation: 'Position', notifications: 'Notifications',
    'clipboard-read': 'Presse-papiers', 'display-capture': 'Capture d’écran', midi: 'MIDI', midiSysex: 'MIDI', 'idle-detection': 'Détection d’inactivité'
  };
  function permsHtml() {
    if (!permsCache.length) return '<div class="s-empty">Aucun site n’a d’autorisation enregistrée.</div>';
    return permsCache.map((p) => `<div class="s-item"><span class="grow">${esc(p.origin.replace(/^https?:\/\//, ''))} — ${esc(PERM_LABEL[p.permission] || p.permission)}</span>
      <span class="muted" style="color:${p.allowed ? 'var(--ok)' : '#F87171'}">${p.allowed ? 'Autorisé' : 'Bloqué'}</span>
      <button class="icon-btn sm" data-revoke="${esc(p.key)}" title="Oublier ce choix">${ICON_X}</button></div>`).join('');
  }
  function sectionConfidentialite() {
    const n = secInfo.blockedSites ? ` (${secInfo.blockedSites.toLocaleString('fr-FR')} sites connus)` : '';
    return `<div class="s-section" id="s-confidentialite"><h2>Confidentialité et sécurité</h2><div class="s-card">
      ${toggle('safe-on', prefs.safeBrowsing !== false, 'Protection contre les sites dangereux', 'Bloque les faux sites qui volent les mots de passe et les sites qui diffusent des virus' + n + '.')}
      ${toggle('https-on', prefs.httpsOnly !== false, 'Toujours utiliser des connexions sécurisées (HTTPS)', 'Passe automatiquement les sites en HTTPS et prévient avant d’ouvrir un site non sécurisé.')}
      ${toggle('adblock-on', adblock.enabled, 'Bloquer les pubs et les traqueurs', `${(adblock.total || 0).toLocaleString('fr-FR')} éléments bloqués depuis l’installation`)}
      ${toggle('gpc-on', prefs.gpc !== false, 'Demander aux sites de ne pas vendre ni partager mes données', 'Envoie le signal « Global Privacy Control » à chaque site.')}
      <div class="s-row"><div class="s-text"><div class="s-label">Effacer les données de navigation</div>
        <div class="s-desc">Cache, cookies, autorisations des sites.</div></div>
        <button class="s-btn" id="clear-data">Effacer…</button></div>
    </div>
    <h2 style="margin-top:22px">Autorisations des sites</h2><div class="s-card"><div class="s-row" style="display:block"><div class="s-list" id="perms-list">${permsHtml()}</div></div></div>
    <p class="s-note">Toujours actif : chaque onglet est isolé dans un bac à sable, les cookies et sessions sont chiffrés sur ton PC, les téléchargements sont signalés à Windows SmartScreen, et les applications externes ne s’ouvrent qu’après ta confirmation.</p></div>`;
  }

  function sectionAPropos() {
    return `<div class="s-section" id="s-apropos"><h2>À propos</h2><div class="s-card">
      <div class="about-row"><img src="assets/logo.svg" alt="">
        <div class="s-text"><div class="s-label" style="font-size:15px;font-weight:600">Maxou's Nav</div>
          <div class="s-desc" id="s-version"></div>
          <div class="s-desc" id="s-update" style="margin-top:6px"></div></div>
        <button class="s-btn" id="s-check">Rechercher des mises à jour</button></div>
    </div></div>`;
  }

  function refreshAbout() {
    const v = view.querySelector('#s-update');
    if (!v) return;
    v.textContent = document.getElementById('about-update-text').textContent;
    const b = view.querySelector('#s-check');
    b.textContent = upd.status === 'ready' ? 'Redémarrer pour mettre à jour' : 'Rechercher des mises à jour';
    b.disabled = upd.status === 'checking' || upd.status === 'downloading';
  }

  function render(section) {
    if (section) currentSection = section;
    const main = view.querySelector('.s-main');
    const scroll = main && !section ? main.scrollTop : null;
    view.innerHTML = `
      <nav class="s-nav">
        <div class="s-brand"><img src="assets/logo-small.svg" alt=""> Paramètres</div>
        ${SECTIONS.map(([id, label]) => `<a data-go="${id}" class="${id === currentSection ? 'active' : ''}">${ICONS[id]}${label}</a>`).join('')}
      </nav>
      <div class="s-main"><div class="s-inner">
        <h1>Paramètres</h1>
        ${sectionDemarrage()}${sectionAccueil()}${sectionFavoris()}${sectionExtensions()}${sectionConfidentialite()}${sectionAPropos()}
      </div></div>`;
    wire();
    api.info().then((i) => { const el = view.querySelector('#s-version'); if (el) el.textContent = `Version ${i.version} · Chromium ${i.chrome.split('.')[0]}`; });
    renderUpdate();
    refreshAbout();
    const m = view.querySelector('.s-main');
    if (scroll != null) m.scrollTop = scroll;
    else if (section) { const target = view.querySelector('#s-' + section); if (target) m.scrollTop = target.offsetTop - 20; }
  }

  function hideBrokenImages() {
    view.querySelectorAll('img').forEach((i) => {
      if (i.dataset.wired) return;
      i.dataset.wired = '1';
      i.addEventListener('error', () => { i.style.visibility = 'hidden'; });
    });
  }

  function wire() {
    hideBrokenImages();
    const q = (sel) => view.querySelector(sel);
    const qa = (sel) => [...view.querySelectorAll(sel)];
    const main = q('.s-main');

    qa('[data-go]').forEach((a) => a.onclick = () => {
      currentSection = a.dataset.go;
      qa('[data-go]').forEach((x) => x.classList.toggle('active', x === a));
      const target = q('#s-' + a.dataset.go);
      main.scrollTo({ top: target.offsetTop - 20, behavior: 'smooth' });
    });
    main.addEventListener('scroll', () => {
      let cur = SECTIONS[0][0];
      for (const [id] of SECTIONS) { const s = q('#s-' + id); if (s && s.offsetTop - 80 <= main.scrollTop) cur = id; }
      if (main.scrollTop + main.clientHeight >= main.scrollHeight - 4) cur = SECTIONS[SECTIONS.length - 1][0];
      currentSection = cur;
      qa('[data-go]').forEach((x) => x.classList.toggle('active', x.dataset.go === cur));
    }, { passive: true });

    // Démarrage
    qa('input[name=startup]').forEach((r) => r.onchange = () => savePrefs({ startup: r.value }));
    const addPage = () => {
      const v = q('#add-page').value.trim();
      if (!v) return;
      savePrefs({ startupPages: [...(prefs.startupPages || []), v] });
    };
    q('#add-page-btn').onclick = addPage;
    q('#add-page').onkeydown = (e) => { if (e.key === 'Enter') addPage(); };
    qa('[data-del-page]').forEach((b) => b.onclick = () => {
      const arr = [...prefs.startupPages]; arr.splice(+b.dataset.delPage, 1); savePrefs({ startupPages: arr });
    });
    q('#use-current').onclick = () => {
      const urls = tabs.map((t) => t.url).filter((u) => /^https?:/i.test(u));
      savePrefs({ startupPages: urls });
      toast(urls.length ? `${urls.length} page(s) enregistrée(s)` : 'Aucune page web ouverte');
    };

    // Accueil
    q('#show-home').onchange = (e) => savePrefs({ showHome: e.target.checked });
    qa('input[name=home]').forEach((r) => r.onchange = () => {
      if (r.value === 'url' && !(prefs.home && prefs.home.url)) {
        prefs.home = { mode: 'url', url: '' };
        q('#home-url-box').hidden = false;
        q('#home-url').focus();
        return;
      }
      savePrefs({ home: { ...(prefs.home || {}), mode: r.value } });
    });
    const saveHome = () => {
      const v = q('#home-url').value.trim();
      if (!v) return;
      savePrefs({ home: { mode: 'url', url: v } });
      toast('Page d’accueil enregistrée');
    };
    q('#home-url-btn').onclick = saveHome;
    q('#home-url').onkeydown = (e) => { if (e.key === 'Enter') saveHome(); };

    // Favoris
    q('#show-bm').onchange = (e) => savePrefs({ showBookmarksBar: e.target.checked });
    qa('[data-del-bm]').forEach((b) => b.onclick = () => removeBookmark(b.dataset.delBm));
    qa('[data-edit-bm]').forEach((b) => b.onclick = () => {
      const bm = prefs.bookmarks.find((x) => x.id === b.dataset.editBm);
      if (bm) openBookmarkPop(bm);
    });
    const addBm = () => {
      const url = q('#add-bm-url').value.trim();
      if (!url) return;
      const full = toUrl(url);
      let title = q('#add-bm-name').value.trim();
      if (!title) { try { title = new URL(full).hostname.replace(/^www\./, ''); } catch { title = url; } }
      savePrefs({ bookmarks: [...(prefs.bookmarks || []), { id: Date.now().toString(36), title, url: full, favicon: favFor(full) }] });
    };
    q('#add-bm-btn').onclick = addBm;
    q('#add-bm-url').onkeydown = (e) => { if (e.key === 'Enter') addBm(); };

    // Extensions
    q('#open-store').onclick = () => createTab(WEBSTORE);
    qa('[data-ext-page]').forEach((b) => b.onclick = () => createTab(`https://chromewebstore.google.com/detail/${b.dataset.extPage}?hl=fr`));
    qa('[data-ext-del]').forEach((b) => b.onclick = async () => {
      b.disabled = true;
      extCache = await api.ext.remove(b.dataset.extDel);
      toast(`« ${b.dataset.extName} » a été supprimée`);
      render();
    });

    // Confidentialité et sécurité
    q('#adblock-on').onchange = async (e) => { adblock = await api.adblock.set(e.target.checked); updateShield(); };
    q('#safe-on').onchange = (e) => savePrefs({ safeBrowsing: e.target.checked });
    q('#https-on').onchange = (e) => savePrefs({ httpsOnly: e.target.checked });
    q('#gpc-on').onchange = (e) => savePrefs({ gpc: e.target.checked });
    q('#clear-data').onclick = () => openClearDialog();
    wirePerms();

    // À propos
    q('#s-check').onclick = () => { if (upd.status === 'ready') api.update.install(); else api.update.check(); };
  }

  function wirePerms() {
    view.querySelectorAll('[data-revoke]').forEach((b) => b.onclick = async () => {
      await api.perms.revoke(b.dataset.revoke);
      permsCache = await api.perms.list();
      const box = view.querySelector('#perms-list');
      if (box) { box.innerHTML = permsHtml(); wirePerms(); }
    });
  }

  function isVisible() { return !view.hidden; }

  window.renderSettings = (section) => {
    render(section);
    Promise.all([api.perms.list(), api.security.info()]).then(([p, info]) => {
      const changed = JSON.stringify(p) !== JSON.stringify(permsCache) || (info && info.blockedSites) !== secInfo.blockedSites;
      permsCache = p || [];
      secInfo = info || secInfo;
      if (changed && isVisible()) render();
    }).catch(() => {});
    api.ext.list().then((l) => {
      extCache = l || [];
      const box = view.querySelector('#ext-list');
      if (box) { box.innerHTML = extListHtml(); wireExt(); }
    });
  };
  function wireExt() {
    hideBrokenImages();
    view.querySelectorAll('[data-ext-page]').forEach((b) => b.onclick = () => createTab(`https://chromewebstore.google.com/detail/${b.dataset.extPage}?hl=fr`));
    view.querySelectorAll('[data-ext-del]').forEach((b) => b.onclick = async () => {
      b.disabled = true;
      extCache = await api.ext.remove(b.dataset.extDel);
      toast(`« ${b.dataset.extName} » a été supprimée`);
      render();
    });
  }

  api.on('ext:changed', (l) => {
    extCache = l || [];
    if (isVisible()) { const box = view.querySelector('#ext-list'); if (box) { box.innerHTML = extListHtml(); wireExt(); } }
  });
  api.on('update', () => { if (isVisible()) refreshAbout(); });
})();
