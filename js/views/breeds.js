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
                <span class="rb-rank">${i + 1}</span>
                <span class="rb-main"><b>${AF.esc(x.name)}</b><span class="rb-track"><i style="--w:${Math.max(3, x.prob * 100)}%"></i></span></span>
                <span class="rb-pct">${pct(x.prob)}</span>
              </button>`).join('')}
          </div>`;

        const sheet = r.kind === 'breed' ? `
          <div class="card">
            <div class="group-head"><span class="tone-dot tone-primary">${AF.icon('paw')}</span><h3>Fiche : ${AF.esc(best.name)}</h3></div>
            ${AF.breedSheetHTML(best.breed)}
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
    AF.sheet({
      title: b.name,
      content: `<div class="chips">${hairBadge(b.hair)}<span class="badge badge-muted">${AF.esc(b.origin)}</span></div>${AF.breedSheetHTML(b)}`
    });
  }

  async function breedsView() {
    const filters = [['all', 'Toutes'], ...Object.entries(AF.HAIR_TYPES)];
    const html = `
      ${AF.topbar({ title: 'Toutes les races', back: true, subtitle: AF.BREEDS.length + ' races reconnues (TICA, CFA, FIFe)' })}
      <div class="page">
        <label class="search-box">${AF.icon('search')}<input type="search" id="breed-search" placeholder="Rechercher : Persan, Bengal…" autocomplete="off"></label>
        <div class="filter-chips">
          ${filters.map(([v, l], i) => `<button class="chip ${i === 0 ? 'active' : ''}" data-hair="${v}">${AF.esc(l)}</button>`).join('')}
        </div>
        <div class="breed-list" id="breed-list">
          ${AF.BREEDS.map((b) => `
            <button class="breed-item" data-id="${b.id}" data-hair="${b.hair}" data-search="${AF.esc(AF.normalizeText(b.name + ' ' + b.en + ' ' + b.origin))}">
              <span class="breed-initial hair-${b.hair}">${AF.esc(b.name.charAt(0))}</span>
              <span class="todo-text"><strong>${AF.esc(b.name)}</strong><small>${AF.esc(b.origin)} · ${AF.esc(AF.HAIR_TYPES[b.hair])}</small></span>
              ${AF.icon('chevron', 'muted')}
            </button>`).join('')}
        </div>
        <p class="empty-search muted center" hidden>Aucune race ne correspond.</p>
        <a class="btn btn-primary btn-block" href="#/race">${AF.icon('scan')} Reconnaître une race en photo</a>
      </div>`;

    function mount(root) {
      const input = root.querySelector('#breed-search');
      let hair = 'all';
      const apply = () => {
        const q = AF.normalizeText(input.value);
        let visible = 0;
        root.querySelectorAll('.breed-item').forEach((el) => {
          const show = (hair === 'all' || el.dataset.hair === hair) && (!q || el.dataset.search.includes(q));
          el.hidden = !show;
          if (show) visible++;
        });
        root.querySelector('.empty-search').hidden = visible > 0;
      };
      input.addEventListener('input', apply);
      root.querySelectorAll('[data-hair].chip').forEach((chip) => chip.addEventListener('click', () => {
        hair = chip.dataset.hair;
        root.querySelectorAll('[data-hair].chip').forEach((c) => c.classList.toggle('active', c === chip));
        apply();
      }));
      root.querySelectorAll('.breed-item').forEach((el) => el.addEventListener('click', () => openBreedInfo(AF.BREEDS.find((b) => b.id === el.dataset.id))));
    }
    return { html, mount };
  }

  AF.route('/race', scanView, 'home');
  AF.route('/race/:catId', scanView, 'home');
  AF.route('/races', breedsView, 'profile');
})(self.AF);
