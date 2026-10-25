/* =====================================================================
   pwa.js — Appli installable : service worker et bouton "Installer"
   ---------------------------------------------------------------------
   PWA = "Progressive Web App" : un site qui s'installe comme une appli
   (icône sur l'écran d'accueil, plein écran, marche hors ligne).
   Il faut trois choses :
     1. un fichier manifest.json (nom, icônes, couleurs) ;
     2. un service worker (sw.js) pour le mode hors ligne ;
     3. une adresse HTTPS (ou localhost pendant le développement).
   ===================================================================== */

(function (AF) {
  'use strict';

  let deferredPrompt = null; // l'événement "installation possible" gardé pour plus tard

  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  AF.pwa = {
    isIOS,

    // L'appli est-elle déjà ouverte en mode installé ?
    isInstalled() {
      return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    },

    // Peut-on proposer l'installation ? (Chrome/Edge/Android : oui si l'événement est arrivé ; iPhone : instructions)
    canInstall() {
      return !AF.pwa.isInstalled() && (Boolean(deferredPrompt) || isIOS);
    },

    // Lance l'installation (doit suivre un clic)
    async install() {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        deferredPrompt = null;
        if (outcome === 'accepted') AF.toast('ArwinFelin est installée 🎉', 'success');
        document.dispatchEvent(new Event('af-install-change'));
        return outcome;
      }
      // Sur iPhone/iPad, Safari n'a pas de bouton automatique : on explique
      AF.sheet({
        title: 'Installer sur iPhone',
        content: `
          <ol class="steps-list">
            <li><span>1</span>Ouvrez ArwinFelin dans <b>Safari</b>.</li>
            <li><span>2</span>Touchez le bouton <b>Partager</b> ${AF.icon('share')} en bas de l'écran.</li>
            <li><span>3</span>Choisissez <b>« Sur l'écran d'accueil »</b>.</li>
            <li><span>4</span>Touchez <b>Ajouter</b>. L'icône apparaît avec vos autres applis !</li>
          </ol>
          <p class="hint">${AF.icon('info')} Une fois installée, ouvrez l'appli depuis son icône pour pouvoir activer les notifications.</p>`
      });
      return 'ios';
    }
  };

  // Le navigateur prévient quand l'appli est installable : on garde l'événement
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault(); // on empêche la petite bannière automatique, on a notre propre bouton
    deferredPrompt = event;
    document.dispatchEvent(new Event('af-install-change'));
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    document.dispatchEvent(new Event('af-install-change'));
  });

  // Enregistrement du service worker (après le chargement pour ne pas ralentir le démarrage)
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch((error) => {
        console.warn("Service worker non enregistré (normal si la page est ouverte en double-cliquant sur le fichier) :", error.message);
      });
    });
  }

  // Petit message quand on perd ou retrouve la connexion
  window.addEventListener('offline', () => AF.toast('Hors ligne : vos données restent disponibles', 'info'));
  window.addEventListener('online', () => AF.toast('Connexion retrouvée', 'success'));
})(self.AF);
