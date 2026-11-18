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
1. Changer `version` dans `package.json` (par ex. `1.2.0`)
2. Envoyer le code puis le tag : `git tag v1.2.0 && git push origin main v1.2.0`
3. GitHub Actions compile et publie la release tout seul, et les navigateurs installés se mettent à jour.
