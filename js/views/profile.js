/* =====================================================================
   views/profile.js — L'onglet Profil
   ===================================================================== */

(function (AF) {
  'use strict';

  // Carte "Installer l'appli" (réutilisée sur l'accueil)
  // dismissible = true : petite croix pour masquer la carte (sur l'accueil)
  AF.installCardHTML = function (dismissible = false) {
    if (!AF.pwa.canInstall()) return '';
    if (dismissible && localStorage.getItem('af-install-dismissed')) return '';
    return `
      <div class="install-card">
        <img src="icons/icon-192.png" alt="" width="52" height="52">
        <div><strong>Installer l'appli</strong><p>Sur votre écran d'accueil, même hors ligne.</p></div>
        <button class="btn btn-primary btn-sm" data-install>Installer</button>
        ${dismissible ? `<button class="install-close" data-install-close aria-label="Masquer">${AF.icon('close')}</button>` : ''}
      </div>`;
  };

  AF.bindInstallCard = function (root) {
    const btn = root.querySelector('[data-install]');
    if (btn) btn.addEventListener('click', async () => { await AF.pwa.install(); AF.refresh(); });
    const hide = root.querySelector('[data-install-close]');
    if (hide) hide.addEventListener('click', () => {
      localStorage.setItem('af-install-dismissed', '1');
      hide.closest('.install-card').remove();
    });
  };

  async function profileView() {
    const cats = await AF.getCats();
    const html = `
      ${AF.topbar({ title: 'Profil' })}
      <div class="page">
        <div class="profile-card">
          <img src="icons/icon-192.png" alt="" width="64" height="64">
          <div>
            <h2>ArwinFelin</h2>
            <p class="muted">${AF.plural(cats.length, 'chat', 'chats')} · données gardées sur cet appareil</p>
          </div>
        </div>
        ${AF.installCardHTML()}
        ${AF.pwa.isInstalled() ? `<div class="alert alert-ok">${AF.icon('check')}<div><strong>Appli installée</strong><p>Elle fonctionne aussi hors ligne.</p></div></div>` : ''}
        <div class="card list-card">
          <a class="todo-row" href="#/rappels"><span class="tone-dot tone-apricot">${AF.icon('bell')}</span><span class="todo-text"><strong>Notifications</strong><small>${notifLabel()}</small></span>${AF.icon('chevron', 'muted')}</a>
        </div>
        ${AF.VET_DISCLAIMER}
      </div>`;
    return { html, mount: (root) => AF.bindInstallCard(root) };
  }

  function notifLabel() {
    const p = AF.notify.permission();
    return { granted: 'Activées', denied: 'Bloquées dans le navigateur', default: 'Pas encore activées', unsupported: 'Non disponibles sur ce navigateur' }[p];
  }

  AF.route('/profil', profileView, 'profile');

  // Si l'installation devient possible pendant qu'on regarde l'accueil ou le profil, on rafraîchit
  document.addEventListener('af-install-change', () => {
    if (['home', 'profile'].includes(document.body.dataset.tab)) AF.refresh();
  });
})(self.AF);
