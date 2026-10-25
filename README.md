# ArwinFelin 🐾

Le carnet de vie de vos chats : profils, santé, poids, souvenirs et rappels.
Une appli web pensée pour téléphone, en HTML, CSS et JavaScript, sans framework.

## Lancer l'appli

1. Ouvrir le dossier dans VS Code.
2. Installer l'extension **Live Server** (de Ritwick Dey).
3. Clic droit sur `index.html` → **Open with Live Server**.

Ne pas ouvrir `index.html` par un double-clic : certaines fonctions (appli
installable, reconnaissance de race) ne marchent qu'avec une adresse `http://`.

## Où sont mes données ?

Tout reste sur l'appareil, dans la base **IndexedDB** du navigateur.
Rien n'est envoyé sur internet.

## Apprendre

Le fichier [docs/APPRENDRE.md](docs/APPRENDRE.md) explique les notions
utilisées, étape par étape.

---

*Cette appli ne remplace pas l'avis d'un vétérinaire.*

## Crédits des photos de races

Les 72 photos de `images/races/` viennent de **Wikimédia Commons**, sous licences
libres (Creative Commons, domaine public…). L'auteur et la licence de chaque
photo sont dans `data/races-photos.json` et affichés sur la fiche de la race.
