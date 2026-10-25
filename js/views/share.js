/* =====================================================================
   views/share.js — La "Fiche du chat" à partager (PDF ou image)
   ---------------------------------------------------------------------
   Un résumé pour le vétérinaire ou la personne qui garde le chat :
   photo, identité, vaccins, allergies, traitements, contacts.
   - PDF   : on utilise l'impression du navigateur ("Enregistrer en PDF"),
             avec un style spécial (@media print) qui n'affiche que la fiche.
   - Image : on redessine la fiche dans un <canvas>, puis on la partage
             (menu de partage du téléphone) ou on la télécharge en PNG.
   ===================================================================== */

(function (AF) {
  'use strict';

  /* ---------- Rassembler les informations ---------- */

  async function collect(catId) {
    const cat = await AF.db.get('cats', catId);
    if (!cat) return null;
    const [health, weights, ownerName, ownerPhone] = await Promise.all([
      AF.getHealth(catId), AF.getWeights(catId), AF.db.getSetting('ownerName', ''), AF.db.getSetting('ownerPhone', '')
    ]);
    const age = AF.catAge(cat.birthDate);
    const care = AF.activeCare(health).sort((a, b) => a.type.localeCompare(b.type) || (b.date || '').localeCompare(a.date || ''));
    return {
      cat,
      age,
      weight: weights.length ? weights[weights.length - 1] : null,
      care,
      allergies: health.filter((e) => e.type === 'allergy'),
      treatments: health.filter((e) => e.type === 'treatment' && AF.isTreatmentActive(e)),
      owner: { name: ownerName, phone: ownerPhone }
    };
  }

  const SEVERITY = { mild: 'légère', moderate: 'modérée', severe: 'SÉVÈRE' };
  const sexLabel = (c) => (c.sex === 'male' ? 'Mâle' : c.sex === 'female' ? 'Femelle' : '—');
  const yesNo = (c) => (c.sterilized ? 'Oui' : 'Non');

  // Les lignes "identité" (utilisées par le HTML ET par l'image)
  function identity(info) {
    const { cat, age, weight } = info;
    return [
      ['Né(e) le', cat.birthDate ? AF.formatDate(cat.birthDate) : '—'],
      ['Âge', age ? AF.ageLabel(age) : '—'],
      ['Sexe', sexLabel(cat)],
      ['Stérilisé(e)', yesNo(cat)],
      ['Race', cat.breed || '—'],
      ['Robe', cat.color || '—'],
      ['Puce', cat.chip || '—'],
      ['Poids', weight ? AF.formatNumber(weight.kg, 2) + ' kg (' + AF.formatShortDate(weight.date) + ')' : '—']
    ];
  }

  function careLines(info) {
    return info.care.map((e) => {
      const late = e.nextDate && AF.daysUntil(e.nextDate) < 0;
      return {
        left: AF.CARE_KINDS[e.type].label + ' · ' + e.name,
        right: 'fait le ' + AF.formatDate(e.date) + (e.nextDate ? ' · rappel ' + AF.formatDate(e.nextDate) + (late ? ' (EN RETARD)' : '') : ''),
        late
      };
    });
  }

  /* ---------- La fiche en HTML ---------- */

  function sheetHTML(info) {
    const { cat } = info;
    const section = (icon, title, body) => `
      <div class="ss-section"><h3>${AF.icon(icon)} ${AF.esc(title)}</h3>${body}</div>`;
    const lines = (list, empty) => list.length
      ? list.map((l) => `<div class="ss-line ${l.late ? 'late' : ''}"><span>${AF.esc(l.left)}</span><span>${AF.esc(l.right)}</span></div>`).join('')
      : `<p class="ss-empty">${AF.esc(empty)}</p>`;

    return `
      <article class="share-sheet" id="share-sheet">
        <header class="ss-head">
          <div class="ss-photo">${AF.catAvatar(cat)}</div>
          <div>
            <h2>${AF.esc(cat.name)}</h2>
            <p>${AF.esc([cat.breed, cat.color].filter(Boolean).join(' · ') || 'Mon chat')}</p>
          </div>
        </header>
        <div class="ss-body">
          ${section('paw', 'Identité', `<div class="ss-grid">${identity(info).map(([k, v]) => `<div><small>${AF.esc(k)}</small><b>${AF.esc(v)}</b></div>`).join('')}</div>`)}
          ${section('syringe', 'Vaccins et soins', lines(careLines(info), 'Aucun soin noté.'))}
          ${section('alert', 'Allergies', lines(info.allergies.map((a) => ({ left: a.name, right: (SEVERITY[a.severity] || '') + (a.notes ? ' · ' + a.notes : ''), late: a.severity === 'severe' })), 'Aucune allergie connue.'))}
          ${section('pill', 'Traitements en cours', lines(info.treatments.map((t) => ({ left: t.name, right: [t.dosage, t.frequency].filter(Boolean).join(' · ') + (t.endDate ? " · jusqu'au " + AF.formatDate(t.endDate) : '') })), 'Aucun traitement en cours.'))}
          ${cat.ration && cat.ration.kcal ? section('bowl', 'Alimentation', `<p>≈ ${Math.round(cat.ration.kcal)} kcal par jour${cat.foodNotes ? ' · ' + AF.esc(cat.foodNotes) : ''}</p>`) : (cat.foodNotes ? section('bowl', 'Alimentation', `<p>${AF.esc(cat.foodNotes)}</p>`) : '')}
          ${cat.sitterNotes ? section('heart', 'Habitudes et consignes', `<p>${AF.esc(cat.sitterNotes)}</p>`) : ''}
          ${section('phone', 'Contacts', `<div class="ss-grid">
            <div><small>Vétérinaire</small><b>${AF.esc(cat.vetName || '—')}</b>${cat.vetPhone ? `<a href="tel:${AF.esc(cat.vetPhone)}">${AF.esc(cat.vetPhone)}</a>` : ''}</div>
            <div><small>Propriétaire</small><b>${AF.esc(info.owner.name || '—')}</b>${info.owner.phone ? `<a href="tel:${AF.esc(info.owner.phone)}">${AF.esc(info.owner.phone)}</a>` : ''}</div>
          </div>`)}
        </div>
        <footer class="ss-foot">Fiche du ${AF.esc(AF.formatDate(AF.today()))} · ArwinFelin · Ne remplace pas l'avis d'un vétérinaire.</footer>
      </article>`;
  }

  /* ---------- La fiche dessinée en image (canvas) ---------- */

  // Découpe un texte en lignes qui tiennent dans "maxWidth" pixels
  function wrap(ctx, text, maxWidth) {
    const words = String(text).split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = word; } else line = test;
    }
    if (line) lines.push(line);
    return lines;
  }

  function loadImage(blob) {
    return new Promise((resolve) => {
      if (!blob) return resolve(null);
      const img = new Image();
      const url = URL.createObjectURL(blob);
      img.onload = () => { resolve(img); URL.revokeObjectURL(url); };
      img.onerror = () => { resolve(null); URL.revokeObjectURL(url); };
      img.src = url;
    });
  }

  async function drawSheet(info) {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    const W = 1080, P = 64; // largeur et marge
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = 3600; // grand au départ, on recoupe à la fin
    const ctx = canvas.getContext('2d');
    const TITLE = '600 {s}px Fredoka, Nunito, sans-serif';
    const BODY = '{w} {s}px Nunito, system-ui, sans-serif';
    const font = (tpl, s, w = 600) => tpl.replace('{s}', s).replace('{w}', w);
    const C = { text: '#3A2A25', muted: '#8F7B72', line: '#F1E2D6', accent: '#E1603F', danger: '#E5484D', soft: '#FFF6EE' };

    // Fond
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, canvas.height);

    // En-tête en dégradé
    const grad = ctx.createLinearGradient(0, 0, W, 360);
    grad.addColorStop(0, '#F2785C'); grad.addColorStop(0.55, '#F79A6B'); grad.addColorStop(1, '#FFC183');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, 360);
    ctx.fillStyle = 'rgba(255,255,255,.14)';
    ctx.beginPath(); ctx.arc(W - 90, 40, 190, 0, Math.PI * 2); ctx.fill();

    // Photo ronde
    const photo = await loadImage(info.cat.photo);
    const cx = P + 110, cy = 180, r = 110;
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r + 8, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
    if (photo) {
      const s = Math.max((2 * r) / photo.width, (2 * r) / photo.height);
      ctx.drawImage(photo, cx - (photo.width * s) / 2, cy - (photo.height * s) / 2, photo.width * s, photo.height * s);
    } else {
      ctx.fillStyle = '#FFE2D7'; ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
      ctx.font = '120px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🐱', cx, cy + 6);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    }
    ctx.restore();

    // Nom et race
    ctx.fillStyle = '#fff';
    ctx.font = font(TITLE, 76);
    ctx.fillText(info.cat.name, cx + r + 44, 170, W - (cx + r + 44) - P);
    ctx.font = font(BODY, 34, 700);
    ctx.globalAlpha = 0.92;
    ctx.fillText([info.cat.breed, info.cat.color].filter(Boolean).join(' · ') || 'Mon chat', cx + r + 44, 225, W - (cx + r + 44) - P);
    ctx.globalAlpha = 1;

    let y = 430;
    const sectionTitle = (title) => {
      ctx.fillStyle = C.accent;
      ctx.font = font(TITLE, 40);
      ctx.fillText(title, P, y);
      y += 24;
      ctx.fillStyle = C.line;
      ctx.fillRect(P, y, W - 2 * P, 3);
      y += 52;
    };

    // Identité en deux colonnes
    sectionTitle('Identité');
    const id = identity(info);
    const colW = (W - 2 * P) / 2;
    for (let i = 0; i < id.length; i += 2) {
      for (let j = 0; j < 2 && i + j < id.length; j++) {
        const [k, v] = id[i + j];
        const x = P + j * colW;
        ctx.fillStyle = C.muted; ctx.font = font(BODY, 26, 800);
        ctx.fillText(k.toUpperCase(), x, y);
        ctx.fillStyle = C.text; ctx.font = font(BODY, 34, 700);
        ctx.fillText(v, x, y + 44, colW - 24);
      }
      y += 100;
    }
    y += 20;

    // Une liste de lignes "gauche / droite"
    const list = (items, empty) => {
      if (!items.length) {
        ctx.fillStyle = C.muted; ctx.font = font(BODY, 32, 600);
        ctx.fillText(empty, P, y); y += 70; return;
      }
      for (const it of items) {
        ctx.fillStyle = C.text; ctx.font = font(BODY, 34, 800);
        for (const l of wrap(ctx, it.left, W - 2 * P)) { ctx.fillText(l, P, y); y += 44; }
        if (it.right) {
          ctx.fillStyle = it.late ? C.danger : C.muted; ctx.font = font(BODY, 30, it.late ? 800 : 600);
          for (const l of wrap(ctx, it.right, W - 2 * P)) { ctx.fillText(l, P, y); y += 40; }
        }
        y += 18;
      }
      y += 26;
    };

    sectionTitle('Vaccins et soins');
    list(careLines(info), 'Aucun soin noté.');
    sectionTitle('Allergies');
    list(info.allergies.map((a) => ({ left: a.name, right: (SEVERITY[a.severity] || '') + (a.notes ? ' · ' + a.notes : ''), late: a.severity === 'severe' })), 'Aucune allergie connue.');
    sectionTitle('Traitements en cours');
    list(info.treatments.map((t) => ({ left: t.name, right: [t.dosage, t.frequency].filter(Boolean).join(' · ') })), 'Aucun traitement en cours.');
    if (info.cat.sitterNotes) {
      sectionTitle('Habitudes et consignes');
      list([{ left: info.cat.sitterNotes }], '');
    }
    sectionTitle('Contacts');
    list([
      { left: 'Vétérinaire : ' + (info.cat.vetName || '—'), right: info.cat.vetPhone || '' },
      { left: 'Propriétaire : ' + (info.owner.name || '—'), right: info.owner.phone || '' }
    ], '');

    // Pied de page
    y += 10;
    ctx.fillStyle = C.soft;
    ctx.fillRect(0, y, W, 110);
    ctx.fillStyle = C.muted; ctx.font = font(BODY, 26, 700); ctx.textAlign = 'center';
    ctx.fillText('Fiche du ' + AF.formatDate(AF.today()) + ' · ArwinFelin', W / 2, y + 48);
    ctx.fillText("Ne remplace pas l'avis d'un vétérinaire.", W / 2, y + 86);
    y += 110;

    // On recoupe le canvas à la hauteur réellement utilisée
    const out = document.createElement('canvas');
    out.width = W;
    out.height = Math.min(y, canvas.height);
    out.getContext('2d').drawImage(canvas, 0, 0);
    return new Promise((resolve) => out.toBlob(resolve, 'image/png'));
  }

  /* ---------- L'écran ---------- */

  async function shareView(params) {
    const info = await collect(params.id);
    if (!info) return { html: AF.topbar({ title: 'Fiche', back: true }) + `<div class="page">${AF.emptyState({ title: "Ce chat n'existe plus" })}</div>` };
    const { cat } = info;
    const missing = [];
    if (!cat.vetName && !cat.vetPhone) missing.push('le contact du vétérinaire');
    if (!info.owner.phone) missing.push('votre téléphone');

    const html = `
      ${AF.topbar({ title: 'Fiche de ' + cat.name, back: true, subtitle: 'Pour le véto ou un gardien' })}
      <div class="page">
        ${missing.length ? `
          <div class="alert alert-info">${AF.icon('info')}<div><strong>Pour une fiche complète</strong>
          <p>Ajoutez ${AF.esc(missing.join(' et '))} :
          ${!cat.vetName && !cat.vetPhone ? `<a href="#/chat/${encodeURIComponent(cat.id)}/modifier"><u>modifier ${AF.esc(cat.name)}</u></a>` : ''}
          ${!info.owner.phone ? ` <a href="#/reglages"><u>réglages</u></a>` : ''}</p></div></div>` : ''}
        ${sheetHTML(info)}
        <div class="share-actions">
          <button class="btn btn-primary btn-block" data-share>${AF.icon('share')} Partager l'image</button>
          <button class="btn btn-soft" data-png>${AF.icon('image')} Image PNG</button>
          <button class="btn btn-soft" data-pdf>${AF.icon('print')} PDF</button>
        </div>
        <p class="hint">${AF.icon('info')} PDF : dans la fenêtre d'impression, choisissez « Enregistrer au format PDF ».</p>
      </div>`;

    function mount(root) {
      const fileName = 'fiche-' + AF.normalizeText(cat.name).replace(/[^a-z0-9]+/g, '-') + '.png';

      root.querySelector('[data-pdf]').addEventListener('click', () => window.print());

      root.querySelector('[data-png]').addEventListener('click', async (e) => {
        e.currentTarget.disabled = true;
        const blob = await drawSheet(info);
        AF.downloadBlob(blob, fileName);
        e.currentTarget.disabled = false;
        AF.toast('Image téléchargée', 'success');
      });

      root.querySelector('[data-share]').addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        try {
          const blob = await drawSheet(info);
          const file = new File([blob], fileName, { type: 'image/png' });
          // Le menu de partage du téléphone (WhatsApp, Mail, SMS...)
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: 'Fiche de ' + cat.name, text: 'La fiche de ' + cat.name + ' 🐾' });
          } else {
            AF.downloadBlob(blob, fileName);
            AF.toast("Partage non disponible ici : l'image a été téléchargée", 'info', 3500);
          }
        } catch (err) {
          if (err.name !== 'AbortError') AF.toast('Partage impossible : ' + err.message, 'error');
        } finally {
          btn.disabled = false;
        }
      });
    }

    return { html, mount };
  }

  AF.drawShareSheet = async (catId) => drawSheet(await collect(catId)); // pratique pour tester
  AF.route('/fiche/:id', shareView, 'home');
})(self.AF);
