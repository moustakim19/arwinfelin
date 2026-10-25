/* =====================================================================
   views/reminders.js — L'onglet Rappels
   ===================================================================== */

(function (AF) {
  'use strict';

  AF.REMINDER_KINDS = {
    meal: { label: 'Repas', icon: 'bowl', tone: 'apricot' },
    litter: { label: 'Litière', icon: 'litter', tone: 'mint' },
    vaccine: { label: 'Vaccin', icon: 'syringe', tone: 'sky' },
    vet: { label: 'Vétérinaire', icon: 'stethoscope', tone: 'lavender' },
    care: { label: 'Soin', icon: 'pill', tone: 'primary' },
    other: { label: 'Autre', icon: 'bell', tone: 'apricot' }
  };

  // Modèles pour créer un rappel en un geste
  const PRESETS = [
    { title: 'Repas du matin', kind: 'meal', time: '08:00', repeat: 'daily' },
    { title: 'Repas du soir', kind: 'meal', time: '19:00', repeat: 'daily' },
    { title: 'Nettoyer la litière', kind: 'litter', time: '20:00', repeat: 'daily' },
    { title: 'Changer toute la litière', kind: 'litter', time: '10:00', repeat: 'weekly' },
    { title: 'Antipuces', kind: 'care', time: '10:00', repeat: 'monthly' },
    { title: 'Rappel de vaccin', kind: 'vaccine', time: '10:00', repeat: 'yearly' },
    { title: 'Rendez-vous véto', kind: 'vet', time: '14:00', repeat: 'none' }
  ];

  /* ---------- Fait / pas fait ---------- */

  async function setDone(reminder, date, done) {
    const r = await AF.db.get('reminders', reminder.id);
    if (!r) return;
    if (done) {
      const iso = AF.toLocalDateTime(date);
      if (!r.doneUntil || iso > r.doneUntil) r.doneUntil = iso;
    } else {
      // On recule "doneUntil" à l'occurrence précédente
      if (r.repeat === 'none') r.doneUntil = '';
      else {
        const before = AF.occurrencesBetween({ ...r, doneUntil: '' }, AF.parseDate(r.start), new Date(date - 60000));
        r.doneUntil = before.length ? AF.toLocalDateTime(before[before.length - 1]) : '';
      }
    }
    await AF.db.put('reminders', r);
  }

  /* ---------- Formulaire ---------- */

  AF.openReminderForm = function ({ cats, reminder = null, onSaved }) {
    const r = reminder || {};
    const start = AF.parseDate(r.start) || (() => { const d = new Date(); d.setMinutes(0); d.setHours(d.getHours() + 1); return d; })();
    AF.sheet({
      title: reminder ? 'Modifier le rappel' : 'Nouveau rappel',
      content: `
        <form class="form" novalidate>
          ${reminder ? '' : `
            <div class="preset-row">
              ${PRESETS.map((p, i) => `<button type="button" class="chip" data-preset="${i}">${AF.esc(p.title)}</button>`).join('')}
            </div>`}
          <label class="field"><span>Rappel <em>*</em></span><input name="title" required maxlength="60" value="${AF.esc(r.title)}" placeholder="Ex. Donner le comprimé"></label>
          <div class="field"><span>Catégorie</span>
            <div class="kind-pick">
              ${Object.entries(AF.REMINDER_KINDS).map(([v, k]) => `
                <label class="tone-${k.tone}"><input type="radio" name="kind" value="${v}" ${(r.kind || 'other') === v ? 'checked' : ''}><span>${AF.icon(k.icon)}${k.label}</span></label>`).join('')}
            </div>
          </div>
          ${cats.length ? `
            <label class="field"><span>Pour</span>
              <select name="catId">
                <option value="">Tous mes chats</option>
                ${cats.map((c) => `<option value="${c.id}" ${r.catId === c.id ? 'selected' : ''}>${AF.esc(c.name)}</option>`).join('')}
              </select>
            </label>` : ''}
          <div class="field-row">
            <label class="field"><span>Date <em>*</em></span><input type="date" name="date" required value="${AF.toISODate(start)}"></label>
            <label class="field"><span>Heure <em>*</em></span><input type="time" name="time" required value="${AF.pad(start.getHours())}:${AF.pad(start.getMinutes())}"></label>
          </div>
          <label class="field"><span>Répétition</span>
            <select name="repeat">
              ${Object.entries(AF.REPEATS).map(([v, l]) => `<option value="${v}" ${(r.repeat || 'none') === v ? 'selected' : ''}>${l}</option>`).join('')}
            </select>
          </label>
          <label class="field"><span>Note</span><input name="note" maxlength="120" value="${AF.esc(r.note)}" placeholder="Ex. ½ comprimé dans la pâtée"></label>
          <div class="form-actions">
            <button class="btn btn-primary btn-lg btn-block" type="submit">${AF.icon('check')} Enregistrer</button>
            ${reminder ? `<button class="btn btn-ghost-danger btn-block" type="button" data-delete>${AF.icon('trash')} Supprimer</button>` : ''}
          </div>
        </form>`,
      onMount(el, close) {
        const form = el.querySelector('form');
        el.querySelectorAll('[data-preset]').forEach((chip) => chip.addEventListener('click', () => {
          const p = PRESETS[Number(chip.dataset.preset)];
          form.title.value = p.title;
          form.time.value = p.time;
          form.repeat.value = p.repeat;
          form.querySelector(`[name=kind][value=${p.kind}]`).checked = true;
          el.querySelectorAll('[data-preset]').forEach((c) => c.classList.toggle('active', c === chip));
        }));
        form.addEventListener('submit', async (ev) => {
          ev.preventDefault();
          const data = AF.formData(form);
          if (!data.title || !data.date || !data.time) { AF.toast('Il faut un nom, une date et une heure', 'error'); return; }
          const startText = data.date + 'T' + data.time;
          const changedSchedule = startText !== r.start || data.repeat !== r.repeat;
          await AF.db.put('reminders', {
            ...r,
            id: r.id || AF.uid(),
            title: data.title,
            kind: data.kind || 'other',
            catId: data.catId || '',
            start: startText,
            repeat: data.repeat || 'none',
            note: data.note,
            // Si on change la date ou la répétition, on repart de zéro
            doneUntil: changedSchedule ? '' : (r.doneUntil || ''),
            createdAt: r.createdAt || new Date().toISOString()
          });
          AF.toast('Rappel enregistré', 'success');
          close();
          onSaved();
          // Bonne occasion pour proposer les notifications
          if (AF.notify.permission() === 'default') setTimeout(() => AF.toast('Activez les notifications en haut de l\'onglet Rappels 🔔', 'info', 4000), 600);
        });
        const del = el.querySelector('[data-delete]');
        if (del) del.addEventListener('click', async () => {
          if (!(await AF.confirm({ title: 'Supprimer ce rappel ?', confirmText: 'Supprimer', danger: true }))) return;
          await AF.db.delete('reminders', r.id);
          close();
          onSaved();
        });
      }
    });
  };

  /* ---------- L'écran ---------- */

  function notificationCard() {
    const p = AF.notify.permission();
    const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    if (p === 'granted') return '';
    if (p === 'unsupported') {
      return `<div class="alert alert-info">${AF.icon('info')}<div><strong>Notifications indisponibles ici</strong>
        <p>${isIOS && !standalone ? "Sur iPhone, installez d'abord l'appli sur l'écran d'accueil (Partager → « Sur l'écran d'accueil »), puis ouvrez-la depuis l'icône." : 'Ce navigateur ne gère pas les notifications. Les rappels restent visibles ici.'}</p></div></div>`;
    }
    if (p === 'denied') {
      return `<div class="alert alert-warning">${AF.icon('bell')}<div><strong>Notifications bloquées</strong>
        <p>Vous pouvez les autoriser dans les réglages du navigateur (cadenas à côté de l'adresse).</p></div></div>`;
    }
    return `
      <div class="notif-card">
        <span class="notif-bell">${AF.icon('bell')}</span>
        <div><strong>Ne ratez aucun rappel</strong><p>Autorisez les notifications pour être prévenu à l'heure.</p></div>
        <button class="btn btn-primary btn-sm" data-enable-notif>Activer</button>
      </div>`;
  }

  async function remindersView() {
    const [reminders, cats, health] = await Promise.all([AF.db.getAll('reminders'), AF.getCats(), AF.db.getAll('health')]);
    const catById = new Map(cats.map((c) => [c.id, c]));
    const now = new Date();
    const items = AF.todayItems(reminders, now);
    const overdue = items.filter((i) => i.overdue);
    const today = items.filter((i) => !i.overdue);
    const healthItems = AF.healthReminderItems(health, cats, 60);

    const who = (r) => (r.catId && catById.get(r.catId) ? catById.get(r.catId).name : 'Tous les chats');

    const itemRow = (i, idx) => {
      const k = AF.REMINDER_KINDS[i.reminder.kind] || AF.REMINDER_KINDS.other;
      const late = !i.done && (i.overdue || i.date < now);
      return `
        <div class="rem-row ${i.done ? 'is-done' : ''}">
          <button class="rem-check ${i.done ? 'checked' : ''}" data-toggle="${idx}" aria-label="${i.done ? 'Marquer comme pas fait' : 'Marquer comme fait'}">${AF.icon('check')}</button>
          <button class="rem-text" data-edit="${i.reminder.id}">
            <strong>${AF.esc(i.reminder.title)}</strong>
            <small>${AF.esc(who(i.reminder))}${i.reminder.repeat !== 'none' ? ' · ' + AF.esc(AF.REPEATS[i.reminder.repeat]) : ''}${i.reminder.note ? ' · ' + AF.esc(i.reminder.note) : ''}</small>
          </button>
          <span class="rem-time ${late ? 'late' : ''}">
            <span class="tone-dot tone-${k.tone} mini-dot">${AF.icon(k.icon)}</span>
            ${i.overdue ? AF.esc(AF.formatShortDate(AF.toISODate(i.date))) : AF.esc(AF.formatTime(AF.toLocalDateTime(i.date)))}
          </span>
        </div>`;
    };
    // On garde la liste complète pour retrouver l'item quand on coche
    const indexed = overdue.concat(today);

    const allRows = reminders
      .map((r) => ({ r, next: AF.nextOccurrence(r, now) }))
      .sort((a, b) => (a.next ? a.next.getTime() : Infinity) - (b.next ? b.next.getTime() : Infinity))
      .map(({ r, next }) => {
        const k = AF.REMINDER_KINDS[r.kind] || AF.REMINDER_KINDS.other;
        return `
          <button class="h-item" data-edit="${r.id}">
            <span class="tone-dot tone-${k.tone}">${AF.icon(k.icon)}</span>
            <div class="h-item-text">
              <strong>${AF.esc(r.title)}</strong>
              <small>${AF.esc(who(r))} · ${AF.esc(AF.REPEATS[r.repeat] || '')}</small>
            </div>
            ${next ? `<span class="badge badge-muted">${AF.esc(AF.capitalize(AF.relativeDays(AF.daysUntil(AF.toISODate(next)))))} · ${AF.esc(AF.formatTime(AF.toLocalDateTime(next)))}</span>` : '<span class="badge badge-ok">Terminé</span>'}
          </button>`;
      }).join('');

    const doneCount = today.filter((i) => i.done).length;

    const html = `
      ${AF.topbar({
        title: 'Rappels',
        subtitle: AF.capitalize(AF.formatWeekday(now)),
        actions: `<button class="btn-icon btn-icon-primary" data-add aria-label="Nouveau rappel">${AF.icon('plus')}</button>`
      })}
      <div class="page">
        ${notificationCard()}

        ${overdue.length ? `
          <div class="section-head"><h2>En retard</h2></div>
          <div class="card list-card">${overdue.map((i) => itemRow(i, indexed.indexOf(i))).join('')}</div>` : ''}

        <div class="section-head">
          <h2>Aujourd'hui</h2>
          ${today.length ? `<span class="badge badge-muted">${doneCount} / ${today.length} fait${doneCount > 1 ? 's' : ''}</span>` : ''}
        </div>
        ${today.length
          ? `<div class="card list-card">${today.map((i) => itemRow(i, indexed.indexOf(i))).join('')}</div>`
          : `<div class="card card-soft center"><p>Rien de prévu aujourd'hui. ${reminders.length ? '' : 'Créez vos premiers rappels : repas, litière, vermifuge…'}</p>
              ${reminders.length ? '' : `<button class="btn btn-primary btn-sm" data-add>${AF.icon('plus')} Créer un rappel</button>`}</div>`}

        ${healthItems.length ? `
          <div class="section-head"><h2>Santé</h2><span class="badge badge-muted">${AF.icon('repeat')} Depuis le carnet</span></div>
          <div class="card list-card">
            ${healthItems.map(({ entry }) => {
              const cat = catById.get(entry.catId);
              const kind = AF.CARE_KINDS[entry.type];
              return `
                <a class="todo-row" href="#/chat/${encodeURIComponent(entry.catId)}/sante">
                  <span class="tone-dot tone-${kind.tone}">${AF.icon(kind.icon)}</span>
                  <span class="todo-text"><strong>${AF.esc(entry.name)}</strong>
                  <small>${AF.esc(cat.name)} · ${AF.esc(AF.formatDate(entry.nextDate))}</small></span>
                  ${AF.statusBadge(AF.careStatus(entry), true)}
                </a>`;
            }).join('')}
          </div>` : ''}

        ${reminders.length ? `
          <div class="section-head"><h2>Tous mes rappels</h2></div>
          <div class="card list-card">${allRows}</div>` : ''}
      </div>`;

    function mount(root) {
      const refresh = () => { AF.refresh(); AF.updateReminderBadge(); };
      const byId = new Map(reminders.map((r) => [r.id, r]));
      root.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => AF.openReminderForm({ cats, onSaved: refresh })));
      root.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () =>
        AF.openReminderForm({ cats, reminder: byId.get(b.dataset.edit), onSaved: refresh })));
      root.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', async () => {
        const item = indexed[Number(b.dataset.toggle)];
        b.classList.toggle('checked');
        if (!item.done && navigator.vibrate) navigator.vibrate(15); // petite vibration de satisfaction
        await setDone(item.reminder, item.date, !item.done);
        setTimeout(refresh, 250);
      }));
      const enable = root.querySelector('[data-enable-notif]');
      if (enable) enable.addEventListener('click', async () => {
        const result = await AF.notify.request();
        if (result === 'denied') AF.toast('Notifications refusées', 'error');
        refresh();
      });
    }

    return { html, mount };
  }

  AF.route('/rappels', remindersView, 'reminders');
})(self.AF);
