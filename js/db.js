/* =====================================================================
   db.js — La base de données de l'appli, avec IndexedDB
   ---------------------------------------------------------------------
   IndexedDB est une vraie base de données intégrée au navigateur.
   Elle garde les données sur le téléphone, même après fermeture de l'appli.

   Vocabulaire :
   - une "base" (database) : ici "arwinfelin" ;
   - des "magasins d'objets" (object stores) : comme des tiroirs ou des
     tableaux ("cats" pour les chats, "settings" pour les réglages...) ;
   - une "clé" (keyPath) : l'identifiant unique de chaque objet (ici "id") ;
   - un "index" : un raccourci pour retrouver vite des objets par un champ
     (par exemple tous les vaccins dont catId = "abc") ;
   - une "transaction" : un groupe d'opérations fait d'un bloc
     ("readonly" pour lire, "readwrite" pour écrire).

   IndexedDB fonctionne avec des événements (onsuccess, onerror).
   On l'emballe ici dans des "Promise" pour pouvoir écrire simplement :
       const chats = await AF.db.getAll('cats');
   ===================================================================== */

(function (AF) {
  'use strict';

  const DB_NAME = 'arwinfelin';

  // Le numéro de version : à augmenter à chaque fois qu'on ajoute un magasin
  // ou un index. Le navigateur lance alors "onupgradeneeded" pour mettre à jour.
  const DB_VERSION = 5; // v2 : santé · v3 : poids et repas · v4 : journal · v5 : rappels

  // Description de tous les magasins : nom -> liste des index
  const SCHEMA = {
    cats: [],
    health: ['catId'],      // vaccins, vermifuges, antipuces, visites, allergies, traitements
    weights: ['catId'],     // pesées
    meals: ['catId'],       // historique des repas
    journal: ['catId'],     // souvenirs (photo, humeur, note)
    reminders: ['catId'],   // rappels uniques ou répétés
    settings: []
  };

  // Les magasins qui contiennent des données liées à un chat (champ "catId").
  // Quand on supprime un chat, on supprime aussi tout ce qui le concerne.
  const CHILD_STORES = Object.keys(SCHEMA).filter((name) => SCHEMA[name].includes('catId'));

  let dbPromise = null;

  // Ouvre la base (une seule fois, puis on réutilise la même connexion)
  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!self.indexedDB) {
        reject(new Error("IndexedDB n'est pas disponible dans ce navigateur."));
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      // Appelé à la première ouverture, ou quand DB_VERSION augmente
      request.onupgradeneeded = () => {
        const db = request.result;
        const tx = request.transaction;
        for (const [storeName, indexes] of Object.entries(SCHEMA)) {
          // On crée le magasin seulement s'il n'existe pas déjà
          const store = db.objectStoreNames.contains(storeName)
            ? tx.objectStore(storeName)
            : db.createObjectStore(storeName, { keyPath: 'id' });
          for (const indexName of indexes) {
            if (!store.indexNames.contains(indexName)) {
              store.createIndex(indexName, indexName, { unique: false });
            }
          }
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        // Si une autre version de l'appli (autre onglet) met la base à jour,
        // on ferme proprement cette connexion.
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => console.warn('Mise à jour de la base bloquée : fermez les autres onglets ArwinFelin.');
    });
    return dbPromise;
  }

  // Transforme une requête IndexedDB en Promise
  function promisify(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Attend la fin d'une transaction d'écriture
  function done(tx) {
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Transaction annulée'));
    });
  }

  AF.db = {
    STORES: Object.keys(SCHEMA),
    CHILD_STORES,

    // Lire tous les objets d'un magasin
    async getAll(storeName) {
      const db = await open();
      return promisify(db.transaction(storeName).objectStore(storeName).getAll());
    },

    // Lire un seul objet par son id
    async get(storeName, id) {
      const db = await open();
      return promisify(db.transaction(storeName).objectStore(storeName).get(id));
    },

    // Lire tous les objets dont un champ indexé vaut une valeur
    // Exemple : AF.db.getByIndex('weights', 'catId', chat.id)
    async getByIndex(storeName, indexName, value) {
      const db = await open();
      const index = db.transaction(storeName).objectStore(storeName).index(indexName);
      return promisify(index.getAll(value));
    },

    // Ajouter ou modifier un objet ("put" remplace s'il existe déjà)
    async put(storeName, value) {
      const db = await open();
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(value);
      await done(tx);
      return value;
    },

    // Ajouter plusieurs objets d'un coup
    async putMany(storeName, values) {
      const db = await open();
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      for (const value of values) store.put(value);
      await done(tx);
    },

    // Supprimer un objet par son id
    async delete(storeName, id) {
      const db = await open();
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete(id);
      await done(tx);
    },

    // Vider entièrement un magasin
    async clear(storeName) {
      const db = await open();
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).clear();
      await done(tx);
    },

    // Supprimer un chat ET toutes ses données liées, en une seule transaction
    async deleteCat(catId) {
      const db = await open();
      const storeNames = ['cats', ...CHILD_STORES];
      const tx = db.transaction(storeNames, 'readwrite');
      tx.objectStore('cats').delete(catId);
      for (const name of CHILD_STORES) {
        const index = tx.objectStore(name).index('catId');
        // On parcourt avec un "curseur" toutes les fiches de ce chat
        index.openCursor(IDBKeyRange.only(catId)).onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          }
        };
      }
      await done(tx);
    },

    // Réglages : petites valeurs rangées sous un nom (clé)
    async getSetting(key, fallback = null) {
      const row = await AF.db.get('settings', key);
      return row ? row.value : fallback;
    },
    async setSetting(key, value) {
      return AF.db.put('settings', { id: key, value });
    }
  };

  // Liste pratique des chats, triés par nom
  AF.getCats = async function () {
    const cats = await AF.db.getAll('cats');
    return cats.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  };

  // Demande au navigateur de ne pas effacer nos données s'il manque de place.
  // (Sans ça, le navigateur peut parfois vider le stockage des sites peu utilisés.)
  AF.requestPersistentStorage = async function () {
    try {
      if (navigator.storage && navigator.storage.persist) {
        const already = await navigator.storage.persisted();
        if (!already) await navigator.storage.persist();
      }
    } catch (e) {
      /* pas grave si ça échoue */
    }
  };
})(self.AF);
