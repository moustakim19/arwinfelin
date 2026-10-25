/* =====================================================================
   views/settings.js — L'écran Réglages
   ===================================================================== */

(function (AF) {
  'use strict';

  AF.APP_VERSION = '1.0.0';

  async function settingsView() {
    const [ownerName, ownerPhone, lastBackup, aiReady, cats] = await Promise.all([
      AF.db.getSetting('ownerName', ''), AF.db.getSetting('ownerPhone', ''),
      AF.db.getSetting('lastBackup', null), AF.breedAI.isDownloaded(), AF.getCats()
    ]);
    const theme = AF.theme.get();
    const notif = AF.notify.permission();
    const notifText = { granted: 'Activées', denied: 'Bloquées dans le navigateur', default: 'Pas encore activées', unsupported: 'Non disponibles ici' }[notif];

    const html = `
      ${AF.topbar({ title: 'Réglages', back: true })}
      <div class="page">

        <section class="settings-group">
          <h3>Apparence</h3>
          <div class="card settings-card">
            <div class="theme-pick" role="radiogroup" aria-label="Thème">
              ${[['light', 'Clair', 't-light'], ['dark', 'Sombre', 't-dark'], ['auto', 'Automatique', 't-auto']].map(([v, l, c]) => `
                <label><input type="radio" name="theme" value="${v}" ${theme === v ? 'checked' : ''}><span><i class="${c}"></i>${l}</span></label>`).join('')}
            </div>
          </div>
        </section>

        <section class="settings-group">
          <h3>Mon profil</h3>
          <form class="card form-card" id="owner-form" novalidate>
            <label class="field"><span>Mon prénom</span><input name="ownerName" maxlength="40" value="${AF.esc(ownerName)}" placeholder="Pour vous dire bonjour 👋" autocomplete="given-name"></label>
            <label class="field"><span>Mon téléphone</span><input name="ownerPhone" type="tel" maxlength="20" value="${AF.esc(ownerPhone)}" placeholder="Affiché sur la fiche pour le gardien" autocomplete="tel"></label>
            <button class="btn btn-soft btn-block" type="submit">${AF.icon('check')} Enregistrer</button>
          </form>
        </section>

        <section class="settings-group">
          <h3>Notifications</h3>
          <div class="card settings-card">
            <div class="setting-row">
              <span class="tone-dot tone-apricot">${AF.icon('bell')}</span>
              <span class="todo-text"><strong>Rappels</strong><small>${notifText}</small></span>
              ${notif === 'default' ? `<button class="btn btn-primary btn-sm" data-notif>Activer</button>` : ''}
              ${notif === 'granted' ? `<button class="btn btn-soft btn-sm" data-test-notif>Tester</button>` : ''}
            </div>
          </div>
        </section>

        <section class="settings-group">
          <h3>Sauvegarde</h3>
          <div class="card settings-card">
            <button class="setting-row" data-export>
              <span class="tone-dot tone-mint">${AF.icon('download')}</span>
              <span class="todo-text"><strong>Exporter une sauvegarde</strong><small>${lastBackup ? 'Dernière : ' + AF.esc(AF.formatDate(lastBackup.slice(0, 10))) : 'Jamais faite : pensez-y !'}</small></span>
              ${AF.icon('chevron', 'muted')}
            </button>
            <button class="setting-row" data-import>
              <span class="tone-dot tone-sky">${AF.icon('upload')}</span>
              <span class="todo-text"><strong>Importer une sauvegarde</strong><small>Remplace les données de cet appareil</small></span>
              ${AF.icon('chevron', 'muted')}
            </button>
            <div class="setting-row">
              <span class="tone-dot tone-lavender">${AF.icon('database')}</span>
              <span class="todo-text"><strong>Espace utilisé</strong><small id="storage-text">Calcul…</small><div class="storage-bar"><i id="storage-bar" style="width:0%"></i></div></span>
            </div>
          </div>
          <p class="hint">${AF.icon('info')} Vos données restent sur cet appareil. Une sauvegarde régulière permet de les retrouver sur un nouveau téléphone (photos comprises).</p>
        </section>

        <section class="settings-group">
          <h3>Intelligence artificielle</h3>
          <div class="card settings-card">
            <div class="setting-row">
              <span class="tone-dot tone-primary">${AF.icon('scan')}</span>
              <span class="todo-text"><strong>Modèle de reconnaissance</strong><small>${aiReady ? 'Téléchargé, fonctionne hors ligne' : 'Pas encore téléchargé (≈ 90 Mo)'}</small></span>
              ${aiReady ? `<button class="btn btn-ghost btn-sm" data-free-ai>Libérer</button>` : ''}
            </div>
          </div>
        </section>

        <section class="settings-group">
          <h3>Zone sensible</h3>
          <div class="card settings-card">
            <button class="setting-row danger" data-wipe>
              <span class="tone-dot tone-danger">${AF.icon('trash')}</span>
              <span class="todo-text"><strong>Tout effacer</strong><small>${AF.plural(cats.length, 'chat', 'chats')} et toutes leurs données</small></span>
            </button>
          </div>
        </section>

        <p class="version-line">ArwinFelin ${AF.APP_VERSION} · fait avec 🧡 pour les chats<br>Cette appli ne remplace pas l'avis d'un vétérinaire.</p>
      </div>`;

    function mount(root) {
      // Thème : appliqué tout de suite
      root.querySelectorAll('[name=theme]').forEach((r) => r.addEventListener('change', () => AF.theme.set(r.value)));

      root.querySelector('#owner-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = AF.formData(e.target);
        await AF.db.setSetting('ownerName', data.ownerName);
        await AF.db.setSetting('ownerPhone', data.ownerPhone);
        e.target.querySelectorAll('input').forEach((i) => i.blur());
        AF.toast('Profil enregistré', 'success');
      });

      const notifBtn = root.querySelector('[data-notif]');
      if (notifBtn) notifBtn.addEventListener('click', async () => { await AF.notify.request(); AF.refresh(); });
      const testBtn = root.querySelector('[data-test-notif]');
      if (testBtn) testBtn.addEventListener('click', () => AF.notify.show('Coucou 🐾', { body: 'Les notifications fonctionnent !', tag: 'af-test' }));

      root.querySelector('[data-export]').addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        try {
          const { size } = await AF.backup.export();
          AF.toast('Sauvegarde créée (' + AF.formatBytes(size) + ')', 'success');
          AF.refresh();
        } catch (err) {
          AF.toast('Export impossible : ' + err.message, 'error');
        } finally {
          btn.disabled = false;
        }
      });

      root.querySelector('[data-import]').addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json,.json';
        input.addEventListener('change', async () => {
          const file = input.files[0];
          if (!file) return;
          const ok = await AF.confirm({
            title: 'Remplacer les données ?',
            message: 'Toutes les données actuelles de cet appareil seront remplacées par celles de la sauvegarde « ' + file.name + ' ».',
            confirmText: 'Importer', danger: true
          });
          if (!ok) return;
          try {
            const { cats: n } = await AF.backup.import(file);
            AF.toast('Sauvegarde importée : ' + AF.plural(n, 'chat', 'chats'), 'success');
            AF.go('/', { replace: true });
          } catch (err) {
            AF.toast(err.message, 'error', 4500);
          }
        });
        input.click();
      });

      // Espace de stockage utilisé par le site (base + caches + modèle d'IA)
      if (navigator.storage && navigator.storage.estimate) {
        navigator.storage.estimate().then(({ usage, quota }) => {
          const text = root.querySelector('#storage-text');
          if (!text) return;
          text.textContent = AF.formatBytes(usage) + ' sur ' + AF.formatBytes(quota) + ' disponibles';
          root.querySelector('#storage-bar').style.width = Math.max(1, Math.min(100, (usage / quota) * 100)) + '%';
        });
      } else root.querySelector('#storage-text').textContent = 'Inconnu sur ce navigateur';

      const freeAi = root.querySelector('[data-free-ai]');
      if (freeAi) freeAi.addEventListener('click', async () => {
        if (!(await AF.confirm({ title: 'Supprimer le modèle ?', message: 'Il sera retéléchargé (≈ 90 Mo) à la prochaine analyse.', confirmText: 'Supprimer' }))) return;
        try { await caches.delete('transformers-cache'); } catch (e) { /* rien */ }
        await AF.db.setSetting('aiReady', false);
        AF.toast('Espace libéré', 'success');
        AF.refresh();
      });

      root.querySelector('[data-wipe]').addEventListener('click', async () => {
        const first = await AF.confirm({ title: 'Tout effacer ?', message: 'Chats, carnets, photos, souvenirs et rappels seront supprimés de cet appareil.', confirmText: 'Continuer', danger: true });
        if (!first) return;
        const second = await AF.confirm({ title: 'Vraiment sûr ?', message: "C'est définitif. Avez-vous exporté une sauvegarde ?", confirmText: 'Tout effacer', danger: true });
        if (!second) return;
        await AF.backup.wipe();
        AF.toast('Toutes les données ont été effacées', 'info');
        AF.go('/', { replace: true });
      });
    }

    return { html, mount };
  }

  AF.route('/reglages', settingsView, 'profile');
})(self.AF);
