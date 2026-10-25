/* =====================================================================
   icons.js — Toutes les icônes de l'appli, dessinées en SVG
   ---------------------------------------------------------------------
   Le SVG est un format d'image fait de formes mathématiques : il reste
   net à toutes les tailles et prend sa couleur du texte (currentColor).
   Chaque icône est une grille de 24 x 24 avec des traits arrondis.
   ===================================================================== */

(function (AF) {
  'use strict';

  // Le "dessin" de chaque icône (le contenu de la balise <svg>)
  const PATHS = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/>',
    health: '<path d="M19.5 12.6 12 20l-7.5-7.4A5 5 0 1 1 12 6a5 5 0 1 1 7.5 6.6Z"/><path d="M5 12h3l1.5-2.5 3 5L14 12h5"/>',
    journal: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="m21 16-4.5-4.5L7 20"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z"/><circle cx="12" cy="13" r="3.5"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-4.5-4.5L5 21"/>',
    edit: '<path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    cake: '<path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/><path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1"/><path d="M2 21h20M7 8v3M12 8v3M17 8v3"/><path d="M7 4.5h.01M12 4.5h.01M17 4.5h.01"/>',
    paw: '<circle cx="11" cy="4" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="20" cy="16" r="2"/><path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z"/>',
    syringe: '<path d="m18 2 4 4"/><path d="m17 7 3-3"/><path d="M19 9 8.7 19.3a2.4 2.4 0 0 1-3.4 0l-.6-.6a2.4 2.4 0 0 1 0-3.4L15 5"/><path d="m9 11 4 4"/><path d="m5 19-3 3"/><path d="m14 4 6 6"/>',
    pill: '<path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/>',
    bug: '<path d="m8 2 1.88 1.88M14.12 3.88 16 2"/><path d="M9 7.13v-1a3 3 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6Z"/><path d="M12 20v-9M6.53 9C4.6 8.8 3 7.1 3 5M6 13H2M3 21c0-2.1 1.7-3.9 3.8-4M20.97 5c0 2.1-1.6 3.8-3.5 4M22 13h-4M17.2 17c2.1.1 3.8 1.9 3.8 4"/>',
    worm: '<path d="M4 15c2 0 2-3 4-3s2 3 4 3 2-3 4-3 2 3 4 3"/><path d="M4 9c2 0 2-3 4-3s2 3 4 3 2-3 4-3 2 3 4 3"/>',
    stethoscope: '<path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6 6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/><path d="M8 15v1a6 6 0 0 0 6 6 6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1Z"/><path d="m9 12 2 2 4-4"/>',
    scale: '<rect x="3" y="3" width="18" height="18" rx="5"/><path d="M8.5 9.5a5 5 0 0 1 7 0L13 12"/><path d="M12 12h.01"/>',
    bowl: '<path d="M3 11h18a9 9 0 0 1-18 0Z"/><path d="M7 21h10"/><path d="M8 7c0-1 1-1.5 1-2.5S8 3 8 3M12 7c0-1 1-1.5 1-2.5S12 3 12 3M16 7c0-1 1-1.5 1-2.5S16 3 16 3"/>',
    sparkles: '<path d="M9.94 15.5A2 2 0 0 0 8.5 14.06l-6.13-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.13a.5.5 0 0 1 .96 0L14.06 8.5A2 2 0 0 0 15.5 9.94l6.13 1.58a.5.5 0 0 1 0 .96L15.5 14.06a2 2 0 0 0-1.44 1.44l-1.58 6.13a.5.5 0 0 1-.96 0Z"/><path d="M20 3v4M22 5h-4"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    share: '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="m16 6-4-4-4 4"/><path d="M12 2v13"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
    settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z"/><circle cx="12" cy="12" r="3"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z"/>',
    file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 13h4M10 17h4"/>',
    scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="12" r="3.5"/>',
    heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
    chip: '<rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>',
    palette: '<path d="M12 22a10 10 0 1 1 10-10c0 2.2-1.8 3.5-4 3.5h-2.2a2 2 0 0 0-1.5 3.3c.3.4.4.8.4 1.2A2 2 0 0 1 12 22Z"/><circle cx="7.5" cy="10.5" r="1"/><circle cx="10.5" cy="6.5" r="1"/><circle cx="15.5" cy="7" r="1"/>',
    dna: '<path d="m10 16 1.5 1.5M14 8l-1.5-1.5M15 2c-1.8 1.8-2.5 3.5-2.5 5.5 0 1.3.3 2.6.7 3.9M9 22c1.8-1.8 2.5-3.5 2.5-5.5 0-1.3-.3-2.6-.7-3.9"/><path d="M2 15c1.8-1.8 3.5-2.5 5.5-2.5 1.3 0 2.6.3 3.9.7M22 9c-1.8 1.8-3.5 2.5-5.5 2.5-1.3 0-2.6-.3-3.9-.7"/>',
    gender: '<circle cx="10" cy="14" r="5"/><path d="M14 10 21 3M15 3h6v6"/>',
    ribbon: '<path d="M12 11.22C11 9.997 10 9 10 8a2 2 0 0 1 4 0c0 1-.998 2.002-2.01 3.22"/><path d="m12 18 2.57-3.5"/><path d="M6.243 9.016a7 7 0 0 1 11.507-.009"/><path d="M9.35 14.53 12 11.22"/><path d="M9.35 14.53C7.728 12.246 6 10.221 6 7a6 5 0 0 1 12 0c-.005 3.22-1.778 5.235-3.43 7.5l3.557 4.527a1 1 0 0 1-.203 1.43l-1.894 1.36a1 1 0 0 1-1.384-.215L12 18l-2.679 3.593a1 1 0 0 1-1.39.213l-1.865-1.353a1 1 0 0 1-.203-1.422Z"/>',
    star: '<path d="M11.5 2.3a.6.6 0 0 1 1 0l2.6 5.3a.6.6 0 0 0 .5.3l5.8.9a.6.6 0 0 1 .3 1l-4.2 4.1a.6.6 0 0 0-.2.5l1 5.8a.6.6 0 0 1-.8.6l-5.2-2.7a.6.6 0 0 0-.6 0L6.6 21a.6.6 0 0 1-.8-.6l1-5.8a.6.6 0 0 0-.2-.5L2.4 10a.6.6 0 0 1 .3-1l5.8-.9a.6.6 0 0 0 .5-.3Z"/>',
    timeline: '<path d="M12 3v18"/><circle cx="12" cy="7" r="2"/><circle cx="12" cy="17" r="2"/><path d="M14 7h6M4 17h6"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    litter: '<path d="M3 10h18l-2 9a2 2 0 0 1-2 1.6H7A2 2 0 0 1 5 19Z"/><path d="M7 14h.01M11 16h.01M15 14h.01M9 7l1-3M15 7l-1-3"/>',
    install: '<rect x="5" y="2" width="14" height="20" rx="3"/><path d="M12 7v8M9 12l3 3 3-3"/><path d="M11 19h2"/>',
    wifi: '<path d="M12 20h.01M2 8.82a15 15 0 0 1 20 0M5 12.86a10 10 0 0 1 14 0M8.5 16.43a5 5 0 0 1 7 0"/>',
    database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',
    filter: '<path d="M22 3H2l8 9.46V19l4 2v-8.54Z"/>',
    euro: '<path d="M4 10h12M4 14h9M19 6a7.7 7.7 0 0 0-5.2-2A7.9 7.9 0 0 0 6 12c0 4.4 3.5 8 7.8 8 2 0 3.8-.8 5.2-2"/>',
    flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5Z"/>',
    trendUp: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
    trendDown: '<path d="m22 17-8.5-8.5-5 5L2 7"/><path d="M16 17h6v-6"/>',
    print: '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8" rx="1"/>',
    more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
    leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
    gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/>'
  };

  // Renvoie le code HTML d'une icône. Exemple : AF.icon('home')
  AF.icon = function (name, extraClass = '') {
    const body = PATHS[name] || PATHS.paw;
    return '<svg class="icon ' + extraClass + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + '</svg>';
  };

  // Petite illustration de tête de chat, utilisée quand un chat n'a pas de photo.
  // "color" est la couleur du pelage.
  AF.catFaceSVG = function (color = '#F6B48F', eyeColor = '#3A2A25') {
    return `
<svg class="cat-face" viewBox="0 0 120 120" aria-hidden="true">
  <path d="M22 46 L27 13 L51 33 Q60 30 69 33 L93 13 L98 46 Q106 60 102 76 Q95 103 60 105 Q25 103 18 76 Q14 60 22 46Z" fill="${color}"/>
  <path d="M31 23 L34 41 L45 33Z M89 23 L86 41 L75 33Z" fill="#fff" opacity=".45"/>
  <ellipse cx="44" cy="66" rx="6.5" ry="8" fill="${eyeColor}"/>
  <ellipse cx="76" cy="66" rx="6.5" ry="8" fill="${eyeColor}"/>
  <circle cx="46.5" cy="63" r="2.3" fill="#fff"/>
  <circle cx="78.5" cy="63" r="2.3" fill="#fff"/>
  <path d="M55.5 78 h9 l-4.5 5z" fill="#F07B7B"/>
  <path d="M60 83 q-3.5 6 -9 4 M60 83 q3.5 6 9 4" stroke="#3A2A25" stroke-width="2.4" fill="none" stroke-linecap="round"/>
  <path d="M30 78 h-16 M31 84 l-15 4 M90 78 h16 M89 84 l15 4" stroke="#3A2A25" stroke-width="2" stroke-linecap="round" opacity=".55"/>
  <ellipse cx="35" cy="80" rx="6" ry="3.5" fill="#F07B7B" opacity=".25"/>
  <ellipse cx="85" cy="80" rx="6" ry="3.5" fill="#F07B7B" opacity=".25"/>
</svg>`;
  };
})(self.AF);
