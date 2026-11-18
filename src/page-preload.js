// S'exécute (isolé) au chargement de chaque page. Ne fait quelque chose que sur la
// page de connexion Google : Maxou's Nav s'y présente comme Firefox, donc on masque
// navigator.userAgentData (qui n'existe pas dans Firefox) pour rester cohérent.
const { webFrame } = require('electron');
try {
  const h = location.hostname;
  if (h === 'accounts.google.com' || h === 'accounts.youtube.com') {
    webFrame.executeJavaScript(
      "try{Object.defineProperty(Navigator.prototype,'userAgentData',{get:function(){return undefined},configurable:true});}catch(e){}"
    );
  }
} catch {}
