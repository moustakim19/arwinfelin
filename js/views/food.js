/* =====================================================================
   views/food.js — Alimentation : calculateur de ration et repas
   ===================================================================== */

(function (AF) {
  'use strict';

  const MEAL_TYPES = {
    dry: { label: 'Croquettes', emoji: '🥣' },
    wet: { label: 'Pâtée', emoji: '🥫' },
    treat: { label: 'Friandise', emoji: '🍪' },
    homemade: { label: 'Fait maison', emoji: '🍗' },
    other: { label: 'Autre', emoji: '🍽️' }
  };

  /* ---------- Calcul de la ration ---------- */

  // Méthode courante en nutrition vétérinaire :
  // 1) Besoin au repos (RER) = 70 × poids^0,75   (en kilocalories par jour)
  // 2) Besoin du jour = RER × un coefficient selon l'âge, la stérilisation et l'activité
  AF.computeRation = function ({ kg, ageMonths, sterilized, activity, dryKcal, wetKcal, dryPercent }) {
    const rer = 70 * Math.pow(kg, 0.75);
    let factor;
    let stage;
    if (ageMonths < 4) { factor = 3.0; stage = 'chaton de moins de 4 mois'; }
    else if (ageMonths < 6) { factor = 2.5; stage = 'chaton de 4 à 6 mois'; }
    else if (ageMonths < 12) { factor = 2.0; stage = 'chaton de 6 à 12 mois'; }
    else if (ageMonths >= 132) { factor = 1.1; stage = 'chat senior'; }
    else { factor = sterilized ? 1.2 : 1.4; stage = sterilized ? 'adulte stérilisé' : 'adulte non stérilisé'; }

    // L'activité ne change le coefficient que chez l'adulte et le senior
    if (ageMonths >= 12) {
      if (activity === 'low') factor -= 0.2;
      if (activity === 'high') factor += 0.2;
    }
    const kcal = rer * factor;
    const dryShare = dryPercent / 100;
    return {
      rer, factor, stage,
      kcal,
      dryGrams: dryShare > 0 ? (kcal * dryShare) / (dryKcal / 100) : 0,
      wetGrams: dryShare < 1 ? (kcal * (1 - dryShare)) / (wetKcal / 100) : 0
    };
  };

  /* ---------- Formulaire de repas ---------- */

  function openMealForm(cat, entry, onSaved) {
    const e = entry || {};
    AF.sheet({
      title: (entry ? 'Modifier le repas' : 'Nouveau repas') + ' · ' + cat.name,
      content: `
        <form class="form" novalidate>
          <div class="field"><span>Type</span>
            <div class="meal-types">
              ${Object.entries(MEAL_TYPES).map(([v, t]) => `
                <label><input type="radio" name="kind" value="${v}" ${(e.kind || 'dry') === v ? 'checked' : ''}><span><b>${t.emoji}</b>${t.label}</span></label>`).join('')}
            </div>
          </div>
          <div class="field-row">
            <label class="field"><span>Quand <em>*</em></span><input type="datetime-local" name="date" required value="${AF.esc(e.date || AF.toLocalDateTime(new Date()))}"></label>
            <label class="field"><span>Quantité (g)</span><input name="grams" inputmode="decimal" placeholder="Ex. 20" value="${e.grams != null ? AF.esc(AF.formatNumber(e.grams, 1)) : ''}"></label>
          </div>
          <label class="field"><span>Aliment / note</span><input name="note" maxlength="80" value="${AF.esc(e.note)}" placeholder="Ex. Croquettes stérilisé, a tout mangé"></label>
          <div class="form-actions">
            <button class="btn btn-primary btn-lg btn-block" type="submit">${AF.icon('check')} Enregistrer</button>
            ${entry ? `<button class="btn btn-ghost-danger btn-block" type="button" data-delete>${AF.icon('trash')} Supprimer</button>` : ''}
          </div>
        </form>`,
      onMount(el, close) {
        const form = el.querySelector('form');
        form.addEventListener('submit', async (ev) => {
          ev.preventDefault();
          const data = AF.formData(form);
          if (!data.date) { AF.toast('Indiquez la date du repas', 'error'); return; }
          await AF.db.put('meals', { ...e, id: e.id || AF.uid(), catId: cat.id, kind: data.kind || 'dry', date: data.date, grams: AF.parseNumber(data.grams), note: data.note });
          AF.toast('Repas noté', 'success');
          close();
          onSaved();
        });
        const del = el.querySelector('[data-delete]');
        if (del) del.addEventListener('click', async () => {
          await AF.db.delete('meals', e.id);
          close();
          onSaved();
        });
      }
    });
  }

  /* ---------- Section "Repas" de la fiche ---------- */

  AF.addCatSection({
    id: 'repas',
    label: 'Repas',
    icon: 'bowl',
    async render(cat) {
      const [weights, meals] = await Promise.all([AF.getWeights(cat.id), AF.db.getByIndex('meals', 'catId', cat.id)]);
      meals.sort((a, b) => b.date.localeCompare(a.date));
      const lastKg = weights.length ? weights[weights.length - 1].kg : null;
      const age = AF.catAge(cat.birthDate);
      // Réglages du calculateur gardés dans la fiche du chat
      const r = cat.ration || {};
      const settings = {
        kg: r.kg || lastKg || 4,
        activity: r.activity || 'normal',
        dryKcal: r.dryKcal || 380,
        wetKcal: r.wetKcal || 85,
        dryPercent: r.dryPercent != null ? r.dryPercent : 100
      };

      // Repas d'aujourd'hui
      const today = AF.today();
      const todayMeals = meals.filter((m) => m.date.startsWith(today));
      const todayDry = todayMeals.filter((m) => m.kind === 'dry').reduce((s, m) => s + (m.grams || 0), 0);
      const todayWet = todayMeals.filter((m) => m.kind === 'wet').reduce((s, m) => s + (m.grams || 0), 0);

      // Historique groupé par jour
      const byDay = new Map();
      for (const m of meals.slice(0, 120)) {
        const day = m.date.slice(0, 10);
        if (!byDay.has(day)) byDay.set(day, []);
        byDay.get(day).push(m);
      }
      const dayLabel = (day) => {
        const n = AF.daysUntil(day);
        return n === 0 ? "Aujourd'hui" : n === -1 ? 'Hier' : AF.capitalize(AF.formatWeekday(AF.parseDate(day)));
      };

      const html = `
        <div class="section-head"><h2>Ration conseillée</h2></div>
        <form class="card ration-card" id="ration-form" novalidate>
          <div class="field-row">
            <label class="field"><span>Poids (kg)</span><input name="kg" inputmode="decimal" value="${AF.esc(AF.formatNumber(settings.kg, 2))}"></label>
            <div class="field"><span>Âge</span><div class="fake-input">${age ? AF.esc(AF.ageLabel(age)) : 'Adulte (par défaut)'}</div></div>
          </div>
          <div class="field"><span>Activité</span>
            <div class="seg">
              ${[['low', '😴 Calme'], ['normal', '🐾 Normale'], ['high', '⚡ Très actif']].map(([v, l]) =>
                `<label><input type="radio" name="activity" value="${v}" ${settings.activity === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}
            </div>
          </div>
          <div class="field">
            <span>Répartition : <b id="split-label"></b></span>
            <input type="range" name="dryPercent" min="0" max="100" step="10" value="${settings.dryPercent}" class="range">
          </div>
          <details class="h-details">
            <summary>Énergie de vos aliments (sur l'emballage)</summary>
            <div class="field-row">
              <label class="field"><span>Croquettes (kcal/100 g)</span><input name="dryKcal" inputmode="numeric" value="${settings.dryKcal}"></label>
              <label class="field"><span>Pâtée (kcal/100 g)</span><input name="wetKcal" inputmode="numeric" value="${settings.wetKcal}"></label>
            </div>
          </details>
          <div class="ration-result" id="ration-result"></div>
          <p class="hint">${AF.icon('info')} Ration indicative, à adapter selon les conseils du vétérinaire et l'emballage.</p>
        </form>

        <div class="section-head">
          <h2>Repas</h2>
          <button class="btn btn-primary btn-sm" data-add>${AF.icon('plus')} Repas</button>
        </div>
        <div class="today-food" id="today-food"></div>
        ${meals.length ? `
          ${meals[0] ? `<button class="btn btn-soft btn-block" data-repeat>${AF.icon('repeat')} Refaire : ${AF.esc(MEAL_TYPES[meals[0].kind]?.label || 'Repas')}${meals[0].grams ? ' ' + AF.formatNumber(meals[0].grams) + ' g' : ''} maintenant</button>` : ''}
          ${[...byDay.entries()].map(([day, list]) => `
            <div class="day-group">
              <h4>${AF.esc(dayLabel(day))}</h4>
              <div class="card list-card">
                ${list.map((m) => `
                  <button class="h-item" data-id="${m.id}">
                    <span class="meal-emoji">${MEAL_TYPES[m.kind]?.emoji || '🍽️'}</span>
                    <div class="h-item-text"><strong>${AF.esc(MEAL_TYPES[m.kind]?.label || 'Repas')}${m.grams ? ' · ' + AF.formatNumber(m.grams) + ' g' : ''}</strong>
                    <small>${AF.esc(AF.formatTime(m.date))}${m.note ? ' · ' + AF.esc(m.note) : ''}</small></div>
                  </button>`).join('')}
              </div>
            </div>`).join('')}`
          : `<div class="card card-soft center"><p>Notez les repas de ${AF.esc(cat.name)} pour suivre ce qu'il mange chaque jour.</p></div>`}`;

      function mount(el, refresh) {
        const form = el.querySelector('#ration-form');
        const result = el.querySelector('#ration-result');
        const todayBox = el.querySelector('#today-food');
        let saveTimer = null;
        let pendingSave = null; // enregistrement en attente

        // Recalcule la ration à chaque changement
        function update() {
          const kg = AF.parseNumber(form.kg.value);
          const dryPercent = Number(form.dryPercent.value);
          const activity = (form.querySelector('[name=activity]:checked') || {}).value || 'normal';
          const dryKcal = AF.parseNumber(form.dryKcal.value) || 380;
          const wetKcal = AF.parseNumber(form.wetKcal.value) || 85;
          el.querySelector('#split-label').textContent =
            dryPercent === 100 ? '100 % croquettes' : dryPercent === 0 ? '100 % pâtée' : dryPercent + ' % croquettes · ' + (100 - dryPercent) + ' % pâtée';

          if (!kg || kg <= 0 || kg > 30) {
            result.innerHTML = '<p class="muted">Indiquez un poids valide.</p>';
            todayBox.innerHTML = '';
            return;
          }
          const ration = AF.computeRation({
            kg, ageMonths: age ? age.totalMonths : 36, sterilized: cat.sterilized, activity, dryKcal, wetKcal, dryPercent
          });
          result.innerHTML = `
            <div class="ration-kcal"><strong>${Math.round(ration.kcal)}</strong><span>kcal / jour</span></div>
            <div class="ration-grams">
              ${ration.dryGrams ? `<div><b>${Math.round(ration.dryGrams)} g</b><span>🥣 croquettes</span></div>` : ''}
              ${ration.wetGrams ? `<div><b>${Math.round(ration.wetGrams)} g</b><span>🥫 pâtée</span></div>` : ''}
            </div>
            <p class="muted small">Calcul pour un ${AF.esc(ration.stage)}, à répartir en 3 à 5 petits repas.</p>`;

          // Barre de progression du jour
          const bar = (label, eaten, target) => {
            const pct = target ? Math.min(100, (eaten / target) * 100) : 0;
            return `<div class="progress-row"><span>${label}</span><div class="progress"><i style="width:${pct}%"></i></div><b>${Math.round(eaten)} / ${Math.round(target)} g</b></div>`;
          };
          todayBox.innerHTML = (ration.dryGrams || ration.wetGrams) ? `
            <div class="card today-card">
              <h4>Aujourd'hui</h4>
              ${ration.dryGrams ? bar('🥣', todayDry, ration.dryGrams) : ''}
              ${ration.wetGrams ? bar('🥫', todayWet, ration.wetGrams) : ''}
            </div>` : '';

          // On mémorise les réglages dans la fiche du chat (avec un petit délai)
          clearTimeout(saveTimer);
          pendingSave = async () => {
            pendingSave = null;
            const fresh = await AF.db.get('cats', cat.id);
            if (fresh) await AF.db.put('cats', { ...fresh, ration: { kg, activity, dryKcal, wetKcal, dryPercent, kcal: ration.kcal } });
          };
          saveTimer = setTimeout(pendingSave, 600);
        }
        form.addEventListener('input', update);
        form.addEventListener('submit', (e) => e.preventDefault());
        update();

        el.querySelector('[data-add]').addEventListener('click', () => openMealForm(cat, null, refresh));
        const repeat = el.querySelector('[data-repeat]');
        if (repeat) repeat.addEventListener('click', async () => {
          const m = meals[0];
          await AF.db.put('meals', { ...m, id: AF.uid(), date: AF.toLocalDateTime(new Date()) });
          AF.toast('Repas noté', 'success');
          refresh();
        });
        const byId = new Map(meals.map((m) => [m.id, m]));
        el.querySelectorAll('[data-id]').forEach((b) => b.addEventListener('click', () => openMealForm(cat, byId.get(b.dataset.id), refresh)));
        // En quittant l'écran, on enregistre tout de suite ce qui était en attente
        return () => { clearTimeout(saveTimer); if (pendingSave) pendingSave(); };
      }

      return { html, mount };
    }
  });
})(self.AF);
