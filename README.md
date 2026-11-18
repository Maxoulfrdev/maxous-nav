<p align="center"><img src="build/icon-512.png" width="120" alt=""></p>
<h1 align="center">Maxou's Nav</h1>
<p align="center">Navigateur rapide, beau et sans pubs — pour Windows.</p>

## Télécharger
Va dans **[Releases](../../releases/latest)** et prends `Maxous-Nav-Installation-X.Y.Z.exe`.
Une fois installé, Maxou's Nav **se met à jour tout seul**.

## Fonctions
- Bloqueur de pubs et de traqueurs intégré (listes EasyList / EasyPrivacy)
- Mises à jour automatiques silencieuses (comme Chrome)
- Onglets en veille automatique pour économiser la mémoire
- Recherche Google avec suggestions, page d'accueil personnalisée
- Thème sombre, effet Mica sur Windows 11

## Publier une nouvelle version
1. Changer `version` dans `package.json`
2. `npm install && ./scripts/build-release.sh`
3. Créer une release GitHub `vX.Y.Z` avec les fichiers de `dist/` : l'installateur, la version portable et `latest.json`
