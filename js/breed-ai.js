/* =====================================================================
   breed-ai.js — La reconnaissance de race, 100 % dans le téléphone
   ---------------------------------------------------------------------
   On utilise Transformers.js (une bibliothèque qui fait tourner des
   modèles d'IA dans le navigateur) avec le modèle CLIP d'OpenAI,
   converti par Hugging Face : "Xenova/clip-vit-base-patch32".

   CLIP sait transformer une image ET une phrase en une liste de 512
   nombres (une "empreinte" ou "embedding"). Si l'image et la phrase
   parlent de la même chose, leurs empreintes se ressemblent.
   -> On compare l'empreinte de la photo avec celle de chaque phrase
      "a photo of a Persian cat", "a photo of a Siamese cat"...
      La phrase la plus proche donne la race la plus probable.
   C'est du "zero-shot" : le modèle n'a jamais été entraîné
   spécialement sur nos races, il les reconnaît grâce aux mots.

   Rien n'est envoyé sur internet : seul le modèle est téléchargé
   (une fois), ensuite tout est calculé sur l'appareil.
   ===================================================================== */

(function (AF) {
  'use strict';

  const LIB_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.1/dist/transformers.min.js';
  const MODEL = 'Xenova/clip-vit-base-patch32';
  // Précision des nombres du modèle :
  // - images : "q8" (8 bits), 4 fois plus léger et presque aussi précis ;
  // - texte  : "fp16" (16 bits). En 8 bits, le modèle texte de CLIP perd presque
  //   toute sa finesse (testé : toutes les races obtenaient le même score !).
  const VISION_DTYPE = 'q8';
  const TEXT_DTYPE = 'fp16';
  // Les empreintes des phrases, déjà calculées et livrées avec l'appli
  const BUNDLED_EMBEDDINGS = 'data/clip-text-embeddings.json';
  // Tailles approximatives des fichiers (pour une barre de progression qui ne recule pas)
  const EXPECTED_BYTES = { vision: 89e6, text: 127e6 };
  // CLIP multiplie les ressemblances par 100 avant de les transformer en pourcentages
  const LOGIT_SCALE = 100;
  // En dessous de ce pourcentage, on préfère dire "race indéterminée"
  const MIN_CONFIDENCE = 0.35;
  // Petit bonus pour "chat de gouttière" : dans la vraie vie, la grande majorité des chats
  // ne sont pas de race. Sans ce bonus, l'IA trouve toujours une race qui "ressemble un peu".
  // Valeur choisie après des tests sur des photos de référence (Wikipédia) : 0,008.
  const TUNING = { domesticBonus: 0.008 };

  let lib = null;            // la bibliothèque Transformers.js
  let processor = null;      // prépare l'image (taille 224 x 224, couleurs)
  let visionModel = null;    // transforme l'image en empreinte
  let textBank = null;       // empreintes de toutes nos phrases (calculées une seule fois)
  let loadingPromise = null;

  /* ---------- Les phrases données à CLIP ---------- */

  // Plusieurs façons de dire la même chose : on fait la moyenne des empreintes
  // ("prompt ensembling"), c'est un peu plus fiable qu'une seule phrase.
  function buildLabels() {
    const labels = [];
    for (const b of AF.BREEDS) {
      labels.push({ key: 'breed:' + b.id, texts: [b.prompt + '.', 'a photo of a ' + b.en + ', a type of cat.'] });
    }
    for (const hair of ['short', 'long']) {
      const d = AF.DOMESTIC[hair];
      labels.push({ key: 'domestic:' + hair, texts: [d.prompt, ...d.extra].map((t) => t + '.') });
    }
    labels.push({ key: 'hairless', texts: ['a photo of a hairless cat.'] });
    AF.NOT_CAT_PROMPTS.forEach((text, i) => labels.push({ key: 'notcat:' + i, texts: [text + '.'] }));
    return labels;
  }

  // Petite "empreinte" du texte des phrases : si on change races.js, le cache est recalculé
  function hashLabels(labels) {
    let h = 5381;
    const s = MODEL + JSON.stringify(labels.map((l) => l.texts));
    for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    return 'clip-text-' + h.toString(36);
  }

  /* ---------- Petits calculs ---------- */

  // Rend un vecteur de longueur 1 : on peut alors comparer avec un simple produit scalaire
  function normalize(vec) {
    let sum = 0;
    for (let i = 0; i < vec.length; i++) sum += vec[i] * vec[i];
    const norm = Math.sqrt(sum) || 1;
    const out = new Float32Array(vec.length);
    for (let i = 0; i < vec.length; i++) out[i] = vec[i] / norm;
    return out;
  }

  // Ressemblance entre deux empreintes (cosinus) : 1 = identiques, 0 = sans rapport
  function dot(a, b) {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += a[i] * b[i];
    return s;
  }

  // "Softmax" : transforme des scores en pourcentages qui font 100 % au total
  function softmax(scores) {
    const max = Math.max(...scores);
    const exps = scores.map((s) => Math.exp((s - max) * LOGIT_SCALE));
    const total = exps.reduce((a, b) => a + b, 0);
    return exps.map((e) => e / total);
  }

  /* ---------- Chargement ---------- */

  AF.breedAI = {
    MODEL,

    // Le modèle a-t-il déjà été téléchargé une fois ?
    async isDownloaded() {
      return Boolean(await AF.db.getSetting('aiReady', false));
    },

    isLoaded: () => Boolean(visionModel && textBank),
    tuning: TUNING,

    // Charge tout ce qu'il faut. onProgress(pourcentage 0-100, texte)
    load(onProgress = () => {}) {
      if (AF.breedAI.isLoaded()) return Promise.resolve();
      if (!loadingPromise) loadingPromise = doLoad(onProgress).catch((e) => { loadingPromise = null; throw e; });
      return loadingPromise;
    },

    analyze
  };

  async function doLoad(onProgress) {
    if (location.protocol === 'file:') {
      throw new Error("Ouvrez l'appli avec Live Server (adresse http://…) : le modèle ne peut pas se charger depuis un fichier.");
    }
    onProgress(0, 'Préparation…');
    // import() dynamique : on ne télécharge la bibliothèque que si on en a besoin
    lib = await import(LIB_URL);
    lib.env.allowLocalModels = false;   // modèles pris sur huggingface.co
    lib.env.useBrowserCache = true;     // ...puis gardés dans le cache du navigateur (hors ligne ensuite)

    const labels = buildLabels();
    const cacheKey = hashLabels(labels);
    // On cherche les empreintes des phrases : d'abord dans IndexedDB, puis dans le fichier livré
    let cached = await AF.db.get('cache', cacheKey);
    if (!cached) {
      cached = await loadBundledEmbeddings(cacheKey);
      if (cached) await AF.db.put('cache', cached);
    }
    const needText = !cached;

    // Suivi du téléchargement : octets reçus / octets attendus
    const files = {};
    const expected = EXPECTED_BYTES.vision + (needText ? EXPECTED_BYTES.text : 0);
    const progress_callback = (p) => {
      if (p.status === 'progress' && p.file && p.total) {
        files[p.file] = { loaded: p.loaded, total: p.total };
        const loaded = Object.values(files).reduce((s, f) => s + f.loaded, 0);
        const total = Math.max(expected, Object.values(files).reduce((s, f) => s + f.total, 0));
        onProgress(Math.min(99, (loaded / total) * 100), 'Téléchargement du modèle…');
      }
    };

    // 1. Les empreintes des phrases : calculées une seule fois, puis gardées dans IndexedDB
    if (cached) {
      textBank = cached.labels;
    } else {
      const tokenizer = await lib.AutoTokenizer.from_pretrained(MODEL, { progress_callback });
      const textModel = await lib.CLIPTextModelWithProjection.from_pretrained(MODEL, { dtype: TEXT_DTYPE, progress_callback });
      onProgress(99, 'Apprentissage des races…');
      const allTexts = labels.flatMap((l) => l.texts);
      const vectors = [];
      // Par paquets de 16 phrases, pour ne pas saturer la mémoire du téléphone
      for (let i = 0; i < allTexts.length; i += 16) {
        const inputs = tokenizer(allTexts.slice(i, i + 16), { padding: true, truncation: true });
        const { text_embeds } = await textModel(inputs);
        const [n, dim] = text_embeds.dims;
        for (let j = 0; j < n; j++) vectors.push(normalize(text_embeds.data.slice(j * dim, (j + 1) * dim)));
      }
      // Moyenne des différentes phrases de chaque étiquette
      let k = 0;
      textBank = labels.map((l) => {
        const dim = vectors[0].length;
        const mean = new Float32Array(dim);
        for (let t = 0; t < l.texts.length; t++, k++) for (let d = 0; d < dim; d++) mean[d] += vectors[k][d];
        return { key: l.key, vector: normalize(mean) };
      });
      await AF.db.put('cache', { id: cacheKey, labels: textBank, createdAt: new Date().toISOString() });
      // Le modèle texte n'est plus utile : on libère la mémoire
      if (textModel.dispose) await textModel.dispose();
    }

    // 2. Le modèle "vision" qui lit les photos
    processor = await lib.AutoProcessor.from_pretrained(MODEL, { progress_callback });
    visionModel = await lib.CLIPVisionModelWithProjection.from_pretrained(MODEL, { dtype: VISION_DTYPE, progress_callback });
    await AF.db.setSetting('aiReady', true);
    onProgress(100, 'Prêt !');
  }

  // Le fichier livré stocke chaque empreinte en base64 (texte) pour rester compact
  async function loadBundledEmbeddings(cacheKey) {
    try {
      const res = await fetch(BUNDLED_EMBEDDINGS);
      if (!res.ok) return null;
      const json = await res.json();
      if (json.key !== cacheKey) return null; // races.js a changé : il faudra recalculer
      return {
        id: cacheKey,
        labels: json.labels.map((l) => ({ key: l.key, vector: AF.base64ToFloat32(l.vector) })),
        createdAt: json.createdAt
      };
    } catch (e) {
      return null;
    }
  }

  // Outils pour (dé)coder un tableau de nombres en base64
  AF.float32ToBase64 = function (arr) {
    const bytes = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  };
  AF.base64ToFloat32 = function (text) {
    const bin = atob(text);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Float32Array(bytes.buffer);
  };

  // Pour le développeur : recalcule le fichier data/clip-text-embeddings.json
  // (à lancer dans la console du navigateur après avoir modifié races.js)
  AF.breedAI.exportEmbeddings = async function () {
    await AF.breedAI.load();
    const labels = buildLabels();
    return JSON.stringify({
      key: hashLabels(labels),
      model: MODEL,
      dtype: TEXT_DTYPE,
      createdAt: new Date().toISOString(),
      labels: textBank.map((l) => ({ key: l.key, vector: AF.float32ToBase64(l.vector) }))
    });
  };

  /* ---------- Analyse d'une photo ---------- */

  // Les 6 familles de la première étape
  const FAMILIES = {
    notcat: 'Pas un chat',
    domestic_short: 'Chat de gouttière à poil court',
    domestic_long: 'Chat de gouttière à poil long',
    breed_short: 'Race à poil court',
    breed_long: 'Race à poil long ou mi-long',
    hairless: 'Race sans poil'
  };
  AF.BREED_FAMILIES = FAMILIES;

  // Pour chaque famille, les étiquettes qu'on compare à l'étape 2
  function candidatesFor(family) {
    const breeds = (hairs) => AF.BREEDS.filter((b) => hairs.includes(b.hair)).map((b) => 'breed:' + b.id);
    if (family === 'domestic_short' || family === 'breed_short') return [...breeds(['short']), 'domestic:short'];
    if (family === 'domestic_long' || family === 'breed_long') return [...breeds(['semi', 'long']), 'domestic:long'];
    if (family === 'hairless') return breeds(['hairless']);
    return [];
  }

  async function analyze(fileOrBlob) {
    await AF.breedAI.load();
    const t0 = performance.now();

    // 1. On réduit la photo : CLIP ne regarde qu'un carré de 224 pixels,
    //    inutile de lui donner 12 millions de pixels (et c'est bien plus rapide)
    const small = await AF.compressImage(fileOrBlob, 448, 0.9);
    // CLIP coupe l'image au centre (un carré). Si le chat est sur le côté, il peut être coupé.
    // On regarde donc DEUX versions : la photo coupée au centre, et la photo entière posée
    // sur un carré. On fait la moyenne des deux empreintes : c'est plus fiable.
    const views = [small, await squareWithBorders(small)];
    const sum = new Float32Array(512);
    for (const view of views) {
      const image = await lib.RawImage.fromBlob(view);
      const { image_embeds } = await visionModel(await processor(image));
      const v = normalize(image_embeds.data);
      for (let i = 0; i < v.length; i++) sum[i] += v[i];
    }
    const img = normalize(sum);

    // 2. Ressemblance avec chaque phrase
    const sim = {};
    for (const label of textBank) sim[label.key] = dot(img, label.vector);
    sim['domestic:short'] += TUNING.domesticBonus;
    sim['domestic:long'] += TUNING.domesticBonus;
    const maxOf = (keys) => Math.max(...keys.map((k) => sim[k]).filter((v) => v !== undefined));
    const breedKeys = (hairs) => AF.BREEDS.filter((b) => hairs.includes(b.hair)).map((b) => 'breed:' + b.id);

    // ÉTAPE 1 : la famille
    const familyIds = Object.keys(FAMILIES);
    const familyScores = [
      maxOf(Object.keys(sim).filter((k) => k.startsWith('notcat:'))),
      sim['domestic:short'],
      sim['domestic:long'],
      maxOf(breedKeys(['short'])),
      maxOf(breedKeys(['semi', 'long'])),
      Math.max(sim.hairless, maxOf(breedKeys(['hairless'])))
    ];
    const familyProbs = softmax(familyScores);
    const families = familyIds.map((id, i) => ({ id, label: FAMILIES[id], prob: familyProbs[i] })).sort((a, b) => b.prob - a.prob);
    const topFamily = families[0];

    if (topFamily.id === 'notcat') {
      return { kind: 'notcat', families, top: [], ms: Math.round(performance.now() - t0) };
    }

    // ÉTAPE 2 : seulement les races de cette famille (et d'une famille voisine si c'est serré)
    const keys = new Set(candidatesFor(topFamily.id));
    for (const f of families.slice(1)) {
      if (f.id !== 'notcat' && f.prob >= topFamily.prob * 0.5) candidatesFor(f.id).forEach((k) => keys.add(k));
    }
    const list = [...keys];
    const probs = softmax(list.map((k) => sim[k]));
    const ranked = list.map((key, i) => ({ key, prob: probs[i], ...describe(key) })).sort((a, b) => b.prob - a.prob);

    // Décision : la meilleure race est retenue si elle est assez sûre,
    // OU si elle devance nettement la deuxième (1,5 fois plus probable).
    const best = ranked[0];
    const second = ranked[1] || { prob: 0 };
    const clearWinner = best.prob >= MIN_CONFIDENCE || (best.prob >= 0.15 && best.prob >= second.prob * 1.5);
    let kind = 'breed';
    if (best.domestic) kind = 'domestic';
    else if (!clearWinner) kind = 'mixed';

    return {
      kind,
      families,
      top: ranked.slice(0, 3),
      // Pistes : les races les plus proches (sans le "chat de gouttière")
      hints: ranked.filter((r) => !r.domestic).slice(0, 3),
      ms: Math.round(performance.now() - t0)
    };
  }

  // Pose la photo entière au milieu d'un carré gris neutre (la couleur moyenne vue par CLIP)
  async function squareWithBorders(blob) {
    const bitmap = await createImageBitmap(blob);
    const size = Math.max(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgb(122,116,104)';
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(bitmap, (size - bitmap.width) / 2, (size - bitmap.height) / 2);
    bitmap.close();
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
  }

  // Transforme une clé ("breed:persan") en objet lisible
  function describe(key) {
    if (key.startsWith('breed:')) {
      const breed = AF.BREEDS.find((b) => 'breed:' + b.id === key);
      return { name: breed.name, breed };
    }
    const d = key === 'domestic:long' ? AF.DOMESTIC.long : AF.DOMESTIC.short;
    return { name: d.name, domestic: true };
  }
})(self.AF);
