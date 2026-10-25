/* =====================================================================
   views/health.js — Le carnet de santé (dans la fiche) et l'onglet Santé
   ===================================================================== */

(function (AF) {
  'use strict';

  /* ---------- Morceaux d'affichage ---------- */

  // Une ligne de soin (vaccin, vermifuge, antipuces)
  function careRow(e, superseded) {
    const status = AF.careStatus(e, superseded);
    const details = ['Fait le ' + AF.formatDate(e.date)];
    if (e.nextDate && !superseded) details.push('rappel le ' + AF.formatDate(e.nextDate));
    return `
      <button class="h-item ${superseded ? 'is-old' : ''}" data-id="${e.id}">
        <div class="h-item-text">
          <strong>${AF.esc(e.name)}</strong>
          <small>${AF.esc(details.join(' · '))}</small>
        </div>
        ${AF.statusBadge(status)}
      </button>`;
  }

  function groupHead(type, title, count = '') {
    const t = AF.HEALTH_TYPES[type];
    return `
      <div class="group-head">
        <span class="tone-dot tone-${t.tone}">${AF.icon(t.icon)}</span>
        <h3>${AF.esc(title)} ${count !== '' ? `<span class="muted">${count}</span>` : ''}</h3>
        <button class="btn-mini" data-add="${type}" aria-label="Ajouter : ${AF.esc(t.label)}">${AF.icon('plus')}</button>
      </div>`;
  }

  const SEVERITY = { mild: ['Légère', 'chip-mint'], moderate: ['Modérée', 'chip-apricot'], severe: ['Sévère', 'chip-danger'] };

  /* ---------- Section "Santé" de la fiche du chat ---------- */

  AF.addCatSection({
    id: 'sante',
    label: 'Santé',
    icon: 'health',
    async render(cat) {
      const entries = AF.sortByDateDesc(await AF.getHealth(cat.id));
      const active = new Set(AF.activeCare(entries).map((e) => e.id));
      const late = entries.filter((e) => active.has(e.id) && AF.careStatus(e).level === 'late');

      // Soins : un bloc par type
      const careBlocks = Object.entries(AF.CARE_KINDS).map(([type, kind]) => {
        const list = entries.filter((e) => e.type === type);
        return `
          <div class="card health-group">
            ${groupHead(type, kind.plural)}
            ${list.length
              ? `<div class="h-list">${list.map((e) => careRow(e, !active.has(e.id))).join('')}</div>`
              : `<p class="h-empty">Aucun ${kind.label.toLowerCase()} noté pour l'instant.</p>`}
          </div>`;
      }).join('');

      // Visites chez le vétérinaire
      const visits = entries.filter((e) => e.type === 'visit');
      const year = String(new Date().getFullYear());
      const yearTotal = visits.filter((v) => (v.date || '').startsWith(year)).reduce((sum, v) => sum + (v.price || 0), 0);
      const visitBlock = `
        <div class="card health-group">
          ${groupHead('visit', 'Visites chez le véto')}
          ${visits.length ? `
            <div class="h-list">
              ${visits.map((v) => `
                <button class="h-item visit-item" data-id="${v.id}">
                  ${v.photo ? `<img class="visit-thumb" src="${AF.blobUrl(v.photo)}" alt="Ordonnance" data-zoom="${v.id}">` : `<span class="visit-date"><b>${AF.parseDate(v.date).getDate()}</b>${AF.esc(AF.formatShortDate(v.date).split(' ')[1] || '')}</span>`}
                  <div class="h-item-text">
                    <strong>${AF.esc(v.reason)}</strong>
                    <small>${AF.esc(AF.formatDate(v.date))}${v.vet ? ' · ' + AF.esc(v.vet) : ''}</small>
                    ${v.diagnosis ? `<small class="clamp">${AF.esc(v.diagnosis)}</small>` : ''}
                  </div>
                  ${v.price != null ? `<span class="price">${AF.esc(AF.formatPrice(v.price))}</span>` : ''}
                </button>`).join('')}
            </div>
            ${yearTotal > 0 ? `<p class="h-total">${AF.icon('euro')} Dépenses véto en ${year} : <strong>${AF.esc(AF.formatPrice(yearTotal))}</strong></p>` : ''}`
            : '<p class="h-empty">Aucune visite notée.</p>'}
        </div>`;

      // Allergies
      const allergies = entries.filter((e) => e.type === 'allergy');
      const allergyBlock = `
        <div class="card health-group">
          ${groupHead('allergy', 'Allergies')}
          ${allergies.length ? `<div class="chips">${allergies.map((a) => {
            const [label, cls] = SEVERITY[a.severity] || SEVERITY.mild;
            return `<button class="chip ${cls}" data-id="${a.id}" title="${AF.esc(a.notes)}">${AF.esc(a.name)} · ${label}</button>`;
          }).join('')}</div>` : '<p class="h-empty">Aucune allergie connue.</p>'}
        </div>`;

      // Traitements
      const treatments = entries.filter((e) => e.type === 'treatment');
      const current = treatments.filter(AF.isTreatmentActive);
      const finished = treatments.filter((t) => !AF.isTreatmentActive(t));
      const treatmentRow = (t) => `
        <button class="h-item" data-id="${t.id}">
          <div class="h-item-text">
            <strong>${AF.esc(t.name)}</strong>
            <small>${AF.esc([t.dosage, t.frequency].filter(Boolean).join(' · ') || 'Traitement')}</small>
            <small>${t.startDate ? 'Depuis le ' + AF.esc(AF.formatDate(t.startDate)) : ''}${t.endDate ? ' · jusqu\'au ' + AF.esc(AF.formatDate(t.endDate)) : ''}</small>
          </div>
          ${AF.isTreatmentActive(t) ? '<span class="badge badge-ok">En cours</span>' : '<span class="badge badge-muted">Terminé</span>'}
        </button>`;
      const treatmentBlock = `
        <div class="card health-group">
          ${groupHead('treatment', 'Traitements en cours')}
          ${current.length ? `<div class="h-list">${current.map(treatmentRow).join('')}</div>` : '<p class="h-empty">Aucun traitement en cours.</p>'}
          ${finished.length ? `<details class="h-details"><summary>Traitements terminés (${finished.length})</summary><div class="h-list">${finished.map(treatmentRow).join('')}</div></details>` : ''}
        </div>`;

      const html = `
        ${late.length ? `
          <div class="alert alert-danger">
            ${AF.icon('alert')}
            <div><strong>${late.length} soin${late.length > 1 ? 's' : ''} en retard</strong>
            <p>${AF.esc(late.map((e) => e.name).join(', '))}</p></div>
          </div>` : ''}
        <div class="section-head">
          <h2>Carnet de santé</h2>
          <button class="btn btn-primary btn-sm" data-add-any>${AF.icon('plus')} Ajouter</button>
        </div>
        ${careBlocks}
        ${visitBlock}
        ${allergyBlock}
        ${treatmentBlock}
        ${AF.VET_DISCLAIMER}`;

      function mount(el, refresh) {
        const byId = new Map(entries.map((e) => [e.id, e]));
        el.querySelector('[data-add-any]').addEventListener('click', () => AF.openHealthTypePicker(cat, refresh));
        el.querySelectorAll('[data-add]').forEach((btn) => btn.addEventListener('click', () =>
          AF.openHealthForm({ cat, type: btn.dataset.add, onSaved: refresh })));
        el.querySelectorAll('[data-id]').forEach((btn) => btn.addEventListener('click', (ev) => {
          const entry = byId.get(btn.dataset.id);
          // Toucher la miniature de l'ordonnance l'affiche en grand
          if (ev.target.closest('[data-zoom]') && entry.photo) {
            AF.viewImage(entry.photo, 'Ordonnance du ' + AF.formatDate(entry.date));
            return;
          }
          AF.openHealthForm({ cat, type: entry.type, entry, onSaved: refresh });
        }));
      }

      return { html, mount };
    }
  });

  /* ---------- Onglet "Santé" : vue d'ensemble de tous les chats ---------- */

  async function healthTabView() {
    const cats = await AF.getCats();
    if (!cats.length) {
      return {
        html: AF.topbar({ title: 'Santé' }) + `<div class="page">${AF.emptyState({
          title: 'Pas encore de chat',
          text: 'Ajoutez un chat pour tenir son carnet de santé.',
          action: `<a class="btn btn-primary" href="#/nouveau">${AF.icon('plus')} Ajouter un chat</a>`
        })}</div>`
      };
    }
    const [alerts, all] = await Promise.all([AF.getCareAlerts(30), AF.db.getAll('health')]);
    const late = alerts.filter((a) => a.status.level === 'late');
    const soon = alerts.filter((a) => a.status.level !== 'late');
    const treatments = all.filter((e) => e.type === 'treatment' && AF.isTreatmentActive(e));

    const alertRow = (a) => `
      <a class="todo-row" href="#/chat/${encodeURIComponent(a.cat.id)}/sante">
        <span class="todo-avatar">${AF.catAvatar(a.cat)}</span>
        <span class="todo-text">
          <strong>${AF.esc(a.entry.name)}</strong>
          <small>${AF.esc(a.cat.name)} · ${AF.esc(AF.CARE_KINDS[a.entry.type].label)} · ${AF.esc(AF.formatDate(a.entry.nextDate))}</small>
        </span>
        ${AF.statusBadge(a.status, true)}
      </a>`;

    // Résumé par chat
    const catRows = cats.map((cat) => {
      const mine = all.filter((e) => e.catId === cat.id);
      const lateCount = AF.activeCare(mine).filter((e) => AF.careStatus(e).level === 'late').length;
      const visits = mine.filter((e) => e.type === 'visit').length;
      const status = lateCount
        ? `<span class="badge badge-danger">${lateCount} en retard</span>`
        : mine.length ? '<span class="badge badge-ok">À jour</span>' : '<span class="badge badge-muted">Vide</span>';
      return `
        <a class="todo-row" href="#/chat/${encodeURIComponent(cat.id)}/sante">
          <span class="todo-avatar">${AF.catAvatar(cat)}</span>
          <span class="todo-text">
            <strong>${AF.esc(cat.name)}</strong>
            <small>${AF.plural(mine.filter((e) => AF.isCare(e.type)).length, 'soin', 'soins')} · ${AF.plural(visits, 'visite', 'visites')}</small>
          </span>
          ${status}
          ${AF.icon('chevron', 'muted')}
        </a>`;
    }).join('');

    const html = `
      ${AF.topbar({ title: 'Santé', subtitle: 'Le carnet de toute la famille' })}
      <div class="page">
        <div class="stat-grid">
          <div class="stat stat-danger"><strong>${late.length}</strong><span>En retard</span></div>
          <div class="stat stat-warning"><strong>${soon.length}</strong><span>Dans 30 jours</span></div>
          <div class="stat stat-mint"><strong>${treatments.length}</strong><span>Traitements</span></div>
        </div>

        ${alerts.length ? `
          <div class="section-head"><h2>À faire</h2></div>
          <div class="card list-card">${late.concat(soon).map(alertRow).join('')}</div>`
          : `<div class="card card-soft center"><p>${AF.icon('check')} Rien à prévoir dans les 30 prochains jours. Bravo !</p></div>`}

        <div class="section-head"><h2>Carnets</h2></div>
        <div class="card list-card">${catRows}</div>
        ${AF.VET_DISCLAIMER}
      </div>`;
    return { html };
  }

  AF.route('/sante', healthTabView, 'health');
})(self.AF);
