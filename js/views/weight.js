/* =====================================================================
   views/weight.js — Suivi du poids (avec courbe Chart.js)
   ===================================================================== */

(function (AF) {
  'use strict';

  /* ---------- Calculs ---------- */

  // Pesées d'un chat, de la plus ancienne à la plus récente
  AF.getWeights = async function (catId) {
    const list = await AF.db.getByIndex('weights', 'catId', catId);
    return list.sort((a, b) => a.date.localeCompare(b.date));
  };

  // Cherche une variation de plus de 10 % sur un mois (31 jours) avant la dernière pesée.
  // On compare la dernière pesée à chaque pesée du mois précédent et on garde le plus gros écart.
  AF.weightAlert = function (weights, threshold = 0.10) {
    if (weights.length < 2) return null;
    const last = weights[weights.length - 1];
    const lastDate = AF.parseDate(last.date);
    const monthBefore = new Date(lastDate);
    monthBefore.setDate(monthBefore.getDate() - 31);
    let worst = null;
    for (const w of weights.slice(0, -1)) {
      const d = AF.parseDate(w.date);
      if (d < monthBefore) continue;
      const change = (last.kg - w.kg) / w.kg; // ex. 0.12 = +12 %
      if (!worst || Math.abs(change) > Math.abs(worst.change)) worst = { change, from: w, to: last };
    }
    return worst && Math.abs(worst.change) > threshold ? worst : null;
  };

  // Couleur d'une variable CSS (pour que la courbe suive le thème clair/sombre)
  const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  /* ---------- Formulaire de pesée ---------- */

  function openWeightForm(cat, entry, onSaved) {
    const e = entry || {};
    AF.sheet({
      title: (entry ? 'Modifier la pesée' : 'Nouvelle pesée') + ' · ' + cat.name,
      content: `
        <form class="form" novalidate>
          <div class="field-row">
            <label class="field"><span>Date <em>*</em></span><input type="date" name="date" required max="${AF.today()}" value="${AF.esc(e.date || AF.today())}"></label>
            <label class="field"><span>Poids (kg) <em>*</em></span><input name="kg" required inputmode="decimal" placeholder="4,2" value="${e.kg ? AF.esc(AF.formatNumber(e.kg, 2)) : ''}"></label>
          </div>
          <p class="hint">${AF.icon('info')} Astuce : pesez-vous seul, puis avec votre chat dans les bras, et faites la différence.</p>
          <div class="form-actions">
            <button class="btn btn-primary btn-lg btn-block" type="submit">${AF.icon('check')} Enregistrer</button>
            ${entry ? `<button class="btn btn-ghost-danger btn-block" type="button" data-delete>${AF.icon('trash')} Supprimer</button>` : ''}
          </div>
        </form>`,
      onMount(el, close) {
        const form = el.querySelector('form');
        if (!entry) setTimeout(() => form.kg.focus(), 350);
        form.addEventListener('submit', async (ev) => {
          ev.preventDefault();
          const kg = AF.parseNumber(form.kg.value);
          if (!form.date.value || !kg || kg <= 0 || kg > 30) {
            AF.toast('Indiquez une date et un poids entre 0 et 30 kg', 'error');
            return;
          }
          await AF.db.put('weights', { ...e, id: e.id || AF.uid(), catId: cat.id, date: form.date.value, kg });
          AF.toast('Pesée enregistrée', 'success');
          close();
          onSaved();
        });
        const del = el.querySelector('[data-delete]');
        if (del) del.addEventListener('click', async () => {
          await AF.db.delete('weights', e.id);
          close();
          onSaved();
        });
      }
    });
  }

  /* ---------- Section "Poids" de la fiche ---------- */

  AF.addCatSection({
    id: 'poids',
    label: 'Poids',
    icon: 'scale',
    async render(cat) {
      const weights = await AF.getWeights(cat.id);
      const last = weights[weights.length - 1];
      const prev = weights[weights.length - 2];
      const alert = AF.weightAlert(weights);

      let summary = '';
      if (last) {
        const diff = prev ? last.kg - prev.kg : 0;
        const trend = !prev ? '' : Math.abs(diff) < 0.005
          ? '<span class="trend">= stable</span>'
          : `<span class="trend ${diff > 0 ? 'up' : 'down'}">${AF.icon(diff > 0 ? 'trendUp' : 'trendDown')} ${diff > 0 ? '+' : '−'}${AF.formatNumber(Math.abs(diff), 2)} kg</span>`;
        summary = `
          <div class="weight-hero">
            <div>
              <span class="age-label">Poids actuel</span>
              <strong>${AF.formatNumber(last.kg, 2)} <small>kg</small></strong>
              <span class="muted small">Le ${AF.esc(AF.formatDate(last.date))}</span>
            </div>
            ${trend}
          </div>`;
      }

      const alertHTML = alert ? `
        <div class="alert ${alert.change > 0 ? 'alert-warning' : 'alert-danger'}">
          ${AF.icon('alert')}
          <div>
            <strong>${alert.change > 0 ? 'Prise' : 'Perte'} de ${AF.formatNumber(Math.abs(alert.change) * 100, 0)} % en moins d'un mois</strong>
            <p>De ${AF.formatNumber(alert.from.kg, 2)} kg (${AF.esc(AF.formatShortDate(alert.from.date))}) à ${AF.formatNumber(alert.to.kg, 2)} kg. Une variation rapide de poids mérite l'avis du vétérinaire.</p>
          </div>
        </div>` : '';

      const html = `
        <div class="section-head">
          <h2>Suivi du poids</h2>
          <button class="btn btn-primary btn-sm" data-add>${AF.icon('plus')} Pesée</button>
        </div>
        ${weights.length ? `
          <div class="card">
            ${summary}
            <div class="chart-box"><canvas id="weight-chart" aria-label="Courbe de poids"></canvas></div>
          </div>
          ${alertHTML}
          <div class="card list-card">
            ${weights.slice().reverse().map((w, i, arr) => {
              const older = arr[i + 1];
              const d = older ? w.kg - older.kg : null;
              return `
                <button class="h-item" data-id="${w.id}">
                  <span class="tone-dot tone-sky">${AF.icon('scale')}</span>
                  <div class="h-item-text"><strong>${AF.formatNumber(w.kg, 2)} kg</strong><small>${AF.esc(AF.formatDate(w.date))}</small></div>
                  ${d === null ? '' : `<span class="delta ${d > 0 ? 'up' : d < 0 ? 'down' : ''}">${d > 0 ? '+' : d < 0 ? '−' : '±'}${AF.formatNumber(Math.abs(d), 2)}</span>`}
                </button>`;
            }).join('')}
          </div>` : `
          <div class="card card-soft center">
            <span class="tone-dot tone-sky big-dot">${AF.icon('scale')}</span>
            <p>Pesez ${AF.esc(cat.name)} régulièrement (une fois par mois) pour voir sa courbe et être alerté en cas de variation rapide.</p>
          </div>`}
        ${AF.VET_DISCLAIMER}`;

      function mount(el, refresh) {
        el.querySelector('[data-add]').addEventListener('click', () => openWeightForm(cat, null, refresh));
        const byId = new Map(weights.map((w) => [w.id, w]));
        el.querySelectorAll('[data-id]').forEach((btn) => btn.addEventListener('click', () => openWeightForm(cat, byId.get(btn.dataset.id), refresh)));

        const canvas = el.querySelector('#weight-chart');
        if (!canvas) return null;
        // Chart.js est chargé depuis internet (CDN). Sans connexion la 1re fois, il peut manquer.
        if (typeof window.Chart === 'undefined') {
          canvas.parentElement.innerHTML = '<p class="h-empty center">La courbe a besoin d\'une connexion la première fois.</p>';
          return null;
        }
        const chart = drawWeightChart(canvas, weights);
        // Fonction de nettoyage : on détruit le graphique quand on quitte la section
        return () => chart.destroy();
      }

      return { html, mount };
    }
  });

  /* ---------- La courbe avec Chart.js ---------- */

  function drawWeightChart(canvas, weights) {
    const primary = cssVar('--primary') || '#F2785C';
    const muted = cssVar('--muted') || '#937E75';
    const line = cssVar('--line') || 'rgba(0,0,0,.1)';
    const ctx = canvas.getContext('2d');

    // Dégradé sous la courbe : de la couleur principale vers transparent
    const gradient = ctx.createLinearGradient(0, 0, 0, 220);
    gradient.addColorStop(0, primary + '55');
    gradient.addColorStop(1, primary + '00');

    const kgs = weights.map((w) => w.kg);
    const min = Math.min(...kgs);
    const max = Math.max(...kgs);
    const margin = Math.max(0.3, (max - min) * 0.25);

    return new Chart(canvas, {
      type: 'line',
      data: {
        labels: weights.map((w) => AF.formatShortDate(w.date)),
        datasets: [{
          label: 'Poids (kg)',
          data: kgs,
          borderColor: primary,
          backgroundColor: gradient,
          fill: true,
          tension: 0.35,            // courbe arrondie
          borderWidth: 3,
          pointRadius: weights.length > 24 ? 0 : 4,
          pointHoverRadius: 7,
          pointBackgroundColor: '#fff',
          pointBorderColor: primary,
          pointBorderWidth: 2.5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#3A2A25',
            padding: 10,
            cornerRadius: 12,
            displayColors: false,
            callbacks: {
              title: (items) => AF.formatDate(weights[items[0].dataIndex].date),
              label: (item) => AF.formatNumber(item.parsed.y, 2) + ' kg'
            }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: muted, maxRotation: 0, autoSkip: true, maxTicksLimit: 6 }, border: { display: false } },
          y: {
            suggestedMin: Math.max(0, min - margin),
            suggestedMax: max + margin,
            grid: { color: line },
            border: { display: false },
            ticks: { color: muted, maxTicksLimit: 5, callback: (v) => AF.formatNumber(v, 1) + ' kg' }
          }
        }
      }
    });
  }
})(self.AF);
