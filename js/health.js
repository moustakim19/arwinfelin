/* =====================================================================
   health.js — Le carnet de santé : données, calculs et formulaires
   ---------------------------------------------------------------------
   Tout est rangé dans le magasin IndexedDB "health". Chaque fiche a un
   "type" :
     vaccine   -> vaccin            (date faite + prochain rappel)
     deworm    -> vermifuge         (date faite + prochain rappel)
     flea      -> antipuces         (date faite + prochain rappel)
     visit     -> visite véto       (motif, diagnostic, prix, ordonnance)
     allergy   -> allergie
     treatment -> traitement        (dose, début, fin)
   ===================================================================== */

(function (AF) {
  'use strict';

  // Les soins "répétés" : on note quand c'est fait et quand refaire
  AF.CARE_KINDS = {
    vaccine: {
      label: 'Vaccin', plural: 'Vaccins', icon: 'syringe', tone: 'sky', months: 12,
      suggestions: ['Typhus + Coryza (TC)', 'Typhus + Coryza + Leucose (TCL)', 'Leucose (FeLV)', 'Rage', 'Chlamydiose', 'Typhus (panleucopénie)']
    },
    deworm: {
      label: 'Vermifuge', plural: 'Vermifuges', icon: 'worm', tone: 'mint', months: 3,
      suggestions: ['Milbemax', 'Drontal', 'Profender', 'Milpro', 'Broadline']
    },
    flea: {
      label: 'Antipuces', plural: 'Antipuces', icon: 'bug', tone: 'apricot', months: 1,
      suggestions: ['Frontline', 'Advocate', 'Stronghold', 'Bravecto', 'Broadline', 'Collier Seresto']
    }
  };

  // Tous les types, avec leur nom et leur icône (pour les menus)
  AF.HEALTH_TYPES = {
    vaccine: { label: 'Vaccin', icon: 'syringe', tone: 'sky' },
    deworm: { label: 'Vermifuge', icon: 'worm', tone: 'mint' },
    flea: { label: 'Antipuces', icon: 'bug', tone: 'apricot' },
    visit: { label: 'Visite véto', icon: 'stethoscope', tone: 'lavender' },
    allergy: { label: 'Allergie', icon: 'alert', tone: 'danger' },
    treatment: { label: 'Traitement', icon: 'pill', tone: 'primary' }
  };

  AF.isCare = (type) => Boolean(AF.CARE_KINDS[type]);

  // Le message de prudence affiché dans tout le carnet
  AF.VET_DISCLAIMER = `<p class="disclaimer">${AF.icon('info')} Cette appli ne remplace pas l'avis d'un vétérinaire.</p>`;

  /* ---------- Lecture ---------- */

  AF.getHealth = (catId) => AF.db.getByIndex('health', 'catId', catId);

  /* ---------- Calculs ---------- */

  // Ajoute des mois à une date "AAAA-MM-JJ" (le 31 janvier + 1 mois = 28/29 février)
  AF.addMonths = function (text, months) {
    const d = AF.parseDate(text);
    if (!d) return '';
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + months);
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, lastDay));
    return AF.toISODate(d);
  };

  // Un soin est "remplacé" s'il existe un soin plus récent du même type et du même nom
  // (ex. le vaccin Rage de 2023 est remplacé par celui de 2024).
  // On ne garde que les soins "actifs" pour calculer les retards.
  AF.activeCare = function (entries) {
    const latest = new Map();
    for (const e of entries) {
      if (!AF.isCare(e.type)) continue;
      const key = e.type + '|' + (e.name || '').trim().toLowerCase();
      const current = latest.get(key);
      if (!current || (e.date || '') > (current.date || '')) latest.set(key, e);
    }
    return [...latest.values()];
  };

  // Statut d'un soin selon sa date de rappel
  AF.careStatus = function (entry, superseded = false) {
    if (superseded) return { level: 'renewed', text: 'Renouvelé' };
    if (!entry.nextDate) return { level: 'none', text: 'Sans rappel' };
    const days = AF.daysUntil(entry.nextDate);
    if (days < 0) return { level: 'late', days, text: 'En retard de ' + AF.plural(-days, 'jour', 'jours'), short: 'Retard ' + -days + ' j' };
    if (days === 0) return { level: 'soon', days, text: "À faire aujourd'hui", short: "Aujourd'hui" };
    if (days <= 30) return { level: 'soon', days, text: 'Dans ' + AF.plural(days, 'jour', 'jours'), short: 'Dans ' + days + ' j' };
    return { level: 'ok', days, text: 'À jour' };
  };

  // Le petit badge coloré correspondant au statut (rouge si en retard)
  AF.statusBadge = function (status, short = false) {
    const cls = { late: 'badge-danger', soon: 'badge-warning', ok: 'badge-ok' }[status.level] || 'badge-muted';
    const icon = status.level === 'late' ? AF.icon('alert') : status.level === 'ok' ? AF.icon('check') : '';
    return `<span class="badge ${cls}">${icon}${AF.esc(short && status.short ? status.short : status.text)}</span>`;
  };

  // Un traitement est "en cours" s'il n'a pas de date de fin, ou si elle n'est pas passée
  AF.isTreatmentActive = (t) => !t.endDate || t.endDate >= AF.today();

  // Tous les soins en retard ou proches, pour tous les chats (utilisé par l'onglet Santé et les rappels)
  AF.getCareAlerts = async function (withinDays = 30) {
    const [cats, all] = await Promise.all([AF.getCats(), AF.db.getAll('health')]);
    const catById = new Map(cats.map((c) => [c.id, c]));
    return AF.activeCare(all)
      .filter((e) => e.nextDate && catById.has(e.catId))
      .map((e) => ({ entry: e, cat: catById.get(e.catId), status: AF.careStatus(e) }))
      .filter((a) => a.status.days <= withinDays)
      .sort((a, b) => a.entry.nextDate.localeCompare(b.entry.nextDate));
  };

  /* ---------- Formulaires ---------- */

  // Menu "Que voulez-vous ajouter ?"
  AF.openHealthTypePicker = function (cat, onSaved) {
    AF.sheet({
      title: 'Ajouter au carnet',
      content: `
        <div class="type-grid">
          ${Object.entries(AF.HEALTH_TYPES).map(([type, t]) => `
            <button class="type-tile tone-${t.tone}" data-type="${type}">
              <span>${AF.icon(t.icon)}</span>${AF.esc(t.label)}
            </button>`).join('')}
        </div>`,
      onMount(el, close) {
        el.querySelectorAll('[data-type]').forEach((btn) => btn.addEventListener('click', () => {
          close();
          setTimeout(() => AF.openHealthForm({ cat, type: btn.dataset.type, onSaved }), 200);
        }));
      }
    });
  };

  // Champs du formulaire selon le type
  function fieldsHTML(type, e) {
    const care = AF.CARE_KINDS[type];
    if (care) {
      return `
        <label class="field">
          <span>Nom du ${care.label.toLowerCase()} / produit <em>*</em></span>
          <input name="name" required maxlength="60" list="hl-suggest" value="${AF.esc(e.name)}" placeholder="Ex. ${AF.esc(care.suggestions[0])}">
          <datalist id="hl-suggest">${care.suggestions.map((s) => `<option value="${AF.esc(s)}">`).join('')}</datalist>
        </label>
        <div class="field-row">
          <label class="field"><span>Fait le <em>*</em></span><input type="date" name="date" required value="${AF.esc(e.date || AF.today())}"></label>
          <label class="field"><span>Prochain rappel</span><input type="date" name="nextDate" value="${AF.esc(e.nextDate)}"></label>
        </div>
        <div class="quick-dates">
          <span class="muted small">Rappel dans :</span>
          <button type="button" class="chip" data-months="1">1 mois</button>
          <button type="button" class="chip" data-months="3">3 mois</button>
          <button type="button" class="chip" data-months="6">6 mois</button>
          <button type="button" class="chip" data-months="12">1 an</button>
          <button type="button" class="chip" data-months="36">3 ans</button>
        </div>
        <label class="field"><span>Notes</span><textarea name="notes" maxlength="500" placeholder="Vétérinaire, numéro de lot…">${AF.esc(e.notes)}</textarea></label>`;
    }
    if (type === 'visit') {
      return `
        <div class="field-row">
          <label class="field"><span>Date <em>*</em></span><input type="date" name="date" required value="${AF.esc(e.date || AF.today())}"></label>
          <label class="field"><span>Prix (€)</span><input name="price" inputmode="decimal" maxlength="10" placeholder="0,00" value="${e.price != null ? AF.esc(AF.formatNumber(e.price, 2)) : ''}"></label>
        </div>
        <label class="field"><span>Motif <em>*</em></span><input name="reason" required maxlength="80" value="${AF.esc(e.reason)}" placeholder="Ex. Vaccin annuel, vomissements…"></label>
        <label class="field"><span>Diagnostic</span><textarea name="diagnosis" maxlength="1000" placeholder="Ce qu'a dit le vétérinaire…">${AF.esc(e.diagnosis)}</textarea></label>
        <label class="field"><span>Vétérinaire / clinique</span><input name="vet" maxlength="80" value="${AF.esc(e.vet)}" placeholder="Ex. Dr Martin"></label>
        <div class="field"><span>Photo de l'ordonnance</span>
          ${AF.photoPickerHTML('hl-photo', { shape: 'wide', label: "Photographier l'ordonnance", placeholder: AF.icon('file') })}
        </div>`;
    }
    if (type === 'allergy') {
      return `
        <label class="field"><span>Allergie à… <em>*</em></span><input name="name" required maxlength="60" value="${AF.esc(e.name)}" placeholder="Ex. Poulet, pollen, pénicilline…"></label>
        <div class="field"><span>Gravité</span>
          <div class="seg">
            ${[['mild', 'Légère'], ['moderate', 'Modérée'], ['severe', 'Sévère']].map(([v, l]) =>
              `<label><input type="radio" name="severity" value="${v}" ${(e.severity || 'mild') === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}
          </div>
        </div>
        <label class="field"><span>Réaction / précautions</span><textarea name="notes" maxlength="500" placeholder="Ex. démangeaisons, éviter les croquettes au poulet">${AF.esc(e.notes)}</textarea></label>`;
    }
    // Traitement
    return `
      <label class="field"><span>Médicament <em>*</em></span><input name="name" required maxlength="60" value="${AF.esc(e.name)}" placeholder="Ex. Antibiotique, anti-inflammatoire…"></label>
      <div class="field-row">
        <label class="field"><span>Dose</span><input name="dosage" maxlength="40" value="${AF.esc(e.dosage)}" placeholder="Ex. ½ comprimé"></label>
        <label class="field"><span>Fréquence</span><input name="frequency" maxlength="40" value="${AF.esc(e.frequency)}" placeholder="Ex. 2 fois/jour"></label>
      </div>
      <div class="field-row">
        <label class="field"><span>Début</span><input type="date" name="startDate" value="${AF.esc(e.startDate || AF.today())}"></label>
        <label class="field"><span>Fin</span><input type="date" name="endDate" value="${AF.esc(e.endDate)}"></label>
      </div>
      <small class="muted">Laissez la fin vide pour un traitement au long cours.</small>
      <label class="field"><span>Notes</span><textarea name="notes" maxlength="500">${AF.esc(e.notes)}</textarea></label>`;
  }

  // Ouvre le formulaire pour ajouter (entry vide) ou modifier (entry existante)
  AF.openHealthForm = function ({ cat, type, entry = null, onSaved = null }) {
    const e = entry || {};
    const meta = AF.HEALTH_TYPES[type];
    AF.sheet({
      title: (entry ? 'Modifier · ' : '') + meta.label + ' · ' + cat.name,
      content: `
        <form class="form" novalidate>
          ${fieldsHTML(type, e)}
          <div class="form-actions">
            <button class="btn btn-primary btn-lg btn-block" type="submit">${AF.icon('check')} Enregistrer</button>
            ${entry ? `<button class="btn btn-ghost-danger btn-block" type="button" data-delete>${AF.icon('trash')} Supprimer</button>` : ''}
          </div>
        </form>`,
      onMount(el, close) {
        const form = el.querySelector('form');
        const picker = el.querySelector('#hl-photo') ? AF.photoPicker(el.querySelector('#hl-photo'), e.photo || null, { maxSize: 1600 }) : null;

        // Soins : on propose automatiquement la date du prochain rappel
        const care = AF.CARE_KINDS[type];
        if (care) {
          let nextTouched = Boolean(e.nextDate);
          form.nextDate.addEventListener('input', () => { nextTouched = true; });
          const suggest = () => {
            if (!nextTouched && form.date.value) form.nextDate.value = AF.addMonths(form.date.value, care.months);
          };
          form.date.addEventListener('change', suggest);
          suggest();
          el.querySelectorAll('[data-months]').forEach((chip) => chip.addEventListener('click', () => {
            const base = form.date.value || AF.today();
            form.nextDate.value = AF.addMonths(base, Number(chip.dataset.months));
            nextTouched = true;
          }));
        }

        form.addEventListener('submit', async (ev) => {
          ev.preventDefault();
          const data = AF.formData(form);
          // Vérification des champs obligatoires
          const missing = [...form.querySelectorAll('[required]')].find((input) => !input.value.trim());
          if (missing) {
            AF.toast('Merci de remplir les champs marqués *', 'error');
            missing.focus();
            return;
          }
          if (data.nextDate && data.date && data.nextDate < data.date) {
            AF.toast('Le rappel doit être après la date du soin', 'error');
            return;
          }
          if (data.endDate && data.startDate && data.endDate < data.startDate) {
            AF.toast('La fin doit être après le début', 'error');
            return;
          }
          const saved = { ...e, ...data, id: e.id || AF.uid(), catId: cat.id, type, updatedAt: new Date().toISOString() };
          if (type === 'visit') {
            saved.price = AF.parseNumber(data.price);
            saved.photo = picker ? picker.getBlob() : null;
          }
          await AF.db.put('health', saved);
          AF.toast('Carnet mis à jour', 'success');
          close();
          if (onSaved) onSaved(saved);
        });

        const del = el.querySelector('[data-delete]');
        if (del) del.addEventListener('click', async () => {
          if (!(await AF.confirm({ title: 'Supprimer cette fiche ?', confirmText: 'Supprimer', danger: true }))) return;
          await AF.db.delete('health', e.id);
          AF.toast('Supprimé', 'info');
          close();
          if (onSaved) onSaved(null);
        });
      }
    });
  };
})(self.AF);
