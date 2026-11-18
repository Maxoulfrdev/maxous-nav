#!/usr/bin/env bash
# Construit une nouvelle version de Maxou's Nav :
#   dist/Maxous-Nav-Installation-X.exe, dist/Maxous-Nav-Portable-X.exe, dist/latest.json
# Usage : scripts/build-release.sh            (version de package.json)
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION=$(node -p "require('./package.json').version")
echo "==> Maxou's Nav $VERSION"

# Listes anti-pubs fraîches livrées avec l'appli
NODE_PATH=$PWD/node_modules node -e "
const { FiltersEngine } = require('@ghostery/adblocker');
FiltersEngine.fromPrebuiltAdsAndTracking(fetch).then(e => require('fs').writeFileSync('build/adblock-engine.bin', e.serialize()))
  .then(() => console.log('    listes anti-pubs à jour'), err => console.log('    (listes anti-pubs : ancienne version gardée)', err.message));
"

rm -rf dist
export WINEDEBUG=-all
npx electron-builder --win dir portable

NSIS=$(dirname "$(find ~/.cache/electron-builder -path '*nsis-3*/linux/makensis' | head -1)")/..
chmod +x "$NSIS/linux/makensis"
(cd build && NSISDIR="$NSIS" "$NSIS/linux/makensis" -V2 -DVERSION="$VERSION" installer.nsi)

FILE="Maxous-Nav-Installation-$VERSION.exe"
SHA=$(sha256sum "dist/$FILE" | cut -d' ' -f1)
SIZE=$(stat -c %s "dist/$FILE")
cat > dist/latest.json <<EOF
{ "version": "$VERSION", "file": "$FILE", "sha256": "$SHA", "size": $SIZE }
EOF
echo "==> Prêt :"
ls -la dist/*.exe dist/latest.json
