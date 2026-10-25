/* =====================================================================
   views/journal.js — Le journal : album photo, humeurs et souvenirs
   ===================================================================== */

(function (AF) {
  'use strict';

  // Les humeurs du jour
  AF.MOODS = {
    playful: { label: 'Joueur', emoji: '😸' },
    cuddly: { label: 'Câlin', emoji: '🥰' },
    sleepy: { label: 'Dormeur', emoji: '😴' },
    grumpy: { label: 'Grognon', emoji: '😾' },
    sick: { label: 'Malade', emoji: '🤒' }
  };

  /* ---------- "Il y a 1 an aujourd'hui" ---------- */

  // Souvenirs des années passées, à 3 jours près de la date du jour
  AF.getMemories = function (entries, windowDays = 3) {
    const today = AF.startOfDay(new Date());
    const out = [];
    for (const e of entries) {
      const d = AF.parseDate(e.date);
      const years = today.getFullYear() - d.getFullYear();
      if (years < 1) continue;
      // On ramène le souvenir à l'année en cours pour comparer jour et mois
      const sameDayThisYear = new Date(today.getFullYear(), d.getMonth(), d.getDate());
      const diff = Math.round((sameDayThisYear - today) / 86400000);
      if (Math.abs(diff) <= windowDays) out.push({ entry: e, years, diff });
    }
    return out.sort((a, b) => a.years - b.years || Math.abs(a.diff) - Math.abs(b.diff));
  };

  const yearsAgo = (n) => (n === 1 ? 'Il y a 1 an' : 'Il y a ' + n + ' ans');

  /* ---------- Formulaire d'un souvenir ---------- */

  AF.openJournalForm = function ({ cats, entry = null, catId = null, onSaved }) {
    const e = entry || {};
    const selected = e.catId || catId || (cats[0] && cats[0].id);
    AF.sheet({
      title: entry ? 'Modifier le souvenir' : 'Nouveau souvenir',
      content: `
        <form class="form" novalidate>
          ${AF.photoPickerHTML('jr-photo', { shape: 'wide', label: 'Ajouter une photo', placeholder: AF.icon('camera') })}
          ${cats.length > 1 ? `
            <div class="field"><span>Quel chat ?</span>
              <div class="cat-pick">
                ${cats.map((c) => `
                  <label><input type="radio" name="catId" value="${c.id}" ${c.id === selected ? 'checked' : ''}>
                  <span>${AF.catAvatar(c)}<b>${AF.esc(c.name)}</b></span></label>`).join('')}
              </div>
            </div>` : `<input type="hidden" name="catId" value="${selected}">`}
          <div class="field"><span>Humeur du jour</span>
            <div class="mood-pick">
              ${Object.entries(AF.MOODS).map(([v, m]) => `
                <label><input type="radio" name="mood" value="${v}" ${e.mood === v ? 'checked' : ''}><span><b>${m.emoji}</b>${m.label}</span></label>`).join('')}
            </div>
          </div>
          <label class="field"><span>Date <em>*</em></span><input type="date" name="date" required max="${AF.today()}" value="${AF.esc(e.date || AF.today())}"></label>
          <label class="field"><span>Note</span><textarea name="note" maxlength="1000" placeholder="Ce qu'il a fait de drôle aujourd'hui…">${AF.esc(e.note)}</textarea></label>
          <div class="form-actions">
            <button class="btn btn-primary btn-lg btn-block" type="submit">${AF.icon('check')} Enregistrer</button>
            ${entry ? `<button class="btn btn-ghost-danger btn-block" type="button" data-delete>${AF.icon('trash')} Supprimer</button>` : ''}
          </div>
        </form>`,
      onMount(el, close) {
        const form = el.querySelector('form');
        const picker = AF.photoPicker(el.querySelector('#jr-photo'), e.photo || null, { maxSize: 1600 });
        // Le "toucher" sur une humeur déjà choisie la décoche
        el.querySelectorAll('.mood-pick input').forEach((input) => {
          input.addEventListener('click', () => {
            if (input.dataset.was === '1') { input.checked = false; }
            el.querySelectorAll('.mood-pick input').forEach((i) => { i.dataset.was = i.checked ? '1' : ''; });
          });
          input.dataset.was = input.checked ? '1' : '';
        });
        form.addEventListener('submit', async (ev) => {
          ev.preventDefault();
          const data = AF.formData(form);
          const photo = picker.getBlob();
          if (!data.date) { AF.toast('Indiquez une date', 'error'); return; }
          if (!photo && !data.note && !data.mood) { AF.toast('Ajoutez une photo, une humeur ou une note', 'error'); return; }
          await AF.db.put('journal', {
            ...e, id: e.id || AF.uid(), catId: data.catId, date: data.date, mood: data.mood || '', note: data.note, photo,
            createdAt: e.createdAt || new Date().toISOString()
          });
          AF.toast('Souvenir enregistré 💛', 'success');
          close();
          onSaved();
        });
        const del = el.querySelector('[data-delete]');
        if (del) del.addEventListener('click', async () => {
          if (!(await AF.confirm({ title: 'Supprimer ce souvenir ?', confirmText: 'Supprimer', danger: true }))) return;
          await AF.db.delete('journal', e.id);
          close();
          onSaved();
        });
      }
    });
  };

  // Affiche un souvenir en grand
  function openEntry(entry, cat, cats, onSaved) {
    const mood = AF.MOODS[entry.mood];
    AF.sheet({
      title: AF.capitalize(AF.formatWeekday(AF.parseDate(entry.date))) + ' ' + AF.parseDate(entry.date).getFullYear(),
      content: `
        <div class="memory-view">
          ${entry.photo ? `<img class="memory-photo" src="${AF.blobUrl(entry.photo)}" alt="" data-zoom>` : ''}
          <div class="chips">
            ${cat ? `<span class="chip">${AF.esc(cat.name)}</span>` : ''}
            ${mood ? `<span class="chip chip-lavender">${mood.emoji} ${mood.label}</span>` : ''}
          </div>
          ${entry.note ? `<p class="memory-note">${AF.esc(entry.note)}</p>` : ''}
          <button class="btn btn-soft btn-block" data-edit>${AF.icon('edit')} Modifier</button>
        </div>`,
      onMount(el, close) {
        const img = el.querySelector('[data-zoom]');
        if (img) img.addEventListener('click', () => AF.viewImage(entry.photo, entry.note));
        el.querySelector('[data-edit]').addEventListener('click', () => {
          close();
          setTimeout(() => AF.openJournalForm({ cats, entry, onSaved }), 200);
        });
      }
    });
  }

  /* ---------- L'onglet Journal ---------- */

  async function journalView(params) {
    const cats = await AF.getCats();
    if (!cats.length) {
      return {
        html: AF.topbar({ title: 'Journal' }) + `<div class="page">${AF.emptyState({
          title: 'Le journal attend vos chats',
          text: 'Ajoutez un chat pour garder ses plus beaux souvenirs.',
          action: `<a class="btn btn-primary" href="#/nouveau">${AF.icon('plus')} Ajouter un chat</a>`
        })}</div>`
      };
    }
    const filterId = params.catId && cats.some((c) => c.id === params.catId) ? params.catId : null;
    const catById = new Map(cats.map((c) => [c.id, c]));
    let entries = AF.sortByDateDesc(await AF.db.getAll('journal')).filter((e) => catById.has(e.catId));
    if (filterId) entries = entries.filter((e) => e.catId === filterId);
    const mode = (await AF.db.getSetting('journalMode', 'timeline')) === 'album' ? 'album' : 'timeline';
    const memories = AF.getMemories(entries);

    // Frise chronologique, groupée par mois
    const months = new Map();
    for (const e of entries) {
      const key = e.date.slice(0, 7);
      if (!months.has(key)) months.set(key, []);
      months.get(key).push(e);
    }
    const timeline = [...months.entries()].map(([key, list]) => `
      <div class="tl-month">
        <h3 class="tl-month-title">${AF.esc(AF.capitalize(AF.formatMonth(key + '-01')))} <span class="muted">${list.length}</span></h3>
        ${list.map((e) => {
          const cat = catById.get(e.catId);
          const mood = AF.MOODS[e.mood];
          return `
            <button class="tl-item" data-id="${e.id}">
              <span class="tl-dot">${mood ? mood.emoji : '🐾'}</span>
              <div class="tl-card">
                ${e.photo ? `<img src="${AF.blobUrl(e.photo)}" alt="" loading="lazy">` : ''}
                <div class="tl-body">
                  <div class="tl-meta">
                    <span class="tl-cat">${AF.catAvatar(cat)}</span>
                    <b>${AF.esc(cat.name)}</b>
                    <span class="muted">· ${AF.esc(AF.formatShortDate(e.date))}</span>
                    ${mood ? `<span class="chip chip-lavender mini">${mood.label}</span>` : ''}
                  </div>
                  ${e.note ? `<p class="clamp">${AF.esc(e.note)}</p>` : ''}
                </div>
              </div>
            </button>`;
        }).join('')}
      </div>`).join('');

    const withPhotos = entries.filter((e) => e.photo);
    const album = withPhotos.length
      ? `<div class="album">${withPhotos.map((e) => `
          <button class="album-item" data-id="${e.id}">
            <img src="${AF.blobUrl(e.photo)}" alt="" loading="lazy">
            ${AF.MOODS[e.mood] ? `<span>${AF.MOODS[e.mood].emoji}</span>` : ''}
          </button>`).join('')}</div>`
      : '<div class="card card-soft center"><p>Aucune photo pour l\'instant.</p></div>';

    const memoryBlock = memories.length ? `
      <section class="memories">
        <div class="section-head"><h2>✨ Il y a 1 an aujourd'hui</h2></div>
        <div class="memory-strip">
          ${memories.map(({ entry, years }) => {
            const cat = catById.get(entry.catId);
            return `
              <button class="memory-card" data-id="${entry.id}">
                ${entry.photo ? `<img src="${AF.blobUrl(entry.photo)}" alt="">` : `<div class="memory-noimg">${AF.MOODS[entry.mood]?.emoji || '🐾'}</div>`}
                <div class="memory-caption"><b>${yearsAgo(years)}</b><span>${AF.esc(cat.name)} · ${AF.esc(AF.formatDate(entry.date))}</span></div>
              </button>`;
          }).join('')}
        </div>
      </section>` : '';

    const html = `
      ${AF.topbar({
        title: 'Journal',
        subtitle: AF.plural(entries.length, 'souvenir', 'souvenirs'),
        actions: `<button class="btn-icon btn-icon-primary" data-add aria-label="Nouveau souvenir">${AF.icon('plus')}</button>`
      })}
      <div class="page">
        ${cats.length > 1 ? `
          <div class="filter-chips">
            <a class="chip ${!filterId ? 'active' : ''}" href="#/journal">Tous</a>
            ${cats.map((c) => `<a class="chip ${filterId === c.id ? 'active' : ''}" href="#/journal/${encodeURIComponent(c.id)}">${AF.esc(c.name)}</a>`).join('')}
          </div>` : ''}
        ${memoryBlock}
        ${entries.length ? `
          <div class="seg seg-small" role="radiogroup">
            <label><input type="radio" name="jmode" value="timeline" ${mode === 'timeline' ? 'checked' : ''}><span>${AF.icon('timeline')} Frise</span></label>
            <label><input type="radio" name="jmode" value="album" ${mode === 'album' ? 'checked' : ''}><span>${AF.icon('grid')} Album</span></label>
          </div>
          <div id="jr-content">${mode === 'album' ? album : `<div class="timeline">${timeline}</div>`}</div>`
          : AF.emptyState({
            title: 'Premier souvenir ?',
            text: 'Une photo, une humeur, une petite note : le journal garde tout, jour après jour.',
            action: `<button class="btn btn-primary" data-add>${AF.icon('camera')} Ajouter un souvenir</button>`
          })}
      </div>`;

    function mount(root) {
      const refresh = () => AF.refresh();
      const byId = new Map(entries.map((e) => [e.id, e]));
      root.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () =>
        AF.openJournalForm({ cats, catId: filterId, onSaved: refresh })));
      // Un seul écouteur pour tous les souvenirs ("délégation d'événement")
      const onClick = (ev) => {
        const item = ev.target.closest('[data-id]');
        if (!item) return;
        const entry = byId.get(item.dataset.id);
        if (entry) openEntry(entry, catById.get(entry.catId), cats, refresh);
      };
      root.addEventListener('click', onClick);
      root.querySelectorAll('[name=jmode]').forEach((r) => r.addEventListener('change', async () => {
        await AF.db.setSetting('journalMode', r.value);
        refresh();
      }));
      // "root" reste le même d'un écran à l'autre : on retire l'écouteur en partant
      return () => root.removeEventListener('click', onClick);
    }

    return { html, mount };
  }

  AF.route('/journal', journalView, 'journal');
  AF.route('/journal/:catId', journalView, 'journal');
})(self.AF);
