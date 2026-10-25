/* =====================================================================
   views/home.js — Écran d'accueil : la liste de mes chats
   ===================================================================== */

(function (AF) {
  'use strict';

  // Phrase d'accueil selon l'heure de la journée
  function greeting() {
    const h = new Date().getHours();
    if (h < 6) return 'Bonne nuit';
    if (h < 12) return 'Bonjour';
    if (h < 18) return 'Bon après-midi';
    return 'Bonsoir';
  }

  // Carte d'un chat (photo + nom + âge)
  function catCard(cat, index) {
    const age = AF.catAge(cat.birthDate);
    const sex = cat.sex === 'male' ? '♂' : cat.sex === 'female' ? '♀' : '';
    return `
      <a class="cat-card" href="#/chat/${encodeURIComponent(cat.id)}" style="--i:${index}">
        <div class="cat-card-photo">
          ${AF.catAvatar(cat)}
          ${sex ? `<span class="cat-card-sex ${cat.sex}">${sex}</span>` : ''}
        </div>
        <div class="cat-card-body">
          <h3>${AF.esc(cat.name)}</h3>
          <p>${AF.esc([AF.ageShort(age), cat.breed].filter(Boolean).join(' · ') || 'Mon chat')}</p>
        </div>
      </a>`;
  }

  async function homeView() {
    const cats = await AF.getCats();

    const header = `
      <header class="home-head">
        <div>
          <p class="home-hello">${greeting()} 👋</p>
          <h1 class="home-title">Mes chats</h1>
        </div>
        <a class="btn-icon btn-icon-primary" href="#/nouveau" aria-label="Ajouter un chat">${AF.icon('plus')}</a>
      </header>`;

    // Aucun chat pour l'instant : on affiche un joli écran d'accueil
    if (cats.length === 0) {
      return {
        html: header + `<div class="page">
          ${AF.emptyState({
            title: 'Bienvenue sur ArwinFelin',
            text: "Ajoutez votre premier chat pour suivre sa santé, son poids, ses souvenirs et ses rappels.",
            action: `<a class="btn btn-primary btn-lg" href="#/nouveau">${AF.icon('plus')} Ajouter mon chat</a>`
          })}
        </div>`
      };
    }

    // Un souvenir d'il y a un an (ou plus) à la même date ?
    const catIds = new Set(cats.map((c) => c.id));
    const journal = (await AF.db.getAll('journal')).filter((e) => catIds.has(e.catId));
    const memory = AF.getMemories(journal)[0];
    const memoryCat = memory && cats.find((c) => c.id === memory.entry.catId);
    const memoryBlock = memory ? `
      <a class="memory-banner" href="#/journal">
        ${memory.entry.photo ? `<img src="${AF.blobUrl(memory.entry.photo)}" alt="">` : `<span class="memory-banner-emoji">${AF.MOODS[memory.entry.mood]?.emoji || '🐾'}</span>`}
        <span><small>✨ ${memory.years === 1 ? 'Il y a 1 an' : 'Il y a ' + memory.years + ' ans'}</small>
        <b>Un souvenir de ${AF.esc(memoryCat.name)}</b></span>
        ${AF.icon('chevron')}
      </a>` : '';

    // Les rappels du jour (et ceux du carnet de santé à faire aujourd'hui ou en retard)
    const [reminders, health] = await Promise.all([AF.db.getAll('reminders'), AF.db.getAll('health')]);
    const now = new Date();
    const todayList = AF.todayItems(reminders, now).filter((i) => !i.done);
    const healthDue = AF.healthReminderItems(health, cats, 0);
    const todayCount = todayList.length + healthDue.length;
    const todayBlock = todayCount ? `
      <a class="today-banner" href="#/rappels">
        <span class="today-bell">${AF.icon('bell')}<b>${todayCount}</b></span>
        <span class="today-list">
          <strong>Aujourd'hui</strong>
          <small>${AF.esc(todayList.slice(0, 3).map((i) => (i.overdue ? '⏰ ' : AF.formatTime(AF.toLocalDateTime(i.date)) + ' ') + i.reminder.title)
            .concat(healthDue.slice(0, 2).map((h) => '💉 ' + h.entry.name)).join(' · '))}</small>
        </span>
        ${AF.icon('chevron')}
      </a>` : '';

    const html = header + `
      <div class="page">
        <section class="hero">
          <div class="hero-text">
            <p class="hero-kicker">Ma petite famille</p>
            <h2>${cats.length} ${cats.length > 1 ? 'chats adorés' : 'chat adoré'}</h2>
            <p class="hero-sub">${AF.esc(AF.capitalize(AF.formatWeekday(new Date())))}</p>
          </div>
          <div class="hero-faces">
            ${cats.slice(0, 3).map((c) => AF.catAvatar(c, 'avatar-stack')).join('')}
          </div>
        </section>

        ${todayBlock}
        ${memoryBlock}
        ${AF.installCardHTML(true)}

        <a class="ai-card" href="#/race">
          <span class="ai-card-icon">${AF.icon('scan')}</span>
          <span><strong>Quelle est sa race ?</strong><small>Une photo suffit. IA gratuite, dans le téléphone.</small></span>
          ${AF.icon('sparkles', 'ai-sparkle')}
        </a>

        <div class="section-head"><h2>Mes compagnons</h2></div>
        <div class="cat-grid">
          ${cats.map(catCard).join('')}
          <a class="cat-card cat-card-add" href="#/nouveau" style="--i:${cats.length}">
            <span class="cat-card-add-icon">${AF.icon('plus')}</span>
            <span>Ajouter un chat</span>
          </a>
        </div>
      </div>`;

    return { html, mount: (root) => AF.bindInstallCard(root) };
  }

  AF.route('/', homeView, 'home');
})(self.AF);
