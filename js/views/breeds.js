/* =====================================================================
   views/breeds.js — "Quelle est sa race ?" et la page "Toutes les races"
   ===================================================================== */

(function (AF) {
  'use strict';

  const pct = (p) => Math.round(p * 100) + ' %';

  // Fiche d'une race (origine, caractère, entretien, santé)
  AF.breedSheetHTML = function (b) {
    return `
      <div class="breed-facts">
        <div class="fact"><span>${AF.icon('home')}</span><div><b>Origine</b><p>${AF.esc(b.origin)}</p></div></div>
        <div class="fact"><span>${AF.icon('heart')}</span><div><b>Caractère</b><p>${AF.esc(b.character)}</p></div></div>
        <div class="fact"><span>${AF.icon('sparkles')}</span><div><b>Entretien</b><p>${AF.esc(b.care)}</p></div></div>
        <div class="fact"><span>${AF.icon('health')}</span><div><b>Santé à surveiller</b><p>${AF.esc(b.health)}</p></div></div>
      </div>`;
  };

  const hairBadge = (hair) => `<span class="badge hair-${hair}">${AF.esc(AF.HAIR_TYPES[hair])}</span>`;

  /* ---------- Choisir une race à la main ---------- */

  // onPick(nom) est appelé avec le nom choisi
  AF.openBreedPicker = function (onPick) {
    const options = [
      { name: AF.DOMESTIC.short.name, hair: 'short' },
      { name: AF.DOMESTIC.long.name, hair: 'long' },
      { name: 'Chat croisé', hair: '' },
      ...AF.BREEDS
    ];
    AF.sheet({
      title: 'Choisir la race',
      content: `
        <label class="search-box">${AF.icon('search')}<input type="search" placeholder="Rechercher une race…" autocomplete="off"></label>
        <div class="pick-list">
          ${options.map((o, i) => `<button class="pick-item" data-i="${i}" data-name="${AF.esc(o.name.toLowerCase())}"><span>${AF.esc(o.name)}</span>${o.hair ? hairBadge(o.hair) : ''}</button>`).join('')}
        </div>`,
      onMount(el, close) {
        const input = el.querySelector('input');
        input.addEventListener('input', () => {
          const q = AF.normalizeText(input.value);
          el.querySelectorAll('.pick-item').forEach((b) => { b.hidden = q && !AF.normalizeText(b.dataset.name).includes(q); });
        });
        el.querySelectorAll('.pick-item').forEach((b) => b.addEventListener('click', () => {
          close();
          onPick(options[Number(b.dataset.i)].name);
        }));
      }
    });
  };

  // "Maine Coon" et "maine coon" ou "Sacré" et "sacre" doivent correspondre
  AF.normalizeText = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

  /* ---------- Écran "Quelle est sa race ?" ---------- */

  async function scanView(params) {
    const cats = await AF.getCats();
    const cat = params.catId ? cats.find((c) => c.id === params.catId) : null;
    const downloaded = await AF.breedAI.isDownloaded();

    const html = `
      ${AF.topbar({ title: 'Quelle est sa race ?', back: true, subtitle: cat ? 'Pour ' + cat.name : 'IA gratuite, dans votre téléphone' })}
      <div class="page" id="scan-root">
        <section class="scan-intro" id="scan-intro">
          <div class="scan-art">${AF.catFaceSVG('#F6B48F')}<span class="scan-ring"></span></div>
          <h2>Montrez-moi le chat !</h2>
          <p class="muted">Une photo nette, bien éclairée, avec le chat entier si possible. L'analyse se fait sur l'appareil : la photo ne quitte jamais votre téléphone.</p>
          <div class="btn-row">
            <button class="btn btn-primary btn-lg" data-pick="camera">${AF.icon('camera')} Photo</button>
            <button class="btn btn-soft btn-lg" data-pick="gallery">${AF.icon('image')} Galerie</button>
          </div>
          ${downloaded ? '' : `<p class="hint">${AF.icon('wifi')} La première fois, le modèle d'IA (environ 90 Mo) est téléchargé une seule fois. Wi-Fi conseillé. Ensuite, ça marche même hors ligne.</p>`}
          <a class="link-muted" href="#/races">${AF.icon('paw')} Voir toutes les races (${AF.BREEDS.length})</a>
        </section>
        <div id="scan-stage"></div>
      </div>`;

    function mount(root) {
      const intro = root.querySelector('#scan-intro');
      const stage = root.querySelector('#scan-stage');
      let alive = true;
      let photoUrl = null;

      root.querySelectorAll('[data-pick]').forEach((btn) => btn.addEventListener('click', async () => {
        // Le sélecteur de photo doit s'ouvrir tout de suite après le clic
        const file = await AF.pickImage({ camera: btn.dataset.pick === 'camera' });
        if (!file || !alive) return;
        if (!(await AF.breedAI.isDownloaded()) && !AF.breedAI.isLoaded()) {
          const ok = await AF.confirm({
            title: 'Télécharger le modèle ?',
            message: "Le modèle d'IA (environ 90 Mo) va être téléchargé une seule fois, puis gardé sur l'appareil pour marcher hors ligne. Le Wi-Fi est conseillé.",
            confirmText: 'Télécharger'
          });
          if (!ok) return;
        }
        run(file);
      }));

      async function run(file) {
        intro.hidden = true;
        if (photoUrl) URL.revokeObjectURL(photoUrl);
        photoUrl = URL.createObjectURL(file);
        try {
          if (!AF.breedAI.isLoaded()) {
            stage.innerHTML = `
              <div class="card download-card">
                <div class="dl-icon">${AF.icon('download')}</div>
                <h3>Préparation de l'IA</h3>
                <p class="muted small" id="dl-text">Préparation…</p>
                <div class="progress big"><i id="dl-bar" style="width:0%"></i></div>
                <p class="dl-pct" id="dl-pct">0 %</p>
                <p class="hint">${AF.icon('info')} Une seule fois. Ne fermez pas l'appli pendant le téléchargement.</p>
              </div>`;
            await AF.breedAI.load((p, text) => {
              if (!alive) return;
              stage.querySelector('#dl-bar').style.width = p + '%';
              stage.querySelector('#dl-pct').textContent = Math.round(p) + ' %';
              stage.querySelector('#dl-text').textContent = text;
            });
          }
          if (!alive) return;
          stage.innerHTML = `
            <div class="analyzing">
              <div class="analyzing-photo">
                <img src="${photoUrl}" alt="">
                <span class="scan-line"></span>
                <span class="scan-corners"></span>
              </div>
              <p class="analyzing-text"><span class="paw-dots"><i>🐾</i><i>🐾</i><i>🐾</i></span> Analyse des moustaches…</p>
            </div>`;
          const messages = ['Analyse des moustaches…', 'Examen du pelage…', 'Comparaison avec ' + AF.BREEDS.length + ' races…'];
          let m = 0;
          const timer = setInterval(() => {
            const el = stage.querySelector('.analyzing-text');
            if (el) el.lastChild.textContent = ' ' + messages[++m % messages.length];
          }, 900);
          // On laisse l'animation s'afficher au moins un instant (c'est plus agréable)
          const [result] = await Promise.all([AF.breedAI.analyze(file), new Promise((r) => setTimeout(r, 1400))]);
          clearInterval(timer);
          if (!alive) return;
          showResult(result);
        } catch (error) {
          console.error(error);
          stage.innerHTML = `
            <div class="alert alert-danger">${AF.icon('alert')}<div><strong>L'analyse n'a pas pu se faire</strong>
            <p>${AF.esc(navigator.onLine ? error.message : 'Pas de connexion internet : le modèle doit être téléchargé une première fois.')}</p></div></div>
            <button class="btn btn-soft btn-block" data-retry>${AF.icon('repeat')} Réessayer</button>`;
          stage.querySelector('[data-retry]').addEventListener('click', () => { stage.innerHTML = ''; intro.hidden = false; });
        }
      }

      function showResult(r) {
        const best = r.top[0];
        let headline;
        if (r.kind === 'notcat') {
          headline = `
            <div class="result-head notcat">
              <span class="result-emoji">🙈</span>
              <h2>Hmm, je ne vois pas de chat…</h2>
              <p class="muted">Peut-être qu'il se cache ? Essayez une photo bien éclairée, où le chat est bien visible.</p>
            </div>`;
        } else if (r.kind === 'breed') {
          headline = `
            <div class="result-head">
              <p class="result-kicker">C'est probablement</p>
              <h2>${AF.esc(best.name)}</h2>
              <div class="chips center-chips">${hairBadge(best.breed.hair)}<span class="badge badge-ok">${pct(best.prob)} de confiance</span></div>
            </div>`;
        } else if (r.kind === 'domestic') {
          headline = `
            <div class="result-head">
              <p class="result-kicker">Un chat unique !</p>
              <h2>${AF.esc(best.name)}</h2>
              <p class="muted">Pas de race précise : un « européen » de cœur, comme la plupart des chats.</p>
            </div>`;
        } else {
          headline = `
            <div class="result-head">
              <p class="result-kicker">Mystère…</p>
              <h2>Chat croisé ou race indéterminée</h2>
              <p class="muted">L'IA hésite entre plusieurs races. Voici les pistes les plus proches :</p>
            </div>`;
        }

        const list = r.kind === 'breed' ? r.top : r.hints || [];
        const bars = r.kind === 'notcat' ? '' : `
          <div class="card result-bars">
            <h3>${r.kind === 'breed' ? 'Les 3 races les plus probables' : 'Pistes'}</h3>
            ${list.map((x, i) => `
              <button class="result-bar" data-breed="${x.breed ? x.breed.id : ''}" style="--i:${i}">
                ${x.breed ? `<span class="rb-photo"><img src="${x.breed.photo}" alt="" onerror="this.remove()"><b>${i + 1}</b></span>` : `<span class="rb-rank">${i + 1}</span>`}
                <span class="rb-main"><b>${AF.esc(x.name)}</b><span class="rb-track"><i style="--w:${Math.max(3, x.prob * 100)}%"></i></span></span>
                <span class="rb-pct">${pct(x.prob)}</span>
              </button>`).join('')}
          </div>`;

        const sheet = r.kind === 'breed' ? `
          <div class="card result-sheet">
            <img class="result-breed-photo" src="${best.breed.photo}" alt="${AF.esc(best.name)}" onerror="this.remove()">
            <div class="group-head"><span class="tone-dot tone-primary">${AF.icon('paw')}</span><h3>Fiche : ${AF.esc(best.name)}</h3></div>
            ${AF.breedSheetHTML(best.breed)}
            <a class="btn btn-soft btn-block" href="#/races/${encodeURIComponent(best.breed.id)}">${AF.icon('chevron')} Voir la fiche complète</a>
          </div>` : '';

        const suggested = r.kind === 'breed' ? best.name : r.kind === 'domestic' ? best.name : r.kind === 'mixed' ? 'Chat croisé' : '';
        const saveBlock = r.kind === 'notcat' || !cats.length ? '' : `
          <div class="card save-card">
            ${cat ? '' : `
              <label class="field"><span>Pour quel chat ?</span>
                <select id="save-cat">${cats.map((c) => `<option value="${c.id}">${AF.esc(c.name)}</option>`).join('')}</select>
              </label>`}
            <button class="btn btn-primary btn-block" data-save>${AF.icon('check')} Enregistrer « ${AF.esc(suggested)} »${cat ? ' pour ' + AF.esc(cat.name) : ''}</button>
            <button class="btn btn-ghost btn-block" data-wrong>${AF.icon('edit')} Ce n'est pas la bonne race</button>
          </div>`;

        stage.innerHTML = `
          <div class="result fade-in">
            <div class="result-photo"><img src="${photoUrl}" alt=""></div>
            ${headline}
            ${bars}
            ${sheet}
            <p class="disclaimer">${AF.icon('info')} Résultat indicatif : l'IA peut se tromper, surtout pour les chats croisés.</p>
            ${saveBlock}
            <button class="btn btn-soft btn-block" data-again>${AF.icon('camera')} Analyser une autre photo</button>
            <p class="muted small center">Analyse faite en ${(r.ms / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} s, sur votre appareil.</p>
          </div>`;

        // Petite animation des barres après l'affichage
        requestAnimationFrame(() => stage.querySelectorAll('.rb-track i').forEach((i) => i.classList.add('grow')));

        stage.querySelectorAll('[data-breed]').forEach((b) => b.addEventListener('click', () => {
          const breed = AF.BREEDS.find((x) => x.id === b.dataset.breed);
          if (breed) openBreedInfo(breed);
        }));
        stage.querySelector('[data-again]').addEventListener('click', () => { stage.innerHTML = ''; intro.hidden = false; window.scrollTo(0, 0); });

        const targetCat = () => cat || cats.find((c) => c.id === stage.querySelector('#save-cat').value);
        const save = async (breedName) => {
          const c = await AF.db.get('cats', targetCat().id);
          await AF.db.put('cats', { ...c, breed: breedName, updatedAt: new Date().toISOString() });
          AF.toast('Race enregistrée pour ' + c.name, 'success');
          AF.go('/chat/' + encodeURIComponent(c.id), { replace: Boolean(cat) });
        };
        const saveBtn = stage.querySelector('[data-save]');
        if (saveBtn) saveBtn.addEventListener('click', () => save(suggested));
        const wrong = stage.querySelector('[data-wrong]');
        if (wrong) wrong.addEventListener('click', () => AF.openBreedPicker(save));
      }

      return () => { alive = false; if (photoUrl) URL.revokeObjectURL(photoUrl); };
    }

    return { html, mount };
  }

  /* ---------- Page "Toutes les races" ---------- */

  function openBreedInfo(b) {
    AF.go('/races/' + encodeURIComponent(b.id));
  }

  // Une carte de race avec sa photo
  function breedCard(b, i) {
    return `
      <a class="breed-card" href="#/races/${encodeURIComponent(b.id)}" data-hair="${b.hair}"
         data-search="${AF.esc(AF.normalizeText(b.name + ' ' + b.en + ' ' + b.origin))}" style="--i:${Math.min(i, 12)}">
        <span class="breed-card-photo">
          <img src="${b.photo}" alt="${AF.esc(b.name)}" loading="lazy" decoding="async" onerror="this.remove()">
          <span class="breed-card-initial">${AF.esc(b.name.charAt(0))}</span>
          ${hairBadge(b.hair)}
        </span>
        <span class="breed-card-body">
          <strong>${AF.esc(b.name)}</strong>
          <small>${AF.esc(b.origin)}</small>
        </span>
      </a>`;
  }

  async function breedsView() {
    const filters = [['all', 'Toutes'], ...Object.entries(AF.HAIR_TYPES)];
    const html = `
      ${AF.topbar({ title: 'Toutes les races', back: true, subtitle: AF.BREEDS.length + ' races reconnues (TICA, CFA, FIFe)' })}
      <div class="page">
        <label class="search-box">${AF.icon('search')}<input type="search" id="breed-search" placeholder="Rechercher : Persan, Bengal, Japon…" autocomplete="off"></label>
        <div class="filter-chips">
          ${filters.map(([v, l], i) => `<button class="chip ${i === 0 ? 'active' : ''}" data-hair="${v}">${AF.esc(l)}</button>`).join('')}
        </div>
        <p class="muted small" id="breed-count">${AF.BREEDS.length} races</p>
        <div class="breed-grid" id="breed-list">${AF.BREEDS.map(breedCard).join('')}</div>
        <p class="empty-search muted center" hidden>Aucune race ne correspond.</p>
        <a class="btn btn-primary btn-block" href="#/race">${AF.icon('scan')} Reconnaître une race en photo</a>
        <p class="muted small center">Photos : Wikimédia Commons (licences libres, auteurs cités sur chaque fiche).</p>
      </div>`;

    function mount(root) {
      const input = root.querySelector('#breed-search');
      let hair = 'all';
      const apply = () => {
        const q = AF.normalizeText(input.value);
        let visible = 0;
        root.querySelectorAll('.breed-card').forEach((el) => {
          const show = (hair === 'all' || el.dataset.hair === hair) && (!q || el.dataset.search.includes(q));
          el.hidden = !show;
          if (show) visible++;
        });
        root.querySelector('.empty-search').hidden = visible > 0;
        root.querySelector('#breed-count').textContent = AF.plural(visible, 'race', 'races');
      };
      input.addEventListener('input', apply);
      root.querySelectorAll('.chip[data-hair]').forEach((chip) => chip.addEventListener('click', () => {
        hair = chip.dataset.hair;
        root.querySelectorAll('.chip[data-hair]').forEach((c) => c.classList.toggle('active', c === chip));
        apply();
      }));
    }
    return { html, mount };
  }

  /* ---------- Fiche complète d'une race ---------- */

  // Une note de 1 à 5, dessinée avec des pattes
  function ratingRow(label, value, hint) {
    return `
      <div class="rating-row">
        <span class="rating-label"><b>${AF.esc(label)}</b><small>${AF.esc(hint)}</small></span>
        <span class="rating-paws" aria-label="${value} sur 5">
          ${[1, 2, 3, 4, 5].map((n) => `<i class="${n <= value ? 'on' : ''}">${AF.icon('paw')}</i>`).join('')}
        </span>
      </div>`;
  }

  const range = (a, b, unit) => AF.formatNumber(a, 1) + ' à ' + AF.formatNumber(b, 1) + ' ' + unit;

  async function breedDetailView(params) {
    const b = AF.BREEDS.find((x) => x.id === params.id);
    if (!b) return { html: AF.topbar({ title: 'Race inconnue', back: true }) + `<div class="page">${AF.emptyState({ title: 'Cette race est introuvable' })}</div>` };
    const credits = await AF.getBreedPhotoCredits();
    const credit = credits[b.id];
    const r = b.ratings || {};
    // Quelques races du même type de poil, pour continuer la visite
    const index = AF.BREEDS.indexOf(b);
    const similar = AF.BREEDS.filter((x) => x.hair === b.hair && x.id !== b.id)
      .sort((x, y) => Math.abs(AF.BREEDS.indexOf(x) - index) - Math.abs(AF.BREEDS.indexOf(y) - index))
      .slice(0, 8);

    const html = `
      <section class="cat-hero breed-hero">
        <div class="cat-hero-photo"><img class="avatar" src="${b.photo}" alt="${AF.esc(b.name)}" onerror="this.remove()"></div>
        <div class="cat-hero-bar">
          <button class="btn-icon btn-glass" data-back aria-label="Retour">${AF.icon('back')}</button>
        </div>
        <div class="cat-hero-info">
          <h1>${AF.esc(b.name)}</h1>
          <p>${AF.esc(b.origin)}</p>
        </div>
      </section>

      <div class="page breed-page">
        <div class="chips">
          ${hairBadge(b.hair)}
          ${b.size ? `<span class="badge badge-muted">${AF.esc(b.size)} gabarit</span>` : ''}
          ${b.en !== b.name ? `<span class="badge badge-muted">En anglais : ${AF.esc(b.en)}</span>` : ''}
        </div>

        ${b.weight ? `
          <div class="stat-grid">
            <div class="stat"><span>Poids adulte</span><strong class="stat-small">${range(b.weight[0], b.weight[1], 'kg')}</strong></div>
            <div class="stat"><span>Espérance de vie</span><strong class="stat-small">${b.life[0]} à ${b.life[1]} ans</strong></div>
            <div class="stat"><span>Gabarit</span><strong class="stat-small">${AF.esc(b.size)}</strong></div>
          </div>` : ''}

        ${AF.breedTags(b).length ? `<div class="chips">${AF.breedTags(b).map((t) => `<span class="chip chip-lavender">${AF.esc(t)}</span>`).join('')}</div>` : ''}

        ${b.history ? `
          <div class="card">
            <div class="group-head"><span class="tone-dot tone-apricot">${AF.icon('star')}</span><h3>Son histoire</h3></div>
            <p class="breed-history">${AF.esc(b.history)}</p>
          </div>` : ''}

        ${b.ratings ? `
          <div class="card ratings-card">
            <div class="group-head"><span class="tone-dot tone-lavender">${AF.icon('paw')}</span><h3>En un coup d'œil</h3></div>
            ${ratingRow('Énergie', r.energy, r.energy >= 4 ? 'Joueur, a besoin de se dépenser' : r.energy <= 2 ? 'Plutôt calme et posé' : 'Actif sans excès')}
            ${ratingRow('Affection', r.affection, r.affection >= 5 ? 'Adore les câlins' : r.affection <= 3 ? 'Affectueux mais indépendant' : 'Proche de ses humains')}
            ${ratingRow('Entretien', r.grooming, r.grooming >= 4 ? 'Soins réguliers indispensables' : r.grooming <= 1 ? 'Très facile' : 'Un peu de brossage')}
            ${ratingRow('Bavardage', r.vocal, r.vocal >= 4 ? 'Il vous racontera sa journée' : r.vocal <= 1 ? 'Très discret' : 'Miaule de temps en temps')}
          </div>` : ''}

        <div class="card">
          <div class="group-head"><span class="tone-dot tone-primary">${AF.icon('file')}</span><h3>La fiche</h3></div>
          ${AF.breedSheetHTML(b)}
        </div>

        ${similar.length ? `
          <div class="section-head"><h2>Dans le même style</h2></div>
          <div class="similar-strip">${similar.map((s) => `
            <a class="similar-item" href="#/races/${encodeURIComponent(s.id)}">
              <img src="${s.photo}" alt="" loading="lazy" onerror="this.remove()">
              <span>${AF.esc(s.name)}</span>
            </a>`).join('')}</div>` : ''}

        <a class="btn btn-primary btn-block" href="#/race">${AF.icon('scan')} Mon chat est-il un ${AF.esc(b.name)} ?</a>

        ${credit ? `<p class="photo-credit">Photo : ${AF.esc(credit.artist)}${credit.license ? ' · ' + AF.esc(credit.license) : ''} ·
          <a href="${AF.esc(credit.source)}" target="_blank" rel="noopener">Wikimédia Commons</a></p>` : ''}
        <p class="disclaimer">${AF.icon('info')} Valeurs habituelles de la race : chaque chat est unique.</p>
      </div>`;

    return { html };
  }

  AF.route('/race', scanView, 'home');
  AF.route('/race/:catId', scanView, 'home');
  AF.route('/races', breedsView, 'profile');
  AF.route('/races/:id', breedDetailView, 'profile');
})(self.AF);
