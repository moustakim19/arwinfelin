/* =====================================================================
   utils.js — Petites fonctions utiles partout dans l'appli
   ---------------------------------------------------------------------
   Toute l'appli range ses fonctions dans un seul objet global "AF"
   (pour ArwinFelin). Ça évite de mélanger nos noms avec ceux du
   navigateur ou des bibliothèques externes.
   ===================================================================== */

// "self" vaut "window" dans une page, et le service worker dans le SW.
// On crée l'objet AF s'il n'existe pas encore.
self.AF = self.AF || {};

(function (AF) {
  'use strict';

  /* ---------- Identifiants uniques ---------- */

  // Génère un identifiant unique pour chaque chat, vaccin, souvenir...
  // crypto.randomUUID() n'existe que sur HTTPS ou localhost : on prévoit un plan B.
  AF.uid = function () {
    if (self.crypto && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  };

  /* ---------- Sécurité : échapper le texte ---------- */

  // TRÈS IMPORTANT : quand on insère du texte tapé par l'utilisateur dans
  // du HTML, on remplace les caractères spéciaux (< > & " ').
  // Sinon, un nom de chat comme "<img onerror=...>" pourrait exécuter du code.
  const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  AF.esc = function (value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/[&<>"']/g, (c) => ESCAPES[c]);
  };

  /* ---------- Dates ---------- */

  // Ajoute un zéro devant les nombres < 10 : 5 -> "05"
  AF.pad = (n) => String(n).padStart(2, '0');

  // Transforme un objet Date en texte "AAAA-MM-JJ" (format des <input type="date">)
  AF.toISODate = function (date) {
    return date.getFullYear() + '-' + AF.pad(date.getMonth() + 1) + '-' + AF.pad(date.getDate());
  };

  // Date du jour au format "AAAA-MM-JJ"
  AF.today = () => AF.toISODate(new Date());

  // Date + heure locale au format des <input type="datetime-local"> : "AAAA-MM-JJTHH:MM"
  AF.toLocalDateTime = function (date) {
    return AF.toISODate(date) + 'T' + AF.pad(date.getHours()) + ':' + AF.pad(date.getMinutes());
  };

  // Lit "AAAA-MM-JJ" (ou "AAAA-MM-JJTHH:MM") et renvoie une Date LOCALE.
  // Piège classique : new Date("2024-03-12") est interprété en heure UTC,
  // ce qui peut décaler d'un jour. On découpe donc le texte nous-mêmes.
  AF.parseDate = function (text) {
    if (!text) return null;
    const [datePart, timePart] = String(text).split('T');
    const [y, m, d] = datePart.split('-').map(Number);
    if (!y || !m || !d) return null;
    let hours = 0, minutes = 0;
    if (timePart) {
      [hours, minutes] = timePart.split(':').map(Number);
    }
    return new Date(y, m - 1, d, hours || 0, minutes || 0);
  };

  // Renvoie une copie de la date à minuit (pour comparer des jours entiers)
  AF.startOfDay = function (date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  // Nombre de jours entre aujourd'hui et une date (négatif si la date est passée)
  AF.daysUntil = function (text) {
    const target = AF.parseDate(text);
    if (!target) return null;
    const diff = AF.startOfDay(target) - AF.startOfDay(new Date());
    return Math.round(diff / 86400000); // 86 400 000 ms = 1 jour
  };

  // Formats d'affichage en français grâce à l'API Intl du navigateur
  const fmtLong = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const fmtShort = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
  const fmtMonth = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
  const fmtTime = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const fmtWeekday = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  // "12 mars 2024"
  AF.formatDate = function (text) {
    const d = AF.parseDate(text);
    return d ? fmtLong.format(d) : '';
  };
  // "12 mars"
  AF.formatShortDate = function (text) {
    const d = AF.parseDate(text);
    return d ? fmtShort.format(d) : '';
  };
  // "mars 2024"
  AF.formatMonth = function (text) {
    const d = AF.parseDate(text);
    return d ? fmtMonth.format(d) : '';
  };
  // "14:30"
  AF.formatTime = function (text) {
    const d = AF.parseDate(text);
    return d ? fmtTime.format(d) : '';
  };
  // "mardi 12 mars"
  AF.formatWeekday = function (date) {
    return fmtWeekday.format(date);
  };

  // Texte relatif : "aujourd'hui", "demain", "dans 5 jours", "il y a 3 jours"
  AF.relativeDays = function (days) {
    if (days === null) return '';
    if (days === 0) return "aujourd'hui";
    if (days === 1) return 'demain';
    if (days === -1) return 'hier';
    if (days > 1) return 'dans ' + days + ' jours';
    return 'il y a ' + Math.abs(days) + ' jours';
  };

  // Majuscule sur la première lettre seulement : "dimanche 25 octobre" -> "Dimanche 25 octobre"
  AF.capitalize = (text) => (text ? text.charAt(0).toUpperCase() + text.slice(1) : '');

  // Mise au pluriel simple : plural(2, 'an', 'ans') -> "2 ans"
  AF.plural = (n, one, many) => n + ' ' + (n > 1 ? many : one);

  /* ---------- Âge du chat ---------- */

  // Calcule l'âge exact (années, mois, jours) à partir de la date de naissance
  AF.catAge = function (birthText) {
    const birth = AF.parseDate(birthText);
    const now = AF.startOfDay(new Date());
    if (!birth || birth > now) return null;

    let years = now.getFullYear() - birth.getFullYear();
    let months = now.getMonth() - birth.getMonth();
    let days = now.getDate() - birth.getDate();

    // Si le jour n'est pas encore atteint ce mois-ci, on "emprunte" un mois
    if (days < 0) {
      months -= 1;
      // Nombre de jours du mois précédent
      days += new Date(now.getFullYear(), now.getMonth(), 0).getDate();
    }
    // Si le mois n'est pas encore atteint cette année, on "emprunte" une année
    if (months < 0) {
      years -= 1;
      months += 12;
    }
    const totalMonths = years * 12 + months + days / 30.44;
    return { years, months, days, totalMonths };
  };

  // Âge en texte lisible : "3 ans et 2 mois", "5 mois", "12 jours"
  AF.ageLabel = function (age) {
    if (!age) return 'Âge inconnu';
    if (age.years === 0 && age.months === 0) return AF.plural(age.days, 'jour', 'jours');
    if (age.years === 0) {
      return age.months + ' mois' + (age.days ? ' et ' + AF.plural(age.days, 'jour', 'jours') : '');
    }
    return AF.plural(age.years, 'an', 'ans') + (age.months ? ' et ' + age.months + ' mois' : '');
  };

  // Âge court pour les cartes : "3 ans", "5 mois", "12 j"
  AF.ageShort = function (age) {
    if (!age) return '';
    if (age.years > 0) return AF.plural(age.years, 'an', 'ans');
    if (age.months > 0) return age.months + ' mois';
    return age.days + ' j';
  };

  // Correspondance âge du chat (en mois) -> âge humain (en années).
  // Repères inspirés du tableau d'International Cat Care :
  // 1 mois ≈ 1 an, 6 mois ≈ 10 ans, 1 an ≈ 15 ans, 2 ans ≈ 24 ans,
  // puis +4 années humaines par année de chat.
  const HUMAN_AGE_POINTS = [
    [0, 0], [1, 1], [3, 4], [4, 7], [6, 10], [7, 12], [12, 15], [18, 21], [24, 24]
  ];
  AF.humanAge = function (totalMonths) {
    if (totalMonths >= 24) {
      return Math.round(24 + ((totalMonths - 24) / 12) * 4);
    }
    // Entre deux repères, on fait une "interpolation linéaire" (une règle de trois)
    for (let i = 1; i < HUMAN_AGE_POINTS.length; i++) {
      const [m1, h1] = HUMAN_AGE_POINTS[i - 1];
      const [m2, h2] = HUMAN_AGE_POINTS[i];
      if (totalMonths <= m2) {
        return Math.round(h1 + ((totalMonths - m1) / (m2 - m1)) * (h2 - h1));
      }
    }
    return 0;
  };

  // Étape de vie (classification d'International Cat Care)
  AF.lifeStage = function (totalMonths) {
    if (totalMonths < 7) return { label: 'Chaton', emoji: '🍼' };
    if (totalMonths < 36) return { label: 'Junior', emoji: '🌱' };
    if (totalMonths < 84) return { label: 'Adulte en pleine forme', emoji: '💪' };
    if (totalMonths < 132) return { label: 'Adulte mature', emoji: '🌿' };
    if (totalMonths < 180) return { label: 'Senior', emoji: '🌙' };
    return { label: 'Super senior', emoji: '👑' };
  };

  // Nombre de jours avant le prochain anniversaire
  AF.daysToBirthday = function (birthText) {
    const birth = AF.parseDate(birthText);
    if (!birth) return null;
    const today = AF.startOfDay(new Date());
    let next = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
    if (next < today) next = new Date(today.getFullYear() + 1, birth.getMonth(), birth.getDate());
    return Math.round((next - today) / 86400000);
  };

  /* ---------- Images ---------- */

  // Réduit et compresse une photo avant de l'enregistrer.
  // Une photo de téléphone fait souvent 3 à 8 Mo ; après passage ici, ~150 à 300 Ko.
  AF.compressImage = function (file, maxSize = 1280, quality = 0.85) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        // On garde les proportions : le plus grand côté fait au maximum "maxSize" pixels
        const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.round(img.naturalWidth * scale);
        const h = Math.round(img.naturalHeight * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        // toBlob transforme le dessin en fichier JPEG
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Compression impossible'));
        }, 'image/jpeg', quality);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Cette image n'a pas pu être lue"));
      };
      img.src = url;
    });
  };

  // Les photos sont stockées comme des "Blob" (fichiers binaires).
  // Pour les afficher dans une balise <img>, on crée une adresse temporaire
  // "blob:..." avec URL.createObjectURL. On les note pour les libérer plus tard
  // (sinon la mémoire du téléphone se remplit petit à petit).
  let trackedUrls = [];
  AF.blobUrl = function (blob) {
    if (!blob) return '';
    const url = URL.createObjectURL(blob);
    trackedUrls.push(url);
    return url;
  };
  // Récupère la liste actuelle et repart d'une liste vide (utilisé par le routeur)
  AF.takeTrackedUrls = function () {
    const list = trackedUrls;
    trackedUrls = [];
    return list;
  };

  /* ---------- Divers ---------- */

  // Couleur douce et stable calculée à partir d'un texte (pour les avatars sans photo)
  const SOFT_COLORS = ['#F6B48F', '#F4C27A', '#C9B6F2', '#9ED8C0', '#F2A7A7', '#A9CFF2', '#E8C3A0', '#D7B4E8'];
  AF.colorFromText = function (text) {
    let hash = 0;
    for (const char of String(text || '')) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    return SOFT_COLORS[hash % SOFT_COLORS.length];
  };

  // Lit un nombre tapé par l'utilisateur, en acceptant la virgule française : "4,2" -> 4.2
  AF.parseNumber = function (text) {
    if (text === null || text === undefined || text === '') return null;
    const n = parseFloat(String(text).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  };

  // Affiche un nombre à la française : 4.25 -> "4,25"
  AF.formatNumber = function (n, decimals = 1) {
    if (n === null || n === undefined || !Number.isFinite(n)) return '';
    return n.toLocaleString('fr-FR', { maximumFractionDigits: decimals });
  };

  // Affiche un prix : 45 -> "45,00 €"
  AF.formatPrice = function (n) {
    if (n === null || n === undefined || !Number.isFinite(n)) return '';
    return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
  };

  // Trie une liste d'objets par date (la plus récente en premier)
  AF.sortByDateDesc = (list, key = 'date') =>
    list.slice().sort((a, b) => String(b[key] || '').localeCompare(String(a[key] || '')));
})(self.AF);
