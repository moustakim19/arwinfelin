/* =====================================================================
   views/cat-detail.js — La fiche d'un chat
   ---------------------------------------------------------------------
   La fiche est découpée en "sections" (Profil, Santé, Poids...).
   Chaque fichier peut ajouter sa propre section avec AF.addCatSection(),
   ce qui permet d'agrandir l'appli sans toucher à ce fichier.
   ===================================================================== */

(function (AF) {
  'use strict';

  // Liste des sections de la fiche, dans l'ordre d'affichage
  AF.catSections = [];

  // section = { id, label, icon, render: async (cat) => ({ html, mount(el) }) }
  AF.addCatSection = function (section) {
    AF.catSections.push(section);
  };

  /* ---------- Section "Profil" ---------- */

  function infoRow(icon, label, value) {
    return `
      <div class="info-row">
        <span class="info-icon">${AF.icon(icon)}</span>
        <span class="info-label">${AF.esc(label)}</span>
        <span class="info-value">${value ? AF.esc(value) : '<span class="muted">—</span>'}</span>
      </div>`;
  }

  AF.addCatSection({
    id: 'profil',
    label: 'Profil',
    icon: 'paw',
    async render(cat) {
      const age = AF.catAge(cat.birthDate);
      let ageBlock;

      if (age) {
        const human = AF.humanAge(age.totalMonths);
        const stage = AF.lifeStage(age.totalMonths);
        const birthdayIn = AF.daysToBirthday(cat.birthDate);
        const birthdayText = birthdayIn === 0
          ? `Joyeux anniversaire ${AF.esc(cat.name)} ! 🎉`
          : `Anniversaire ${birthdayIn === 1 ? 'demain' : 'dans ' + birthdayIn + ' jours'} 🎂`;

        ageBlock = `
          <div class="age-grid">
            <div class="age-card age-real">
              <span class="age-label">Âge réel</span>
              <strong>${AF.esc(AF.ageLabel(age))}</strong>
            </div>
            <div class="age-card age-human">
              <span class="age-label">En âge humain</span>
              <strong>≈ ${human} ans</strong>
            </div>
          </div>
          <div class="chips">
            <span class="chip chip-lavender">${stage.emoji} ${AF.esc(stage.label)}</span>
            <span class="chip chip-apricot">${birthdayText}</span>
          </div>
          <p class="hint">${AF.icon('info')} Âge humain estimé : 1 an de chat ≈ 15 ans, 2 ans ≈ 24 ans, puis +4 ans par année.</p>`;
      } else {
        ageBlock = `
          <div class="card card-soft center">
            <p>Ajoutez sa date de naissance pour découvrir son âge en années humaines.</p>
            <a class="btn btn-soft btn-sm" href="#/chat/${encodeURIComponent(cat.id)}/modifier">${AF.icon('cake')} Ajouter la date</a>
          </div>`;
      }

      const sexLabel = cat.sex === 'male' ? '♂ Mâle' : cat.sex === 'female' ? '♀ Femelle' : '';
      const sterLabel = cat.sterilized
        ? (cat.sex === 'female' ? 'Oui, stérilisée' : cat.sex === 'male' ? 'Oui, castré' : 'Oui')
        : 'Non';

      const html = `
        ${ageBlock}
        <div class="card info-card">
          ${infoRow('cake', 'Naissance', cat.birthDate ? AF.formatDate(cat.birthDate) : '')}
          ${infoRow('gender', 'Sexe', sexLabel)}
          ${infoRow('paw', 'Race', cat.breed)}
          ${cat.breed ? '' : `<a class="info-cta" href="#/race/${encodeURIComponent(cat.id)}">${AF.icon('scan')} Quelle est sa race ? Demandez à l'IA</a>`}
          ${infoRow('palette', 'Robe', cat.color)}
          ${infoRow('chip', 'Puce', cat.chip)}
          ${infoRow('shield', 'Stérilisation', sterLabel)}
        </div>`;
      return { html };
    }
  });

  /* ---------- L'écran complet ---------- */

  async function catDetailView(params) {
    const cat = await AF.db.get('cats', params.id);
    if (!cat) {
      return { html: AF.topbar({ title: 'Chat introuvable', back: true }) + `<div class="page">${AF.emptyState({ title: "Ce chat n'existe plus" })}</div>` };
    }
    const sections = AF.catSections;
    let current = sections.find((s) => s.id === params.section) || sections[0];
    const catPath = '/chat/' + encodeURIComponent(cat.id);

    const html = `
      <section class="cat-hero ${cat.photo ? '' : 'no-photo'}">
        <div class="cat-hero-photo">${AF.catAvatar(cat, 'cat-hero-img')}</div>
        <div class="cat-hero-bar">
          <button class="btn-icon btn-glass" data-back aria-label="Retour">${AF.icon('back')}</button>
          <div class="cat-hero-actions" id="hero-actions">
            <a class="btn-icon btn-glass" href="#/race/${encodeURIComponent(cat.id)}" aria-label="Quelle est sa race ?">${AF.icon('scan')}</a>
            <a class="btn-icon btn-glass" href="#${catPath}/modifier" aria-label="Modifier">${AF.icon('edit')}</a>
          </div>
        </div>
        <div class="cat-hero-info">
          <h1>${AF.esc(cat.name)}</h1>
          <p>${AF.esc([cat.breed, cat.color].filter(Boolean).join(' · ') || 'Mon compagnon')}</p>
        </div>
      </section>

      ${sections.length > 1 ? `
        <nav class="tabs" role="tablist">
          ${sections.map((s) => `
            <button role="tab" data-section="${s.id}" class="${s === current ? 'active' : ''}">
              ${AF.icon(s.icon)}<span>${AF.esc(s.label)}</span>
            </button>`).join('')}
        </nav>` : ''}

      <div class="page cat-page" id="section-body"></div>`;

    function mount(root) {
      const body = root.querySelector('#section-body');
      let sectionCleanup = null;
      let token = 0;

      // Affiche une section dans la fiche
      async function show(section) {
        const myToken = ++token;
        current = section;
        root.querySelectorAll('.tabs [data-section]').forEach((b) => {
          const on = b.dataset.section === section.id;
          b.classList.toggle('active', on);
          b.setAttribute('aria-selected', on);
          if (on) b.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
        });
        // On change l'adresse SANS créer de nouvelle page dans l'historique
        const path = section === sections[0] ? catPath : catPath + '/' + section.id;
        history.replaceState(history.state, '', '#' + path);

        const freshCat = await AF.db.get('cats', cat.id);
        const result = await section.render(freshCat || cat);
        if (myToken !== token) return; // l'utilisateur a déjà changé d'onglet
        if (sectionCleanup) sectionCleanup();
        sectionCleanup = null;
        body.innerHTML = result.html;
        body.classList.remove('fade-in');
        void body.offsetWidth;
        body.classList.add('fade-in');
        if (result.mount) sectionCleanup = result.mount(body, () => show(current)) || null;
      }

      root.querySelectorAll('.tabs [data-section]').forEach((btn) => {
        btn.addEventListener('click', () => show(sections.find((s) => s.id === btn.dataset.section)));
      });

      show(current);
      // Nettoyage quand on quitte la fiche
      return () => { if (sectionCleanup) sectionCleanup(); };
    }

    return { html, mount };
  }

  AF.route('/chat/:id', catDetailView, 'home');
  AF.route('/chat/:id/:section', catDetailView, 'home');
})(self.AF);
