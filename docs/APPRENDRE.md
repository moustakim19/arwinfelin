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
