/* =====================================================================
   ui.js — Petits composants d'interface réutilisables
   ---------------------------------------------------------------------
   - AF.toast()       : petit message qui apparaît puis disparaît
   - AF.sheet()       : panneau qui glisse depuis le bas de l'écran
   - AF.confirm()     : demande de confirmation (Oui / Non)
   - AF.pickImage()   : ouvre la galerie ou l'appareil photo
   - AF.photoPicker() : zone photo complète (aperçu + boutons)
   ===================================================================== */

(function (AF) {
  'use strict';

  /* ---------- Toast ---------- */

  AF.toast = function (message, type = 'info', duration = 2800) {
    const box = document.getElementById('toasts');
    const el = document.createElement('div');
    const iconName = { success: 'check', error: 'alert', info: 'info' }[type] || 'info';
    el.className = 'toast toast-' + type;
    el.innerHTML = AF.icon(iconName) + '<span>' + AF.esc(message) + '</span>';
    box.appendChild(el);
    // On attend un tout petit peu pour que l'animation d'entrée se déclenche
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 300);
    }, duration);
  };

  /* ---------- Panneau du bas ("bottom sheet") ---------- */

  // options : { title, content (HTML), onMount(element, close), wide }
  // Renvoie un objet { el, close } pour pouvoir le fermer depuis le code.
  AF.sheet = function ({ title = '', content = '', onMount = null, onClose = null } = {}) {
    const backdrop = document.createElement('div');
    backdrop.className = 'sheet-backdrop';
    backdrop.innerHTML = `
      <div class="sheet" role="dialog" aria-modal="true" aria-label="${AF.esc(title)}">
        <div class="sheet-handle"></div>
        ${title ? `<div class="sheet-head"><h2>${AF.esc(title)}</h2>
          <button class="btn-icon" data-close aria-label="Fermer">${AF.icon('close')}</button></div>` : ''}
        <div class="sheet-body">${content}</div>
      </div>`;
    document.body.appendChild(backdrop);
    document.body.classList.add('no-scroll');
    const sheetEl = backdrop.querySelector('.sheet');

    let closed = false;
    function close() {
      if (closed) return;
      closed = true;
      backdrop.classList.remove('show');
      document.removeEventListener('keydown', onKey);
      setTimeout(() => {
        backdrop.remove();
        if (!document.querySelector('.sheet-backdrop')) document.body.classList.remove('no-scroll');
      }, 280);
      if (onClose) onClose();
    }
    function onKey(e) {
      if (e.key === 'Escape') close();
    }

    // Fermer en touchant le fond sombre, la croix, ou avec la touche Échap
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop || e.target.closest('[data-close]')) close();
    });
    document.addEventListener('keydown', onKey);

    // Fermer en faisant glisser le panneau vers le bas (geste naturel sur téléphone)
    let startY = null;
    const handle = backdrop.querySelector('.sheet-handle');
    const head = backdrop.querySelector('.sheet-head');
    [handle, head].filter(Boolean).forEach((zone) => {
      zone.addEventListener('touchstart', (e) => { startY = e.touches[0].clientY; }, { passive: true });
      zone.addEventListener('touchmove', (e) => {
        if (startY === null) return;
        const dy = Math.max(0, e.touches[0].clientY - startY);
        sheetEl.style.transform = 'translateY(' + dy + 'px)';
      }, { passive: true });
      zone.addEventListener('touchend', (e) => {
        const dy = e.changedTouches[0].clientY - startY;
        sheetEl.style.transform = '';
        startY = null;
        if (dy > 90) close();
      });
    });

    requestAnimationFrame(() => backdrop.classList.add('show'));
    if (onMount) onMount(sheetEl, close);
    return { el: sheetEl, close };
  };

  /* ---------- Confirmation ---------- */

  // Exemple : if (await AF.confirm({ title: 'Supprimer ?', danger: true })) { ... }
  AF.confirm = function ({ title, message = '', confirmText = 'Confirmer', cancelText = 'Annuler', danger = false }) {
    return new Promise((resolve) => {
      let answered = false;
      AF.sheet({
        title,
        content: `
          ${message ? `<p class="muted">${AF.esc(message)}</p>` : ''}
          <div class="btn-row">
            <button class="btn btn-ghost" data-no>${AF.esc(cancelText)}</button>
            <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-yes>${AF.esc(confirmText)}</button>
          </div>`,
        onMount(el, close) {
          el.querySelector('[data-yes]').addEventListener('click', () => { answered = true; resolve(true); close(); });
          el.querySelector('[data-no]').addEventListener('click', () => close());
        },
        onClose() {
          if (!answered) resolve(false);
        }
      });
    });
  };

  /* ---------- Choisir une image ---------- */

  // camera = true  -> ouvre directement l'appareil photo (sur téléphone)
  // camera = false -> ouvre la galerie / les fichiers
  // ATTENTION : doit être appelé directement dans un clic (règle des navigateurs).
  AF.pickImage = function ({ camera = false } = {}) {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      if (camera) input.setAttribute('capture', 'environment');
      input.style.display = 'none';
      document.body.appendChild(input);
      input.addEventListener('change', () => {
        const file = input.files && input.files[0];
        input.remove();
        resolve(file || null);
      });
      input.addEventListener('cancel', () => { input.remove(); resolve(null); });
      input.click();
    });
  };

  /* ---------- Zone photo réutilisable ---------- */

  // Crée le HTML d'une zone photo. "id" sert à la retrouver ensuite.
  // shape : "round" (photo de profil) ou "wide" (ordonnance, souvenir)
  AF.photoPickerHTML = function (id, { shape = 'round', label = 'Ajouter une photo', placeholder = '' } = {}) {
    return `
      <div class="photo-picker photo-${shape}" id="${id}">
        <div class="photo-preview">
          <div class="photo-empty">${placeholder || AF.icon('camera')}<span>${AF.esc(label)}</span></div>
          <img alt="" hidden>
          <button type="button" class="photo-remove btn-icon" aria-label="Retirer la photo" hidden>${AF.icon('close')}</button>
        </div>
        <div class="photo-actions">
          <button type="button" class="btn btn-soft btn-sm" data-gallery>${AF.icon('image')} Galerie</button>
          <button type="button" class="btn btn-soft btn-sm" data-camera>${AF.icon('camera')} Appareil photo</button>
        </div>
      </div>`;
  };

  // Active la zone photo. Renvoie un objet avec getBlob() pour récupérer la photo choisie.
  AF.photoPicker = function (root, initialBlob = null, { maxSize = 1280, onChange = null } = {}) {
    let blob = initialBlob;
    const img = root.querySelector('img');
    const empty = root.querySelector('.photo-empty');
    const removeBtn = root.querySelector('.photo-remove');

    function show() {
      if (blob) {
        img.src = AF.blobUrl(blob);
        img.hidden = false;
        empty.hidden = true;
        removeBtn.hidden = false;
      } else {
        img.removeAttribute('src');
        img.hidden = true;
        empty.hidden = false;
        removeBtn.hidden = true;
      }
    }

    async function choose(camera) {
      const file = await AF.pickImage({ camera });
      if (!file) return;
      root.classList.add('loading');
      try {
        blob = await AF.compressImage(file, maxSize);
        show();
        if (onChange) onChange(blob, file);
      } catch (e) {
        AF.toast(e.message, 'error');
      } finally {
        root.classList.remove('loading');
      }
    }

    root.querySelector('[data-gallery]').addEventListener('click', () => choose(false));
    root.querySelector('[data-camera]').addEventListener('click', () => choose(true));
    // Toucher l'aperçu vide ouvre aussi la galerie
    root.querySelector('.photo-preview').addEventListener('click', (e) => {
      if (!blob && !e.target.closest('.photo-remove')) choose(false);
    });
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      blob = null;
      show();
      if (onChange) onChange(null);
    });

    show();
    return { getBlob: () => blob };
  };

  /* ---------- Voir une photo en grand ---------- */

  AF.viewImage = function (blob, caption = '') {
    const url = URL.createObjectURL(blob);
    const box = document.createElement('div');
    box.className = 'lightbox';
    box.innerHTML = `
      <button class="btn-icon btn-glass lightbox-close" aria-label="Fermer">${AF.icon('close')}</button>
      <img src="${url}" alt="">
      ${caption ? `<p>${AF.esc(caption)}</p>` : ''}`;
    document.body.appendChild(box);
    requestAnimationFrame(() => box.classList.add('show'));
    const close = () => {
      box.classList.remove('show');
      document.removeEventListener('keydown', onKey);
      setTimeout(() => { box.remove(); URL.revokeObjectURL(url); }, 250);
    };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    box.addEventListener('click', close);
    document.addEventListener('keydown', onKey);
  };

  /* ---------- Morceaux de HTML fréquents ---------- */

  // Photo du chat, ou une jolie tête de chat dessinée s'il n'en a pas
  AF.catAvatar = function (cat, extraClass = '') {
    if (cat && cat.photo) {
      return `<img class="avatar ${extraClass}" src="${AF.blobUrl(cat.photo)}" alt="${AF.esc(cat.name)}">`;
    }
    const fur = AF.furColor(cat);
    return `<div class="avatar avatar-svg ${extraClass}" style="--avatar-bg:${fur.color}33">${AF.catFaceSVG(fur.color, fur.eyes)}</div>`;
  };

  // Couleur du dessin selon la robe du chat ("Noir" -> dessin noir aux yeux dorés)
  const FUR_COLORS = [
    [/noir|black|smoke/i, '#3B3540', '#E3C75A'],
    [/blanc|white/i, '#F3EEE8', '#3A2A25'],
    [/roux|red|orange/i, '#F0A060', '#3A2A25'],
    [/cr[eè]me|cream|beige/i, '#F1D6AE', '#3A2A25'],
    [/gris|bleu|blue|silver|chartreux/i, '#A7A9BC', '#E3C75A'],
    [/chocolat|brun|marron|brown|seal/i, '#8A6247', '#E3C75A'],
    [/lilas|lilac|lavande/i, '#C9B6D9', '#3A2A25'],
    [/cannelle|cinnamon|fauve|fawn/i, '#C98C5F', '#3A2A25'],
    [/[ée]caille|tortie|calico|tricolore/i, '#C48A5A', '#3A2A25']
  ];
  AF.furColor = function (cat) {
    const text = cat ? cat.color || '' : '';
    for (const [regex, color, eyes] of FUR_COLORS) {
      if (regex.test(text)) return { color, eyes };
    }
    return { color: AF.colorFromText(cat ? cat.name : ''), eyes: '#3A2A25' };
  };

  // Écran vide avec une illustration
  AF.emptyState = function ({ title, text = '', action = '' }) {
    return `
      <div class="empty">
        <div class="empty-art">${AF.catFaceSVG('#F6B48F')}</div>
        <h3>${AF.esc(title)}</h3>
        ${text ? `<p>${AF.esc(text)}</p>` : ''}
        ${action}
      </div>`;
  };

  // En-tête de page. back = true pour afficher le bouton retour.
  AF.topbar = function ({ title, back = false, actions = '', subtitle = '' }) {
    return `
      <header class="topbar">
        ${back ? `<button class="btn-icon" data-back aria-label="Retour">${AF.icon('back')}</button>` : ''}
        <div class="topbar-title">
          <h1>${AF.esc(title)}</h1>
          ${subtitle ? `<p>${AF.esc(subtitle)}</p>` : ''}
        </div>
        <div class="topbar-actions">${actions}</div>
      </header>`;
  };

  // Écran temporaire pour les onglets pas encore construits
  AF.comingSoon = (title) => async () => ({
    html: AF.topbar({ title }) + `<div class="page">${AF.emptyState({ title: 'Bientôt ici', text: 'Cet onglet arrive dans une prochaine étape.' })}</div>`
  });

  // Lit tous les champs d'un formulaire et renvoie un objet { nom: valeur }
  AF.formData = function (form) {
    const data = {};
    for (const el of form.elements) {
      if (!el.name) continue;
      if (el.type === 'checkbox') data[el.name] = el.checked;
      else if (el.type === 'radio') {
        if (el.checked) data[el.name] = el.value;
      } else data[el.name] = el.value.trim();
    }
    return data;
  };
})(self.AF);
