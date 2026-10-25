/* =====================================================================
   app.js — Le chef d'orchestre : routeur et démarrage de l'appli
   ---------------------------------------------------------------------
   L'appli n'a qu'une seule page HTML. Pour changer d'écran, on change
   la fin de l'adresse après le "#" (le "hash") :
       #/            -> accueil
       #/chat/abc    -> fiche du chat "abc"
       #/nouveau     -> formulaire d'ajout
   Le routeur écoute ces changements et affiche le bon écran.
   Avantage : le bouton "retour" du téléphone fonctionne tout seul.
   ===================================================================== */

(function (AF) {
  'use strict';

  const routes = [];

  // Enregistre un écran.
  // pattern : "/chat/:id" (":id" = une partie variable)
  // view    : fonction async (params) => ({ html, mount(root) })
  // tab     : onglet de la barre du bas à surligner
  AF.route = function (pattern, view, tab = null) {
    const keys = [];
    // On transforme "/chat/:id" en expression régulière ^/chat/([^/]+)$
    const regex = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, key) => {
      keys.push(key);
      return '([^/]+)';
    }) + '/?$');
    routes.push({ regex, keys, view, tab });
  };

  // On numérote chaque page de l'historique (0, 1, 2...) pour savoir
  // si le bouton "retour" peut revenir en arrière sans quitter l'appli.
  let historyIndex = 0;
  let nextIsReplace = false;

  // Aller vers un écran : AF.go('/chat/abc')
  // replace = true : remplace la page actuelle dans l'historique (pas de retour possible)
  AF.go = function (path, { replace = false } = {}) {
    // Déjà sur cette adresse : le navigateur ne signalerait aucun changement
    if (location.hash === '#' + path) { render(); return; }
    nextIsReplace = replace;
    if (replace) location.replace('#' + path);
    else location.hash = '#' + path;
  };

  // Revenir en arrière, ou à l'accueil si on est arrivé directement sur la page
  AF.back = function (fallback = '/') {
    if (historyIndex > 0) history.back();
    else AF.go(fallback, { replace: true });
  };

  // Appelé à chaque changement d'adresse : met à jour le numéro de la page
  function trackHistory() {
    const state = history.state;
    if (state && typeof state.afIndex === 'number') {
      historyIndex = state.afIndex; // on revient sur une page déjà visitée
    } else {
      if (!nextIsReplace) historyIndex++;
      history.replaceState({ afIndex: historyIndex }, '');
    }
    nextIsReplace = false;
  }

  // Recharge l'écran actuel (après une modification par exemple)
  AF.refresh = () => render({ keepScroll: true });

  let cleanup = null;   // fonction de nettoyage de l'écran précédent
  let renderId = 0;     // numéro du dernier affichage demandé

  async function render({ keepScroll = false } = {}) {
    const path = decodeURI(location.hash.slice(1)) || '/';
    const myId = ++renderId;

    // Cherche l'écran qui correspond à l'adresse
    let match = null, params = {};
    for (const route of routes) {
      const m = path.match(route.regex);
      if (m) {
        match = route;
        route.keys.forEach((key, i) => { params[key] = decodeURIComponent(m[i + 1]); });
        break;
      }
    }
    if (!match) {
      // Adresse inconnue : retour à l'accueil (sauf si c'est l'accueil lui-même qui manque)
      if (path !== '/') AF.go('/', { replace: true });
      return;
    }

    // Les adresses d'images de l'écran précédent (on les libérera après)
    const oldUrls = AF.takeTrackedUrls();
    const root = document.getElementById('view');
    const scrollY = window.scrollY;

    let result;
    try {
      result = await match.view(params);
    } catch (error) {
      console.error(error);
      result = { html: AF.emptyState({ title: 'Oups, une erreur', text: error.message }) };
    }
    // Si l'utilisateur a déjà changé d'écran entre-temps, on abandonne celui-ci
    if (myId !== renderId) return;

    if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } }
    cleanup = null;

    root.innerHTML = result.html;
    root.classList.remove('view-enter');
    void root.offsetWidth; // petite astuce pour relancer l'animation CSS
    if (!keepScroll) root.classList.add('view-enter');

    // Bouton retour présent dans les en-têtes
    root.querySelectorAll('[data-back]').forEach((btn) => btn.addEventListener('click', () => AF.back()));

    if (result.mount) {
      try { cleanup = result.mount(root) || null; } catch (e) { console.error(e); }
    }

    // Surligne le bon onglet de la barre du bas
    document.querySelectorAll('.tabbar a').forEach((a) => {
      a.classList.toggle('active', a.dataset.tab === match.tab);
      if (a.dataset.tab === match.tab) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    document.body.dataset.tab = match.tab || '';

    window.scrollTo(0, keepScroll ? scrollY : 0);
    oldUrls.forEach((url) => URL.revokeObjectURL(url));
  }

  /* ---------- Démarrage ---------- */

  function start() {
    // Remplit les icônes de la barre de navigation
    document.querySelectorAll('[data-icon]').forEach((el) => { el.innerHTML = AF.icon(el.dataset.icon); });

    // Première page de la visite (ou page rechargée)
    if (history.state && typeof history.state.afIndex === 'number') historyIndex = history.state.afIndex;
    else history.replaceState({ afIndex: 0 }, '');

    window.addEventListener('hashchange', () => { trackHistory(); render(); });
    render();
  }

  // On démarre quand la page HTML est prête ET que tous les scripts (écrans) sont chargés
  document.addEventListener('DOMContentLoaded', start);
})(self.AF);
