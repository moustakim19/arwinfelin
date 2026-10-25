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

  const row = (href, icon, tone, title, sub) => `
    <a class="todo-row" href="${href}">
      <span class="tone-dot tone-${tone}">${AF.icon(icon)}</span>
      <span class="todo-text"><strong>${AF.esc(title)}</strong><small>${AF.esc(sub)}</small></span>
      ${AF.icon('chevron', 'muted')}
    </a>`;

  async function profileView() {
    const [cats, ownerName, journal, health, reminders] = await Promise.all([
      AF.getCats(), AF.db.getSetting('ownerName', ''), AF.db.getAll('journal'), AF.db.getAll('health'), AF.db.getAll('reminders')
    ]);
    const notifText = { granted: 'Activées', denied: 'Bloquées dans le navigateur', default: 'Pas encore activées', unsupported: 'Non disponibles ici' }[AF.notify.permission()];

    const html = `
      ${AF.topbar({ title: 'Profil' })}
      <div class="page">
        <div class="profile-card">
          <img src="icons/icon-192.png" alt="" width="64" height="64">
          <div>
            <h2>${ownerName ? AF.esc(ownerName) : 'Mon profil'}</h2>
            <p class="muted small">${ownerName && cats.length ? 'Humain de ' + AF.esc(cats.map((c) => c.name).join(', ')) : 'Ajoutez votre prénom dans les réglages'}</p>
          </div>
          <a class="btn-icon" href="#/reglages" aria-label="Réglages">${AF.icon('settings')}</a>
        </div>

        <div class="stat-grid">
          <div class="stat stat-mint"><strong>${cats.length}</strong><span>${cats.length > 1 ? 'Chats' : 'Chat'}</span></div>
          <div class="stat stat-lavender"><strong>${journal.length}</strong><span>Souvenirs</span></div>
          <div class="stat stat-warning"><strong>${health.length + reminders.length}</strong><span>Soins et rappels</span></div>
        </div>

        ${AF.installCardHTML()}
        ${AF.pwa.isInstalled() ? `<div class="alert alert-ok">${AF.icon('check')}<div><strong>Appli installée</strong><p>Elle fonctionne aussi hors ligne.</p></div></div>` : ''}

        ${cats.length ? `
          <div class="section-head"><h2>Fiches à partager</h2></div>
          <div class="card list-card">
            ${cats.map((c) => `
              <a class="todo-row" href="#/fiche/${encodeURIComponent(c.id)}">
                <span class="todo-avatar">${AF.catAvatar(c)}</span>
                <span class="todo-text"><strong>Fiche de ${AF.esc(c.name)}</strong><small>Pour le véto ou un gardien · PDF ou image</small></span>
                ${AF.icon('share', 'muted')}
              </a>`).join('')}
          </div>` : ''}

        <div class="section-head"><h2>Outils</h2></div>
        <div class="card list-card">
          ${row('#/race', 'scan', 'lavender', 'Reconnaître une race', "IA gratuite, la photo reste sur l'appareil")}
          ${row('#/races', 'paw', 'mint', 'Toutes les races', AF.BREEDS.length + ' fiches à consulter')}
          ${row('#/rappels', 'bell', 'apricot', 'Notifications', notifText)}
          ${row('#/reglages', 'settings', 'sky', 'Réglages', 'Thème, sauvegarde, profil')}
        </div>
        ${AF.VET_DISCLAIMER}
      </div>`;
    return { html, mount: (root) => AF.bindInstallCard(root) };
  }

  AF.route('/profil', profileView, 'profile');

  // Si l'installation devient possible pendant qu'on regarde l'accueil ou le profil, on rafraîchit
  document.addEventListener('af-install-change', () => {
    if (['home', 'profile'].includes(document.body.dataset.tab)) AF.refresh();
  });
})(self.AF);
