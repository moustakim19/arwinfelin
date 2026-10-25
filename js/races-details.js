/* =====================================================================
   races-details.js — Plus de détails sur chaque race
   ---------------------------------------------------------------------
   Pour chaque race (par son id) :
     [poids min, poids max (kg), vie min, vie max (ans), taille,
      énergie, affection, entretien, bavardage (notes de 1 à 5),
      petite histoire]
   Ce sont des valeurs habituelles pour la race : chaque chat est unique !
   La photo de chaque race est dans images/races/<id>.jpg, et ses crédits
   (auteur, licence) dans data/races-photos.json.
   ===================================================================== */

(function (AF) {
  'use strict';

  const D = {
    'abyssin': [3, 5, 12, 15, 'Moyen', 5, 4, 1, 2, "Une des plus anciennes races connues, au pelage « tiqueté » qui rappelle les chats des fresques égyptiennes. Elle a été développée au Royaume-Uni au XIXe siècle."],
    'american-bobtail': [3, 7, 13, 15, 'Moyen à grand', 3, 5, 2, 2, "Née dans les années 1960 aux États-Unis d'un chat errant à queue courte. Sa queue naturellement écourtée est sa signature."],
    'american-curl': [2.5, 5, 12, 16, 'Moyen', 4, 5, 2, 2, "Tout commence en 1981 en Californie avec Shulamith, une chatte errante aux oreilles recourbées vers l'arrière."],
    'american-shorthair': [3.5, 7, 15, 17, 'Moyen à grand', 3, 4, 1, 2, "Descendant des chats arrivés avec les colons européens, réputés pour chasser les souris sur les navires et dans les fermes."],
    'american-wirehair': [3.5, 6, 14, 18, 'Moyen', 3, 4, 1, 2, "Apparu en 1966 dans une ferme de l'État de New York : un chaton au poil dur et frisé, issu d'une mutation spontanée."],
    'arabian-mau': [3.5, 7, 12, 14, 'Moyen', 4, 4, 1, 3, "Chat du désert de la péninsule arabique, adapté à la chaleur, reconnu officiellement en 2008."],
    'asian': [4, 7, 12, 16, 'Moyen', 4, 5, 1, 3, "Groupe de races britannique né de croisements entre Burmese et Persan Chinchilla dans les années 1980."],
    'australian-mist': [3.5, 6, 14, 16, 'Moyen', 3, 5, 1, 2, "Première race créée en Australie (1976), à partir de Burmese, d'Abyssins et de chats de gouttière."],
    'balinais': [2.5, 5, 15, 20, 'Moyen', 4, 5, 2, 5, "Version à poil mi-long du Siamois, apparue aux États-Unis. Son nom évoque la grâce des danseurs de Bali."],
    'bambino': [2, 4, 12, 14, 'Petit', 4, 5, 3, 2, "Croisement récent (2005) entre Sphynx et Munchkin : sans poil et aux pattes courtes. Toutes les fédérations ne le reconnaissent pas."],
    'bengal': [4, 7, 12, 16, 'Moyen à grand', 5, 4, 1, 4, "Issu de croisements entre chats domestiques et chats-léopards du Bengale dans les années 1970-1980, pour son pelage de petit léopard."],
    'bleu-russe': [3, 5.5, 15, 20, 'Moyen', 3, 4, 2, 1, "Venu du port d'Arkhangelsk, en Russie, il aurait été amené en Angleterre par des marins au XIXe siècle."],
    'bobtail-kouriles': [3, 7, 15, 20, 'Moyen à grand', 3, 4, 2, 2, "Originaire des îles Kouriles, entre la Russie et le Japon. Sa queue courte forme un petit pompon."],
    'bombay': [3, 5, 15, 20, 'Moyen', 4, 5, 1, 3, "Créé dans les années 1950 aux États-Unis en croisant Burmese et American Shorthair noir, pour obtenir une « mini-panthère »."],
    'british-longhair': [4, 8, 12, 17, 'Grand', 2, 4, 3, 1, "Cousin à poil mi-long du British Shorthair, longtemps considéré comme une simple variété."],
    'british-shorthair': [4, 8, 12, 17, 'Grand', 2, 4, 2, 1, "Un des plus anciens chats anglais. On dit qu'il a inspiré le chat du Cheshire d'Alice au pays des merveilles."],
    'burmese': [3, 6, 15, 18, 'Moyen', 4, 5, 1, 4, "Toutes ses lignées remontent à Wong Mau, une chatte ramenée de Birmanie aux États-Unis en 1930."],
    'burmilla': [3, 6, 13, 15, 'Moyen', 3, 5, 1, 2, "Né par accident en 1981 en Angleterre, d'un Persan Chinchilla et d'une Burmese lilas."],
    'chantilly': [3, 5.5, 14, 16, 'Moyen', 3, 5, 3, 3, "Race américaine rare, d'abord appelée « Foreign Longhair », au pelage soyeux sans sous-poil."],
    'chartreux': [4, 7.5, 12, 15, 'Grand', 2, 4, 2, 1, "Le chat bleu de France, connu depuis le XVIe siècle. La légende dit que les moines chartreux l'élevaient."],
    'chausie': [5, 10, 12, 15, 'Grand', 5, 3, 1, 3, "Hybride entre chat domestique et chat des marais (Felis chaus), développé dans les années 1990."],
    'cornish-rex': [2.5, 4.5, 11, 15, 'Petit à moyen', 5, 5, 1, 3, "Né en Cornouailles en 1950 : le chaton Kallibunker avait un poil tout frisé, très doux."],
    'cymric': [3.5, 6, 14, 16, 'Moyen', 3, 4, 3, 2, "Version à poil mi-long du Manx. Son nom vient de « Cymru », le Pays de Galles en gallois."],
    'devon-rex': [2.5, 4.5, 9, 15, 'Petit à moyen', 5, 5, 1, 2, "Découvert en 1960 dans le Devon (Angleterre). Avec ses grandes oreilles, on le surnomme le chat « lutin »."],
    'donskoy': [3, 7, 12, 15, 'Moyen', 4, 5, 3, 3, "Apparu en 1987 à Rostov-sur-le-Don (Russie). Son absence de poil vient d'un gène différent de celui du Sphynx."],
    'dragon-li': [4, 6, 12, 15, 'Moyen', 4, 3, 1, 2, "Chat naturel de Chine, au pelage tigré brun, reconnu par la CFA en 2010."],
    'europeen': [3.5, 7, 15, 20, 'Moyen', 3, 4, 1, 2, "Version « de race » du chat de gouttière européen, sélectionnée pour garder son allure naturelle et robuste."],
    'exotic-shorthair': [3, 6.5, 12, 15, 'Moyen', 2, 5, 2, 1, "Créé aux États-Unis dans les années 1960 en croisant Persan et American Shorthair : un Persan sans les longs poils."],
    'german-rex': [3, 4.5, 12, 16, 'Moyen', 4, 5, 1, 2, "Premier chat rex connu, découvert à Berlin vers 1951 : la chatte Lämmchen (« petit agneau »)."],
    'havana': [3, 4.5, 12, 15, 'Moyen', 3, 5, 1, 2, "Créé au Royaume-Uni dans les années 1950. Sa couleur chocolat rappelle les cigares de La Havane."],
    'highland-fold': [3, 6, 11, 15, 'Moyen', 3, 4, 3, 1, "Version à poil mi-long du Scottish Fold. Le gène des oreilles pliées cause des problèmes articulaires : son élevage est controversé."],
    'himalayen': [3.5, 6, 12, 15, 'Moyen', 1, 5, 5, 1, "Créé dans les années 1950 en croisant Persan et Siamois : un Persan aux couleurs « colourpoint » et aux yeux bleus."],
    'japanese-bobtail': [2.5, 4.5, 15, 18, 'Moyen', 4, 4, 1, 4, "Présent au Japon depuis des siècles, c'est lui qui a inspiré le Maneki-neko, le chat porte-bonheur qui fait signe de la patte."],
    'khao-manee': [3, 5, 10, 12, 'Moyen', 4, 5, 1, 4, "Chat blanc de Thaïlande cité dans d'anciens manuscrits, souvent aux yeux de deux couleurs différentes."],
    'korat': [2.5, 4.5, 15, 20, 'Petit à moyen', 3, 5, 1, 2, "Chat porte-bonheur en Thaïlande, offert traditionnellement aux jeunes mariés. Il est toujours bleu argenté."],
    'laperm': [3, 5, 12, 15, 'Moyen', 3, 5, 2, 2, "Né en 1982 dans un verger de l'Oregon : la chatte Curly, au pelage bouclé comme une « permanente »."],
    'lykoi': [2.5, 5.5, 12, 15, 'Moyen', 4, 4, 2, 2, "Issu d'une mutation naturelle découverte vers 2010. Son poil clairsemé lui donne l'air d'un petit loup-garou."],
    'maine-coon': [5, 11, 12, 15, 'Très grand', 3, 5, 3, 2, "Chat de ferme du Maine (États-Unis), adapté aux hivers rudes : grandes pattes, queue touffue, oreilles à houppes."],
    'manx': [3.5, 6, 14, 16, 'Moyen', 3, 4, 2, 2, "Originaire de l'île de Man, entre l'Angleterre et l'Irlande. L'absence de queue vient d'un gène naturel."],
    'mau-egyptien': [3, 5, 12, 15, 'Moyen', 5, 4, 1, 3, "Seule race domestique naturellement tachetée, et l'un des chats les plus rapides (près de 50 km/h en pointe)."],
    'mekong-bobtail': [3, 4.5, 15, 18, 'Moyen', 4, 5, 1, 3, "Chat à queue courte d'Asie du Sud-Est, standardisé en Russie et reconnu par la FIFe en 2004."],
    'minuet': [2, 4, 12, 15, 'Petit', 3, 5, 4, 1, "Croisement entre Persan et Munchkin (anciennement « Napoléon ») : un visage de Persan sur des pattes courtes."],
    'munchkin': [2, 4, 12, 15, 'Petit', 4, 4, 2, 2, "Ses pattes courtes viennent d'une mutation naturelle découverte en Louisiane en 1983. Race controversée, refusée par la FIFe."],
    'nebelung': [3, 5.5, 15, 18, 'Moyen', 3, 4, 3, 1, "Son nom veut dire « créature du brouillard » en allemand. Créé aux États-Unis en 1984, comme un Bleu russe à poil mi-long."],
    'neva-masquerade': [4, 9, 12, 15, 'Grand', 3, 5, 3, 2, "Variante colourpoint du Sibérien, développée à Saint-Pétersbourg, au bord de la Neva."],
    'norvegien': [4, 9, 14, 16, 'Grand', 3, 4, 3, 2, "Le « chat des forêts » des légendes nordiques. Sa fourrure imperméable le protège du froid scandinave."],
    'ocicat': [3, 7, 15, 18, 'Moyen à grand', 4, 5, 1, 3, "Né par hasard en 1964 aux États-Unis (Siamois × Abyssin). Il ressemble à un petit ocelot, sans aucun sang sauvage."],
    'oriental-longhair': [2.5, 5, 12, 15, 'Moyen', 5, 5, 2, 5, "Oriental à poil mi-long, parfois appelé Mandarin : cousin du Balinais, mais dans toutes les couleurs."],
    'oriental': [2.5, 5, 12, 15, 'Moyen', 5, 5, 1, 5, "Cousin du Siamois existant dans plus de 300 couleurs, créé au Royaume-Uni dans les années 1950."],
    'persan': [3, 6, 12, 15, 'Moyen', 1, 4, 5, 1, "Une des races les plus anciennes et populaires, arrivée de Perse (l'Iran actuel) en Europe au XVIIe siècle."],
    'peterbald': [3, 5, 12, 15, 'Moyen', 4, 5, 3, 4, "Créé à Saint-Pétersbourg en 1994 en croisant Donskoy et Oriental. Il peut être totalement nu ou avoir un léger duvet."],
    'pixie-bob': [4, 8, 13, 15, 'Grand', 3, 5, 2, 1, "Créé aux États-Unis dans les années 1980 pour ressembler à un petit lynx roux. Souvent polydactyle (doigts en plus)."],
    'ragamuffin': [4.5, 9, 12, 16, 'Grand', 2, 5, 3, 2, "Issu du Ragdoll dans les années 1990, il est accepté dans beaucoup plus de couleurs."],
    'ragdoll': [4.5, 9, 12, 17, 'Grand', 2, 5, 3, 1, "Créé en Californie dans les années 1960. Son nom (« poupée de chiffon ») vient de sa façon de se détendre quand on le porte."],
    'sacre-birmanie': [3, 6, 12, 16, 'Moyen', 3, 5, 3, 2, "Selon la légende, gardien de temples birmans. Développé en France dans les années 1920, il porte quatre « gants » blancs."],
    'savannah': [5, 11, 12, 20, 'Très grand', 5, 4, 1, 3, "Hybride entre chat domestique et serval africain (années 1980). En France, les premières générations sont réglementées."],
    'scottish-fold': [3, 6, 11, 15, 'Moyen', 3, 4, 2, 1, "Né en Écosse en 1961 avec Susie, aux oreilles pliées. Le gène responsable cause des maladies des os : la FIFe refuse la race."],
    'selkirk-rex': [3, 7, 15, 20, 'Moyen à grand', 3, 5, 3, 2, "Né en 1987 dans le Montana : la chatte Miss DePesto, au poil bouclé comme celui d'un mouton."],
    'serengeti': [4, 7, 12, 15, 'Moyen à grand', 5, 4, 1, 4, "Créé en Californie dans les années 1990 (Bengal × Oriental) pour ressembler au serval, sans sang sauvage."],
    'siamois': [2.5, 5, 15, 20, 'Moyen', 5, 5, 1, 5, "Chat sacré du royaume de Siam (la Thaïlande), arrivé en Europe à la fin du XIXe siècle. Célèbre pour ses yeux bleus et son « masque »."],
    'siberien': [4, 9, 12, 18, 'Grand', 4, 5, 3, 2, "Chat national russe, habitué aux hivers sibériens. On dit qu'il provoque moins d'allergies, mais ce n'est pas garanti."],
    'singapura': [2, 4, 12, 15, 'Petit', 5, 5, 1, 2, "Une des plus petites races de chats, venue de Singapour dans les années 1970."],
    'snowshoe': [3, 5.5, 14, 19, 'Moyen', 4, 5, 1, 4, "Créé aux États-Unis dans les années 1960 (Siamois × American Shorthair bicolore). Ses pattes blanches font penser à des chaussons."],
    'sokoke': [3, 5, 12, 16, 'Moyen', 5, 3, 1, 3, "Chat naturel de la forêt d'Arabuko-Sokoke, au Kenya, découvert dans les années 1970."],
    'somali': [3, 5, 12, 16, 'Moyen', 5, 5, 2, 2, "Version à poil mi-long de l'Abyssin. Sa queue touffue lui vaut le surnom de « chat renard »."],
    'sphynx': [3, 5.5, 12, 15, 'Moyen', 4, 5, 4, 3, "Né au Canada en 1966 d'une mutation naturelle. Sa peau est douce comme une pêche et chaude au toucher."],
    'thai': [3, 5, 15, 20, 'Moyen', 5, 5, 1, 5, "Le Siamois « traditionnel », à la tête plus ronde, tel qu'il existait avant les sélections modernes."],
    'tonkinois': [3, 5.5, 15, 18, 'Moyen', 4, 5, 1, 3, "Croisement entre Siamois et Burmese, créé au Canada dans les années 1960. Ses yeux sont couleur aigue-marine."],
    'toyger': [3, 6.5, 10, 15, 'Moyen', 4, 4, 1, 2, "Son nom vient de « toy tiger » : créé aux États-Unis dans les années 1980 pour ressembler à un petit tigre."],
    'angora-turc': [2.5, 5, 12, 18, 'Moyen', 4, 4, 2, 3, "Une des plus anciennes races, originaire d'Ankara (Turquie). Le zoo d'Ankara protège sa lignée blanche."],
    'turc-van': [3, 8, 12, 17, 'Grand', 4, 4, 2, 3, "Originaire de la région du lac de Van (Turquie), il est surnommé le « chat nageur » car il adore l'eau."],
    'levkoy': [3, 5.5, 12, 15, 'Moyen', 3, 5, 3, 2, "Créé en Ukraine au début des années 2000 (Donskoy × Scottish Fold) : sans poil et aux oreilles pliées. Peu reconnu."]
  };

  // On ajoute ces détails à chaque race de races.js
  for (const breed of AF.BREEDS) {
    const d = D[breed.id];
    if (!d) continue;
    const [wMin, wMax, lMin, lMax, size, energy, affection, grooming, vocal, history] = d;
    Object.assign(breed, {
      weight: [wMin, wMax], life: [lMin, lMax], size,
      ratings: { energy, affection, grooming, vocal },
      history,
      photo: 'images/races/' + breed.id + '.jpg'
    });
  }

  // Les crédits des photos (chargés seulement quand on en a besoin)
  let creditsPromise = null;
  AF.getBreedPhotoCredits = function () {
    if (!creditsPromise) creditsPromise = fetch('data/races-photos.json').then((r) => r.json()).catch(() => ({}));
    return creditsPromise;
  };

  // Petites étiquettes "idéal pour…" calculées à partir des notes
  AF.breedTags = function (b) {
    if (!b.ratings) return [];
    const r = b.ratings;
    const tags = [];
    if (r.energy >= 5) tags.push('⚡ Très sportif');
    else if (r.energy <= 2) tags.push('🛋️ Calme, idéal en appartement');
    if (r.affection >= 5) tags.push('🥰 Très câlin');
    if (r.vocal >= 4) tags.push('🗣️ Bavard');
    else if (r.vocal <= 1) tags.push('🤫 Discret');
    if (r.grooming >= 4) tags.push('✂️ Entretien exigeant');
    else if (r.grooming <= 1) tags.push('✨ Peu d’entretien');
    return tags;
  };
})(self.AF);
