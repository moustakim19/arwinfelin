/* =====================================================================
   settings.js — Thème (clair / sombre), sauvegarde et restauration
   ===================================================================== */

(function (AF) {
  'use strict';

  /* ---------- Thème ---------- */

  // Le choix est gardé dans localStorage (lecture instantanée au démarrage,
  // voir le petit script dans <head> d'index.html qui évite un "flash" blanc).
  const media = window.matchMedia('(prefers-color-scheme: dark)');

  AF.theme = {
    get: () => localStorage.getItem('af-theme') || 'auto',

    // mode : 'light', 'dark' ou 'auto' (suit le réglage du téléphone)
    set(mode) {
      localStorage.setItem('af-theme', mode);
      document.body.classList.add('theme-anim');
      AF.theme.apply();
      setTimeout(() => document.body.classList.remove('theme-anim'), 400);
    },

    apply() {
      const mode = AF.theme.get();
      const dark = mode === 'dark' || (mode === 'auto' && media.matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      // Couleur de la barre du navigateur / de l'appli installée
      const meta = document.querySelector('meta[name=theme-color]');
      if (meta) meta.content = dark ? '#17121A' : '#FFF6EE';
    }
  };
  // Si le téléphone passe en mode sombre le soir, on suit (en mode "auto")
  media.addEventListener('change', () => { if (AF.theme.get() === 'auto') AF.theme.apply(); });
  AF.theme.apply();

  /* ---------- Sauvegarde complète ---------- */

  // Les photos (Blob) ne peuvent pas aller telles quelles dans un fichier JSON (qui est du texte) :
  // on les transforme en "data URL" (texte base64 : "data:image/jpeg;base64,/9j/4AAQ...").
  const blobToDataURL = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  const dataURLToBlob = async (url) => (await fetch(url)).blob();

  // Parcourt un objet et remplace chaque Blob (ou chaque data URL) par l'autre forme
  async function convert(value, toText) {
    if (toText && value instanceof Blob) return { __blob: await blobToDataURL(value) };
    if (!toText && value && typeof value === 'object' && typeof value.__blob === 'string') return dataURLToBlob(value.__blob);
    if (Array.isArray(value)) return Promise.all(value.map((v) => convert(v, toText)));
    if (value && typeof value === 'object' && !(value instanceof Blob)) {
      const out = {};
      for (const [k, v] of Object.entries(value)) out[k] = await convert(v, toText);
      return out;
    }
    return value;
  }

  // Les magasins sauvegardés (le cache de l'IA se recalcule tout seul, inutile de l'exporter)
  const BACKUP_STORES = AF.db.STORES.filter((s) => s !== 'cache');

  AF.backup = {
    async export() {
      const data = {};
      for (const store of BACKUP_STORES) {
        const rows = await AF.db.getAll(store);
        data[store] = await convert(store === 'settings' ? rows.filter((r) => r.id !== 'notified') : rows, true);
      }
      const file = {
        app: 'ArwinFelin',
        format: 1,
        exportedAt: new Date().toISOString(),
        theme: AF.theme.get(),
        data
      };
      const blob = new Blob([JSON.stringify(file)], { type: 'application/json' });
      const name = 'arwinfelin-sauvegarde-' + AF.today() + '.json';
      AF.downloadBlob(blob, name);
      await AF.db.setSetting('lastBackup', new Date().toISOString());
      return { name, size: blob.size };
    },

    // Lit un fichier de sauvegarde et REMPLACE toutes les données actuelles
    async import(fileObj) {
      let json;
      try {
        json = JSON.parse(await fileObj.text());
      } catch (e) {
        throw new Error("Ce fichier n'est pas une sauvegarde valide (JSON illisible).");
      }
      if (!json || json.app !== 'ArwinFelin' || !json.data || !Array.isArray(json.data.cats)) {
        throw new Error("Ce fichier n'est pas une sauvegarde ArwinFelin.");
      }
      // On convertit tout AVANT d'effacer quoi que ce soit (si ça échoue, rien n'est perdu)
      const ready = {};
      for (const store of BACKUP_STORES) {
        const rows = Array.isArray(json.data[store]) ? json.data[store] : [];
        ready[store] = (await convert(rows, false)).filter((r) => r && r.id);
      }
      for (const store of BACKUP_STORES) {
        await AF.db.clear(store);
        if (ready[store].length) await AF.db.putMany(store, ready[store]);
      }
      if (json.theme) AF.theme.set(json.theme);
      return { cats: ready.cats.length };
    },

    // Efface tout (après double confirmation dans l'écran Réglages)
    async wipe() {
      for (const store of AF.db.STORES) await AF.db.clear(store);
    }
  };

  // Télécharge un fichier créé dans le navigateur
  AF.downloadBlob = function (blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  // Taille lisible : 1 532 000 -> "1,5 Mo"
  AF.formatBytes = function (bytes) {
    if (!bytes) return '0 Mo';
    if (bytes < 1e6) return AF.formatNumber(bytes / 1e3, 0) + ' Ko';
    if (bytes < 1e9) return AF.formatNumber(bytes / 1e6, 1) + ' Mo';
    return AF.formatNumber(bytes / 1e9, 1) + ' Go';
  };

  /* ---------- Clavier ouvert (téléphone) ---------- */

  // Quand on écrit dans un champ, on cache la barre du bas pour libérer de la place
  document.addEventListener('focusin', (e) => {
    if (e.target.matches('input:not([type=checkbox]):not([type=radio]):not([type=range]), textarea, select')) {
      document.body.classList.add('keyboard-open');
    }
  });
  document.addEventListener('focusout', () => {
    setTimeout(() => {
      if (!document.activeElement || !document.activeElement.matches('input, textarea, select')) {
        document.body.classList.remove('keyboard-open');
      }
    }, 100);
  });
})(self.AF);
