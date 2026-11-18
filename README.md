<p align="center">
  <a href="https://maxoulfrdev.github.io/maxous-nav/"><img src="site/assets/banniere.webp" alt="Maxou's Nav — le navigateur rapide, beau et sans pubs" width="900"></a>
</p>

<p align="center">
  <a href="https://github.com/Maxoulfrdev/maxous-nav/releases/latest"><img alt="Dernière version" src="https://img.shields.io/github/v/release/Maxoulfrdev/maxous-nav?label=version&color=8B5CF6&style=for-the-badge"></a>
  <img alt="Windows 10 et 11" src="https://img.shields.io/badge/Windows-10%20%7C%2011-22D3EE?style=for-the-badge">
  <img alt="Gratuit" src="https://img.shields.io/badge/prix-gratuit-E879F9?style=for-the-badge">
</p>

<h3 align="center">
  <a href="https://github.com/Maxoulfrdev/maxous-nav/releases/latest">⬇️ Télécharger pour Windows</a>
  &nbsp;·&nbsp;
  <a href="https://maxoulfrdev.github.io/maxous-nav/">🌐 Site officiel</a>
</h3>

---

## ✨ Fonctions

| | |
|---|---|
| 🛡️ **Bloqueur de pubs intégré** | Pubs, traqueurs et pop-ups bloqués (EasyList / EasyPrivacy), listes mises à jour toutes seules |
| 🚫 **Anti-hameçonnage** | ~20 000 faux sites et sites à virus bloqués avant de s'afficher |
| 🧩 **Extensions Chrome** | Installe tes extensions depuis le Chrome Web Store |
| 🔄 **Mises à jour automatiques** | Les nouvelles versions s'installent en silence, comme Chrome |
| ⭐ **Favoris et démarrage** | Barre de favoris, page d'accueil au choix, reprise de session ou pages au choix |
| ⚡ **Léger** | Onglets inutilisés mis en veille, démarrage instantané |

## 📸 Captures

<p align="center">
  <img src="site/assets/capture-accueil.webp" alt="Page Nouvel onglet" width="49%">
  <img src="site/assets/capture-securite.webp" alt="Paramètres de sécurité" width="49%">
</p>
<p align="center">
  <img src="site/assets/capture-alerte.webp" alt="Site dangereux bloqué" width="70%">
</p>

## 🔒 Sécurité

- Chaque onglet et l'interface tournent dans un **bac à sable**
- **HTTPS forcé**, avec avertissement si un site ne le propose pas
- **Cookies et sessions chiffrés** sur le PC (DPAPI de Windows)
- Téléchargements dangereux bloqués, **SmartScreen** informé, confirmation avant d'ouvrir un programme
- Mises à jour vérifiées (source GitHub uniquement + empreinte SHA-256)
- Chaque version est **testée automatiquement sur Windows** avant d'être publiée

## 💿 Installation

1. Télécharge `Maxous-Nav-Installation-X.Y.Z.exe` depuis la [dernière version](https://github.com/Maxoulfrdev/maxous-nav/releases/latest).
2. Lance-le. Si Windows affiche *« Windows a protégé votre ordinateur »* : **Informations complémentaires** → **Exécuter quand même**.
3. C'est tout. Maxou's Nav se met ensuite à jour tout seul.

---

<details>
<summary><b>👩‍💻 Pour les développeurs</b></summary>

```bash
npm install          # installe les dépendances (+ correctifs automatiques)
npm start            # lance Maxou's Nav en mode développement
```

**Publier une nouvelle version** : change `version` dans `package.json` puis envoie le code sur `main`.
GitHub Actions compile l'appli sur Windows, lance l'auto-test, puis publie la release.
Les navigateurs installés se mettent à jour tout seuls.

Le site de présentation (`site/`) est publié automatiquement sur GitHub Pages.
</details>
