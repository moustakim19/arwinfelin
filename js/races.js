/* =====================================================================
   races.js — Les races de chats reconnues (d'après TICA, CFA et FIFe)
   ---------------------------------------------------------------------
   Pour chaque race :
     id        identifiant interne
     name      nom en français
     en        nom anglais, utilisé dans la phrase donnée à l'IA :
               "a photo of a <en> cat"
     hair      type de poil : 'short' (court), 'semi' (mi-long),
               'long' (long), 'hairless' (sans poil)
     origin    pays d'origine
     character caractère
     care      entretien
     health    santé à surveiller (tendances de la race, pas une fatalité)
   ===================================================================== */

(function (AF) {
  'use strict';

  AF.HAIR_TYPES = {
    short: 'Poil court',
    semi: 'Poil mi-long',
    long: 'Poil long',
    hairless: 'Sans poil'
  };

  // [id, nom, anglais, poil, origine, caractère, entretien, santé]
  const DATA = [
    ['abyssin', 'Abyssin', 'Abyssinian', 'short', 'Éthiopie / Royaume-Uni', 'Très actif, curieux et joueur, il adore grimper et explorer.', 'Brossage hebdomadaire ; beaucoup de jeux et de hauteur.', 'Déficit en pyruvate kinase, amyloïdose rénale, gingivite.'],
    ['american-bobtail', 'American Bobtail', 'American Bobtail', 'semi', 'États-Unis', 'Sociable, intelligent et attaché à sa famille, parfois « chien-chat ».', 'Brossage une à deux fois par semaine.', 'Race robuste ; surveiller le dos et la queue courte.'],
    ['american-curl', 'American Curl', 'American Curl', 'short', 'États-Unis', 'Joueur toute sa vie, affectueux et très sociable.', 'Brossage hebdomadaire ; nettoyer doucement les oreilles recourbées.', 'Cartilage des oreilles fragile ; otites possibles.'],
    ['american-shorthair', 'American Shorthair', 'American Shorthair', 'short', 'États-Unis', 'Calme, équilibré et facile à vivre, bon chasseur.', 'Brossage hebdomadaire ; attention au surpoids.', 'Cardiomyopathie hypertrophique (CMH), embonpoint.'],
    ['american-wirehair', 'American Wirehair', 'American Wirehair', 'short', 'États-Unis', 'Doux, calme et affectueux, peu exigeant.', 'Ne pas trop brosser le poil frisé et dur ; bains rares.', 'Peau parfois sensible (dermatites).'],
    ['arabian-mau', 'Mau arabe', 'Arabian Mau', 'short', 'Péninsule arabique', 'Actif, loyal et très attaché à ses humains.', "Poil court sans sous-poil : un coup de gant suffit.", 'Race naturelle robuste.'],
    ['asian', 'Asian', 'Asian Shorthair', 'short', 'Royaume-Uni', 'Sociable, bavard modéré et très proche de ses humains.', 'Brossage léger hebdomadaire.', 'Proche du Burmese : hypokaliémie, diabète possibles.'],
    ['australian-mist', 'Australian Mist', 'Australian Mist', 'short', 'Australie', "Doux, tolérant et câlin, idéal en appartement.", 'Brossage léger hebdomadaire.', 'Race robuste ; surveiller le poids.'],
    ['balinais', 'Balinais', 'Balinese', 'semi', 'États-Unis', 'Bavard, intelligent et très affectueux, comme le Siamois.', 'Poil mi-long sans sous-poil : brossage hebdomadaire.', 'Comme le Siamois : amyloïdose, atrophie rétinienne, asthme.'],
    ['bambino', 'Bambino', 'Bambino', 'hairless', 'États-Unis', 'Joueur, affectueux et très sociable.', 'Bain régulier, protection du froid et du soleil.', 'Pattes courtes (dos, articulations) ; peau fragile.'],
    ['bengal', 'Bengal', 'Bengal', 'short', 'États-Unis', "Très actif, intelligent, adore l'eau et les jeux de chasse.", 'Brossage léger ; besoin de beaucoup d’activité.', 'Déficit en pyruvate kinase, atrophie rétinienne (PRA-b), CMH.'],
    ['bleu-russe', 'Bleu russe', 'Russian Blue', 'short', 'Russie', 'Discret, doux et fidèle, un peu réservé avec les inconnus.', 'Brossage hebdomadaire du double poil dense.', 'Race robuste ; tendance à la gourmandise.'],
    ['bobtail-kouriles', 'Bobtail des Kouriles', 'Kurilian Bobtail', 'semi', 'Russie (îles Kouriles)', 'Calme, intelligent et bon chasseur, aime l’eau.', 'Brossage hebdomadaire.', 'Race naturelle robuste.'],
    ['bombay', 'Bombay', 'Bombay', 'short', 'États-Unis', 'Affectueux, joueur et très attaché, il suit ses humains partout.', 'Coup de gant pour faire briller le poil noir.', 'Malformations craniofaciales possibles, gingivite.'],
    ['british-longhair', 'British Longhair', 'British Longhair', 'semi', 'Royaume-Uni', 'Calme, posé et indépendant, comme le British Shorthair.', 'Brossage deux fois par semaine.', 'CMH, polykystose rénale (PKD).'],
    ['british-shorthair', 'British Shorthair', 'British Shorthair', 'short', 'Royaume-Uni', 'Placide, indépendant mais affectueux, aime le calme.', 'Brossage hebdomadaire ; attention au surpoids.', 'CMH, polykystose rénale (PKD), embonpoint.'],
    ['burmese', 'Burmese', 'Burmese', 'short', 'Birmanie / États-Unis', 'Très sociable, joueur et bavard, il déteste la solitude.', 'Coup de gant hebdomadaire.', 'Hypokaliémie, diabète, syndrome de douleur orofaciale.'],
    ['burmilla', 'Burmilla', 'Burmilla', 'short', 'Royaume-Uni', 'Doux, joueur et sociable, très adaptable.', 'Brossage hebdomadaire.', 'Polykystose rénale dans certaines lignées.'],
    ['chantilly', 'Chantilly-Tiffany', 'Chantilly-Tiffany', 'semi', 'États-Unis', 'Doux, calme et bavard à voix douce.', 'Brossage deux fois par semaine.', 'Race robuste ; surveiller la digestion.'],
    ['chartreux', 'Chartreux', 'Chartreux', 'short', 'France', 'Calme, fidèle et discret, très attaché à son humain préféré.', 'Brossage hebdomadaire du poil laineux, plus en période de mue.', 'Luxation de la rotule, tendance au surpoids.'],
    ['chausie', 'Chausie', 'Chausie', 'short', 'États-Unis', 'Très actif, athlétique et curieux, a besoin de stimulation.', 'Brossage léger ; beaucoup d’espace et de jeux.', 'Hybride : digestion parfois sensible.'],
    ['cornish-rex', 'Cornish Rex', 'Cornish Rex', 'short', 'Royaume-Uni', 'Très joueur, acrobate et très affectueux.', 'Poil frisé fragile : pas de brosse dure, bains occasionnels.', 'Frilosité, peau grasse.'],
    ['cymric', 'Cymric', 'Cymric', 'semi', 'Île de Man / Canada', 'Joueur, intelligent et très attaché à sa famille.', 'Brossage deux fois par semaine.', 'Syndrome du Manx (colonne vertébrale, sans queue).'],
    ['devon-rex', 'Devon Rex', 'Devon Rex', 'short', 'Royaume-Uni', 'Espiègle, joueur et très câlin, aime les épaules.', 'Bains occasionnels, nettoyer les grandes oreilles.', 'Myopathie héréditaire (CMS), peau grasse.'],
    ['donskoy', 'Donskoy', 'Donskoy', 'hairless', 'Russie', 'Très affectueux, sociable et intelligent.', 'Bain régulier, protection du froid et du soleil.', 'Peau fragile (acné, coups de soleil), dentition.'],
    ['dragon-li', 'Dragon Li', 'Dragon Li', 'short', 'Chine', 'Indépendant, intelligent et loyal.', 'Coup de gant hebdomadaire.', 'Race naturelle robuste.'],
    ['europeen', 'Européen', 'European Shorthair', 'short', 'Europe', 'Équilibré, bon chasseur et affectueux.', 'Brossage hebdomadaire.', 'Race robuste.'],
    ['exotic-shorthair', 'Exotic Shorthair', 'Exotic Shorthair', 'short', 'États-Unis', 'Calme, doux et câlin, comme un Persan à poil court.', 'Brossage hebdomadaire, nettoyer les yeux.', 'Polykystose rénale, difficultés respiratoires (face plate), larmoiement.'],
    ['german-rex', 'German Rex', 'German Rex', 'short', 'Allemagne', 'Affectueux, joueur et sociable.', 'Poil frisé délicat : brossage très doux.', 'Race plutôt robuste ; frilosité.'],
    ['havana', 'Havana Brown', 'Havana Brown', 'short', 'Royaume-Uni', 'Curieux, doux et très attaché à ses humains.', 'Coup de gant hebdomadaire.', 'Race plutôt robuste ; gingivite.'],
    ['highland-fold', 'Highland Fold', 'Highland Fold', 'semi', 'Écosse', 'Calme, doux et sociable.', 'Brossage deux fois par semaine.', 'Ostéochondrodysplasie (douleurs articulaires) liée aux oreilles pliées.'],
    ['himalayen', 'Himalayen', 'Himalayan', 'long', 'États-Unis / Royaume-Uni', 'Très doux, calme et câlin.', 'Brossage quotidien indispensable, nettoyage des yeux.', 'Comme le Persan : PKD, respiration, larmoiement.'],
    ['japanese-bobtail', 'Bobtail japonais', 'Japanese Bobtail', 'short', 'Japon', 'Actif, joueur et bavard, très sociable.', 'Brossage hebdomadaire.', 'Race robuste.'],
    ['khao-manee', 'Khao Manee', 'Khao Manee', 'short', 'Thaïlande', 'Joueur, bavard et très affectueux.', 'Coup de gant hebdomadaire.', 'Surdité possible chez les chats blancs.'],
    ['korat', 'Korat', 'Korat', 'short', 'Thaïlande', 'Doux, intelligent et attaché, n’aime pas les bruits forts.', 'Coup de gant hebdomadaire.', 'Gangliosidoses (GM1, GM2) dans certaines lignées.'],
    ['laperm', 'LaPerm', 'LaPerm', 'semi', 'États-Unis', 'Câlin, curieux et joueur.', 'Brossage doux hebdomadaire des boucles.', 'Race robuste.'],
    ['lykoi', 'Lykoi', 'Lykoi', 'short', 'États-Unis', 'Joueur, curieux et sociable, au look de « petit loup ».', 'Poil clairsemé : protéger du soleil, bains occasionnels.', 'Peau sensible ; mues irrégulières.'],
    ['maine-coon', 'Maine Coon', 'Maine Coon', 'semi', 'États-Unis', 'Doux géant, sociable et joueur, très patient.', 'Brossage deux fois par semaine, alimentation adaptée à sa taille.', 'CMH, dysplasie de la hanche, amyotrophie spinale (SMA).'],
    ['manx', 'Manx', 'Manx', 'short', 'Île de Man', 'Joueur, intelligent et fidèle.', 'Brossage hebdomadaire.', 'Syndrome du Manx (malformations de la colonne).'],
    ['mau-egyptien', 'Mau égyptien', 'Egyptian Mau', 'short', 'Égypte', 'Très rapide, actif et fidèle, un peu sensible au stress.', 'Coup de gant hebdomadaire.', 'Race plutôt robuste ; sensible au stress.'],
    ['mekong-bobtail', 'Mekong Bobtail', 'Mekong Bobtail', 'short', 'Asie du Sud-Est / Russie', 'Sociable, affectueux et curieux.', 'Coup de gant hebdomadaire.', 'Race robuste.'],
    ['minuet', 'Minuet (Napoléon)', 'Minuet', 'semi', 'États-Unis', 'Doux, joueur et affectueux.', 'Brossage deux à trois fois par semaine.', 'Pattes courtes : dos et articulations ; comme le Persan pour la face.'],
    ['munchkin', 'Munchkin', 'Munchkin', 'short', 'États-Unis', 'Joueur, curieux et sociable malgré ses pattes courtes.', 'Brossage hebdomadaire ; éviter les sauts trop hauts.', 'Lordose, arthrose précoce.'],
    ['nebelung', 'Nebelung', 'Nebelung', 'semi', 'États-Unis', 'Calme, réservé avec les inconnus, très fidèle.', 'Brossage hebdomadaire.', 'Race robuste.'],
    ['neva-masquerade', 'Neva Masquerade', 'Neva Masquerade', 'semi', 'Russie', 'Doux, sociable et calme, version colourpoint du Sibérien.', 'Brossage deux fois par semaine, plus en mue.', 'CMH.'],
    ['norvegien', 'Norvégien', 'Norwegian Forest', 'semi', 'Norvège', 'Calme, sociable et grimpeur, aime l’extérieur.', 'Brossage hebdomadaire, plus pendant la grosse mue de printemps.', 'Glycogénose de type IV (GSD IV), CMH.'],
    ['ocicat', 'Ocicat', 'Ocicat', 'short', 'États-Unis', 'Actif, sociable et facile à éduquer.', 'Coup de gant hebdomadaire.', 'Race robuste.'],
    ['oriental-longhair', 'Oriental à poil mi-long (Mandarin)', 'Oriental Longhair', 'semi', 'Royaume-Uni', 'Bavard, très attaché et démonstratif.', 'Brossage hebdomadaire.', 'Comme le Siamois : amyloïdose, PRA.'],
    ['oriental', 'Oriental', 'Oriental Shorthair', 'short', 'Royaume-Uni', 'Très bavard, joueur et exclusif, déteste être seul.', 'Coup de gant hebdomadaire.', 'Amyloïdose, atrophie rétinienne, problèmes dentaires.'],
    ['persan', 'Persan', 'Persian', 'long', 'Iran / Royaume-Uni', 'Calme, doux et casanier.', 'Brossage quotidien, nettoyage des yeux chaque jour.', 'Polykystose rénale (PKD), respiration difficile, larmoiement.'],
    ['peterbald', 'Peterbald', 'Peterbald', 'hairless', 'Russie', 'Affectueux, bavard et sociable.', 'Bain régulier, protection du froid et du soleil.', 'Peau fragile ; dentition.'],
    ['pixie-bob', 'Pixie-bob', 'Pixie-bob', 'short', 'États-Unis', 'Calme, très attaché, souvent comparé à un chien.', 'Brossage hebdomadaire.', 'Polydactylie fréquente, cryptorchidie.'],
    ['ragamuffin', 'RagaMuffin', 'Ragamuffin', 'semi', 'États-Unis', 'Très doux, câlin et calme.', 'Brossage deux fois par semaine ; surveiller le poids.', 'CMH, embonpoint.'],
    ['ragdoll', 'Ragdoll', 'Ragdoll', 'semi', 'États-Unis', 'Très doux et calme, se laisse porter comme une poupée de chiffon.', 'Brossage deux fois par semaine.', 'CMH, calculs urinaires.'],
    ['sacre-birmanie', 'Sacré de Birmanie', 'Birman', 'semi', 'Birmanie / France', 'Doux, calme et affectueux, aux « gants » blancs.', 'Brossage deux fois par semaine.', 'Maladies rénales, CMH.'],
    ['savannah', 'Savannah', 'Savannah', 'short', 'États-Unis', 'Très actif, curieux et sauteur, a besoin de beaucoup d’espace.', 'Brossage léger ; enrichissement indispensable.', 'Hybride : se renseigner sur la réglementation des premières générations.'],
    ['scottish-fold', 'Scottish Fold', 'Scottish Fold', 'short', 'Écosse', 'Calme, doux et sociable.', 'Brossage hebdomadaire, nettoyer les oreilles pliées.', 'Ostéochondrodysplasie (douleurs articulaires) liée aux oreilles pliées.'],
    ['selkirk-rex', 'Selkirk Rex', 'Selkirk Rex', 'semi', 'États-Unis', 'Patient, câlin et tolérant.', 'Brossage doux des boucles, bains occasionnels.', 'Polykystose rénale, CMH.'],
    ['serengeti', 'Serengeti', 'Serengeti', 'short', 'États-Unis', 'Actif, bavard et confiant.', 'Coup de gant hebdomadaire.', 'Race robuste.'],
    ['siamois', 'Siamois', 'Siamese', 'short', 'Thaïlande', 'Très bavard, intelligent et exclusif.', 'Coup de gant hebdomadaire.', 'Amyloïdose, atrophie rétinienne, asthme.'],
    ['siberien', 'Sibérien', 'Siberian', 'semi', 'Russie', 'Sociable, joueur et robuste, aime l’eau.', 'Brossage hebdomadaire, plus en mue.', 'CMH.'],
    ['singapura', 'Singapura', 'Singapura', 'short', 'Singapour', 'Curieux, joueur et collé à ses humains.', 'Coup de gant hebdomadaire.', 'Déficit en pyruvate kinase.'],
    ['snowshoe', 'Snowshoe', 'Snowshoe', 'short', 'États-Unis', 'Sociable, bavard et affectueux.', 'Brossage hebdomadaire.', 'Race robuste.'],
    ['sokoke', 'Sokoké', 'Sokoke', 'short', 'Kenya', 'Actif, agile et indépendant.', 'Coup de gant hebdomadaire.', 'Race naturelle robuste.'],
    ['somali', 'Somali', 'Somali', 'semi', 'États-Unis / Canada', 'Très actif, joueur et curieux, comme l’Abyssin.', 'Brossage hebdomadaire.', 'Déficit en pyruvate kinase, amyloïdose rénale.'],
    ['sphynx', 'Sphynx', 'Sphynx', 'hairless', 'Canada', 'Très affectueux, sociable et pot de colle.', 'Bain régulier (peau grasse), protection du froid et du soleil.', 'CMH, peau fragile.'],
    ['thai', 'Thaï', 'Thai', 'short', 'Thaïlande', 'Bavard, joueur et très attaché, Siamois « à l’ancienne ».', 'Coup de gant hebdomadaire.', 'Plus robuste que le Siamois moderne.'],
    ['tonkinois', 'Tonkinois', 'Tonkinese', 'short', 'Canada / États-Unis', 'Sociable, joueur et bavard.', 'Coup de gant hebdomadaire.', 'Gingivite, problèmes dentaires.'],
    ['toyger', 'Toyger', 'Toyger', 'short', 'États-Unis', 'Calme, joueur et facile à vivre, au look de petit tigre.', 'Coup de gant hebdomadaire.', 'Souffle cardiaque possible.'],
    ['angora-turc', 'Angora turc', 'Turkish Angora', 'semi', 'Turquie', 'Vif, intelligent et joueur.', 'Brossage hebdomadaire (pas de sous-poil).', 'Surdité chez les blancs aux yeux bleus, ataxie héréditaire.'],
    ['turc-van', 'Turc de Van', 'Turkish Van', 'semi', 'Turquie', 'Actif, joueur et passionné par l’eau.', 'Brossage hebdomadaire.', 'Race robuste.'],
    ['levkoy', 'Levkoy ukrainien', 'Ukrainian Levkoy', 'hairless', 'Ukraine', 'Doux, sociable et intelligent.', 'Bain régulier, protection du froid et du soleil.', 'Peau fragile ; oreilles pliées (articulations).']
  ];

  AF.BREEDS = DATA.map(([id, name, en, hair, origin, character, care, health]) => ({
    id, name, en, hair, origin, character, care, health,
    prompt: 'a photo of a ' + en + ' cat'
  })).sort((a, b) => a.name.localeCompare(b.name, 'fr'));

  // Les catégories "non-race" utilisées par l'IA
  AF.DOMESTIC = {
    short: {
      id: 'gouttiere-court', name: 'Chat de gouttière à poil court', hair: 'short',
      prompt: 'a photo of a domestic short-haired cat',
      // Autres façons de le dire, pour aider l'IA (la plupart des chats de gouttière sont tigrés, noirs, bicolores…)
      extra: ['a photo of a mixed-breed short-haired house cat', 'a photo of a tabby house cat', 'a photo of an ordinary alley cat']
    },
    long: {
      id: 'gouttiere-long', name: 'Chat de gouttière à poil long', hair: 'long',
      prompt: 'a photo of a domestic long-haired cat',
      extra: ['a photo of a mixed-breed long-haired house cat', 'a photo of a fluffy alley cat']
    }
  };
  // "Pas un chat" : CLIP comprend mal la négation ("not a cat"),
  // on ajoute donc aussi des exemples concrets de ce qui n'est pas un chat.
  AF.NOT_CAT_PROMPTS = [
    'a photo that is not a cat',
    'a photo of a dog',
    'a photo of a person',
    'a photo of a landscape',
    'a photo of food',
    'a photo of an object',
    'a drawing or a cartoon',
    'a photo of a stuffed animal toy',
    'a photo of a teddy bear',
    'a photo of a rabbit',
    'a photo of a bird',
    'a photo of a wild animal'
  ];

  AF.findBreed = (nameOrId) => AF.BREEDS.find((b) => b.id === nameOrId || b.name.toLowerCase() === String(nameOrId || '').toLowerCase());
})(self.AF);
