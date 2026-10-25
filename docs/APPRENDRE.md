# Apprendre avec ArwinFelin 🐾

Ce guide explique, simplement, les notions utilisées pour construire l'appli.
Chaque étape du projet ajoute une section ici.

---

## 1. Comment l'appli est organisée

```
index.html          la seule page HTML ; JavaScript dessine les écrans dedans
css/style.css       tout le style (couleurs, cartes, boutons…)
js/utils.js         petites fonctions (dates, âge, images…)
js/icons.js         les icônes dessinées en SVG
js/db.js            la base de données IndexedDB
js/ui.js            composants réutilisables (messages, panneaux, photo…)
js/app.js           le routeur : choisit l'écran à afficher selon l'adresse
js/views/*.js       un fichier par écran (accueil, formulaire, fiche…)
```

**Le routeur.** L'appli n'a qu'une seule page. Pour changer d'écran, on change
la fin de l'adresse après le `#` : `#/` pour l'accueil, `#/chat/abc` pour la
fiche du chat « abc ». Le fichier `app.js` écoute l'événement `hashchange` et
affiche l'écran correspondant. Bonus : le bouton « retour » du téléphone
fonctionne tout seul.

**L'objet `AF`.** Toutes nos fonctions sont rangées dans un seul objet global
`AF` (pour ArwinFelin) : `AF.db`, `AF.toast`, `AF.catAge`… Ça évite de mélanger
nos noms avec ceux du navigateur.

**La sécurité avec `AF.esc()`.** Quand on insère un texte tapé par
l'utilisateur dans du HTML, on l'« échappe » : `<` devient `&lt;`, etc. Sans
ça, un nom de chat comme `<img src=x onerror=alert(1)>` exécuterait du code !

---

## 2. IndexedDB, c'est quoi ?

**IndexedDB est une vraie base de données rangée dans le navigateur**, sur le
téléphone de l'utilisateur. Les données restent après la fermeture de l'appli,
sans serveur et sans connexion internet.

### Pourquoi pas localStorage ?

| | localStorage | IndexedDB |
|---|---|---|
| Taille | environ 5 Mo en tout | des centaines de Mo (selon l'espace libre) |
| Ce qu'on peut ranger | du texte seulement | des objets, des nombres, des dates, **des fichiers (photos)** |
| Vitesse | bloque la page pendant la lecture | asynchrone : la page reste fluide |
| Recherche | aucune | des index pour trouver vite |

Une seule photo de téléphone fait 3 à 8 Mo : localStorage serait plein dès la
première photo. Avec IndexedDB, on range directement la photo (un `Blob`, c'est
à dire un fichier binaire) dans la fiche du chat.

### Le vocabulaire

- **Base** (*database*) : ici `arwinfelin`. Une par site.
- **Magasin d'objets** (*object store*) : un « tiroir », comme une table. On a
  `cats` (les chats), `settings` (les réglages), puis d'autres au fil des étapes.
- **Clé** (*keyPath*) : l'identifiant unique de chaque objet. Chez nous, le champ `id`.
- **Index** : un raccourci pour retrouver des objets par un autre champ.
  Exemple : l'index `catId` retrouve tous les vaccins d'un chat sans tout lire.
- **Transaction** : un groupe d'opérations faites d'un bloc. Si une échoue,
  aucune n'est appliquée. Mode `readonly` (lecture) ou `readwrite` (écriture).
- **Version** : un numéro. Quand on l'augmente, le navigateur lance
  `onupgradeneeded`, le seul moment où l'on peut créer des magasins et des index.

### Un exemple

Un chat est rangé tel quel, photo comprise :

```js
{
  id: "8f3c…",            // la clé
  name: "Minou",
  birthDate: "2021-05-14",
  sex: "female",
  sterilized: true,
  photo: Blob             // le fichier de la photo, directement !
}
```

IndexedDB parle avec des événements (`onsuccess`, `onerror`), ce qui est un peu
lourd. Dans `js/db.js`, on l'emballe dans des **Promise** pour écrire simplement :

```js
await AF.db.put('cats', chat);           // ajouter ou modifier
const chats = await AF.db.getAll('cats'); // tout lire
await AF.db.delete('cats', id);           // supprimer
```

### Bon à savoir

- Les données sont **par navigateur et par appareil** : rien n'est envoyé sur
  internet. C'est pour ça qu'on ajoutera une sauvegarde à exporter (étape 8).
- Le navigateur peut effacer les données d'un site s'il manque de place.
  On lui demande poliment de les garder avec `navigator.storage.persist()`.
- Pour voir la base : dans Chrome, touche F12 → onglet **Application** →
  **IndexedDB** → `arwinfelin`.

### Les photos

Avant d'enregistrer une photo, `AF.compressImage()` la redessine dans un
`<canvas>` plus petit (1280 pixels maximum) et la convertit en JPEG. Une photo
de 5 Mo passe à environ 200 Ko, sans différence visible sur un téléphone.

Pour afficher une photo rangée en `Blob`, on crée une adresse temporaire avec
`URL.createObjectURL(blob)`. Le routeur libère ces adresses quand on change
d'écran, pour ne pas remplir la mémoire.

### L'âge humain

Le calcul suit les repères d'International Cat Care : 1 mois ≈ 1 an humain,
6 mois ≈ 10 ans, 1 an ≈ 15 ans, 2 ans ≈ 24 ans, puis **+4 ans par année**.
Entre deux repères, on fait une règle de trois (une « interpolation linéaire »).

---

## 3. Le carnet de santé

- Toutes les fiches (vaccins, vermifuges, antipuces, visites, allergies,
  traitements) sont rangées dans **un seul magasin** `health`, avec un champ
  `type`. L'index `catId` retrouve vite les fiches d'un chat.
- On a passé la base en **version 2** : au prochain lancement, le navigateur
  appelle `onupgradeneeded`, qui crée le magasin `health` sans toucher aux chats.
- **Badge rouge « en retard »** : on compare la date du prochain rappel avec
  aujourd'hui (`AF.daysUntil`). Si plusieurs fiches ont le même nom (le vaccin
  Rage de 2024 puis celui de 2025), seule la plus récente compte : les
  anciennes sont marquées « Renouvelé » (`AF.activeCare`).
- La date de rappel est proposée automatiquement : +1 an pour un vaccin,
  +3 mois pour un vermifuge, +1 mois pour un antipuces. On peut la changer.

---

## 4. Le poids, la ration et Chart.js

### Comment fonctionne Chart.js ?

Chart.js est une **bibliothèque** : du code écrit par d'autres, qu'on réutilise.
On la charge depuis un **CDN** (un serveur rapide qui distribue des fichiers
publics) avec une simple balise dans `index.html` :

```html
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js"></script>
```

Elle crée alors une fonction globale `Chart`. Pour dessiner une courbe :

1. On place une balise `<canvas>` dans la page : une zone de dessin vide.
2. On appelle `new Chart(canvas, configuration)`. La configuration a 3 parties :
   - `type` : `'line'` pour une courbe (il existe aussi `'bar'`, `'pie'`…) ;
   - `data` : les `labels` (les dates, en bas) et les `datasets` (les séries de
     valeurs, ici les kilos) avec leur style (couleur, épaisseur, arrondi
     `tension`, remplissage `fill`) ;
   - `options` : tout le reste (axes, infobulle, légende, animation).
3. Chart.js calcule les échelles, dessine les axes, la courbe et les points,
   et gère tout seul l'infobulle quand on touche un point.

Dans `js/views/weight.js`, la fonction `drawWeightChart` fait tout ça. Le
dégradé sous la courbe vient de `ctx.createLinearGradient` (une fonction du
canvas). Quand on quitte l'écran, on appelle `chart.destroy()` pour libérer la
mémoire.

Le numéro de version (`@4.4.4`) est figé dans l'adresse : une future version
de Chart.js ne pourra pas casser l'appli par surprise.

### L'alerte de poids

On compare la dernière pesée avec chaque pesée des 31 jours précédents. Si
l'écart dépasse 10 % (par exemple de 5 kg à 5,6 kg), une alerte s'affiche :
chez le chat, une variation rapide est un signe à montrer au vétérinaire.

### La ration indicative

1. Besoin au repos : **RER = 70 × poids^0,75** (en kcal par jour).
2. On le multiplie par un coefficient : 3 pour un chaton de moins de 4 mois,
   1,2 pour un adulte stérilisé, 1,4 s'il ne l'est pas, 1,1 pour un senior,
   ±0,2 selon l'activité.
3. On divise par l'énergie de l'aliment (écrite sur l'emballage, en kcal pour
   100 g) pour obtenir des grammes.

C'est une estimation : à adapter selon les conseils du vétérinaire et
l'emballage.

---

## 5. Le journal

- Chaque souvenir (photo, humeur, note, date) va dans le magasin `journal`
  (base en **version 4**).
- **La frise** regroupe les souvenirs par mois avec une `Map` : la clé est
  `"2026-10"`, la valeur est la liste des souvenirs de ce mois.
- **« Il y a 1 an aujourd'hui »** : pour chaque souvenir d'une année passée, on
  ramène sa date à l'année en cours et on regarde si elle tombe à 3 jours près
  d'aujourd'hui (`AF.getMemories`).
- **Délégation d'événement** : au lieu de mettre un écouteur de clic sur chaque
  souvenir, on en met un seul sur l'écran entier, et `event.target.closest('[data-id]')`
  retrouve le souvenir touché. Plus simple et plus léger quand il y en a des centaines.
- `loading="lazy"` sur les images : le navigateur ne charge une photo que
  lorsqu'elle approche de l'écran.

---

## 6. Rappels, appli installable et notifications

### Les rappels répétés

Un rappel garde sa **première date** (`start`) et sa **répétition**. On ne
stocke jamais la liste de toutes les dates : on la calcule (`AF.nthOccurrence`).
Pour « chaque mois » à partir du 31 janvier, on obtient le 28 février, le
31 mars, le 30 avril… Quand on coche « fait », on note seulement jusqu'à
quelle occurrence c'est fait (`doneUntil`).

Les rappels santé ne sont pas recopiés : l'onglet Rappels lit directement les
dates de « prochain rappel » du carnet. Une seule source de vérité, donc jamais
de rappel en double ou oublié.

### La PWA (appli installable)

- `manifest.json` : nom, couleurs et icônes de l'appli installée.
- `sw.js`, le **service worker** : un script qui se place entre l'appli et
  internet. À l'installation, il met tous les fichiers en cache. Ensuite :
  - nos fichiers : **réseau d'abord**, copie du cache si on est hors ligne ;
  - Chart.js et les polices (CDN) : **cache d'abord**, car ils ne changent jamais.
- Le bouton « Installer » : Chrome et Edge envoient l'événement
  `beforeinstallprompt` quand l'appli est installable. On le garde, et on
  l'utilise quand l'utilisateur touche le bouton. Safari sur iPhone n'a pas ce
  système : on affiche les étapes « Partager → Sur l'écran d'accueil ».
- Quand tu modifies l'appli, change `VERSION` en haut de `sw.js` pour que le
  cache se mette à jour chez les utilisateurs.

### Les notifications : ce qui marche, honnêtement

**Ce que fait l'appli :**
1. À l'ouverture, elle vérifie les rappels du jour (bandeau sur l'accueil,
   pastille rouge sur l'onglet Rappels, chiffre sur l'icône si elle est installée).
2. **Tant qu'elle est ouverte** (même en arrière-plan depuis peu), elle vérifie
   toutes les 30 secondes et envoie une notification à l'heure du rappel.
3. Sur Android, elle demande en plus au navigateur de la réveiller de temps en
   temps (*Periodic Background Sync*).

**Les limites quand l'appli est fermée :**
- Une PWA n'a **pas de vraie alarme programmée**. Une appli native peut dire au
  téléphone « sonne à 8 h 00 » ; une page web ne le peut pas (l'API qui le
  permettait, *Notification Triggers*, a été abandonnée).
- **Android (Chrome)** : le réveil périodique marche seulement si l'appli est
  **installée**, et c'est Chrome qui choisit le moment (souvent quelques fois
  par jour, selon la batterie et l'usage). Donc une notification peut arriver
  avec du retard, voire pas du tout si le téléphone économise la batterie.
- **iPhone (Safari, iOS 16.4 et plus)** : les notifications ne marchent que si
  l'appli est **ajoutée à l'écran d'accueil** et ouverte depuis son icône.
  Il n'y a **aucun réveil en arrière-plan** : appli fermée, l'iPhone ne
  préviendra **pas** à l'heure d'un rappel. Il préviendra à la prochaine ouverture.
- **Ordinateur** : marche bien tant que le navigateur est ouvert.

**La seule solution fiable appli fermée** serait les notifications *push* :
un serveur envoie le message au bon moment (c'est ainsi que fonctionnent
WhatsApp ou Gmail). Il faudrait un serveur, des clés et un compte, ce qu'on a
volontairement évité. Pour un rappel vraiment important (vaccin, médicament),
le plus sûr reste d'ajouter aussi une alarme dans l'agenda du téléphone.

---

## 7. La reconnaissance de race (IA gratuite, dans le téléphone)

### Comment CLIP compare une image avec des mots

CLIP est un modèle d'IA créé par OpenAI et entraîné sur 400 millions de
couples « image + légende » trouvés sur internet. Il a deux moitiés :

- un **encodeur d'images**, qui transforme une photo en une liste de
  512 nombres ;
- un **encodeur de texte**, qui transforme une phrase en une liste de
  512 nombres aussi.

Ces listes s'appellent des **empreintes** (*embeddings*). L'entraînement les a
réglées pour qu'une photo et sa bonne légende aient des empreintes **proches**.
Imagine un immense plan où chaque photo et chaque phrase sont un point :
la photo d'un Persan atterrit tout près de la phrase « a photo of a Persian
cat », et loin de « a photo of a Siamese cat ».

Pour comparer deux empreintes, on calcule leur **similarité cosinus** (un
simple produit de nombres, dans `breed-ai.js` : `dot`) : 1 = identiques,
0 = sans rapport. On fait ça avec la phrase de chaque race, puis la
fonction **softmax** transforme les scores en pourcentages qui font 100 %.

C'est du **zero-shot** (« zéro exemple ») : on n'a jamais montré de photo
de Persan à l'IA pendant notre projet. Elle reconnaît la race grâce aux mots.

### Pourquoi plus de choix peut rendre l'IA moins précise

1. **Les pourcentages se partagent.** Avec 3 choix, la bonne réponse peut
   avoir 80 %. Avec 72 races, la même certitude se dilue : un British
   Shorthair, un Chartreux et un Bleu russe se ressemblent tous (chats gris
   costauds), et chacun prend une part du gâteau.
2. **Plus de pièges.** Chaque race en plus est une nouvelle occasion de se
   tromper avec une race voisine. Les erreurs s'additionnent.
3. **Des noms que CLIP connaît mal.** Il a vu des milliers de photos
   légendées « Siamese », mais très peu « Khao Manee ». Ces races rares
   brouillent le classement.

C'est pour ça qu'on analyse en **deux temps** :

1. d'abord la **famille** (pas un chat / gouttière poil court / gouttière poil
   long / race à poil court / race à poil long / sans poil) : 6 choix bien
   différents, CLIP les distingue facilement ;
2. ensuite **seulement les races de cette famille** : un Persan n'est plus
   jamais comparé à un Sphynx, et il y a deux fois moins de candidats.

### Les astuces qui améliorent le résultat

- **Plusieurs phrases par race** (« a photo of a Persian cat. » et « a photo
  of a Persian, a type of cat. ») : on fait la moyenne de leurs empreintes.
- **Deux vues de la photo** : coupée au centre, et entière sur un fond gris.
  Si le chat est sur le côté, il n'est plus coupé.
- **Un petit bonus pour « chat de gouttière »** : dans la vraie vie, la
  plupart des chats ne sont pas de race.
- **« Pas un chat »** : CLIP comprend mal la négation (« not a cat »), donc on
  lui donne aussi des exemples concrets : un chien, une personne, une peluche…

### Ce qu'on a découvert en testant

Le modèle existe en plusieurs précisions. En **8 bits** (`q8`), le modèle
**texte** perdait presque toute sa finesse : toutes les races obtenaient le
même score ! En **16 bits** (`fp16`), il reconnaissait 6 races sur 6 lors du
test. Le modèle **image**, lui, marche bien en 8 bits.

Comme les phrases ne changent pas, on calcule leurs empreintes **une seule
fois** et on les livre avec l'appli (`data/clip-text-embeddings.json`, environ
230 Ko). Le téléphone n'a donc à télécharger que le modèle image (environ
90 Mo), une seule fois. Si tu modifies `races.js`, l'appli s'en rend compte
et recalcule elle-même les empreintes (en téléchargeant aussi le modèle
texte). Pour régénérer le fichier, ouvre la console du navigateur et tape
`copy(await AF.breedAI.exportEmbeddings())`, puis colle dans le fichier.

Sur 18 photos de races de Wikipédia, la bonne race arrive en tête 11 fois, et
dans le trio de tête 15 fois. C'est un bon niveau pour une IA gratuite qui n'a
jamais été entraînée sur nos races, mais ça reste **indicatif**.
