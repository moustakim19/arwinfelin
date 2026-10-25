/* =====================================================================
   notify.js — Les notifications et la pastille de l'onglet Rappels
   ---------------------------------------------------------------------
   Ce que l'appli fait :
   1. à l'ouverture, elle vérifie les rappels du jour ;
   2. tant qu'elle est ouverte, elle revérifie toutes les 30 secondes et
      affiche une notification quand l'heure d'un rappel arrive ;
   3. sur Android (Chrome, appli installée), elle demande au navigateur de
      la réveiller de temps en temps en arrière-plan ("Periodic Background
      Sync") pour vérifier les rappels. Ce n'est PAS garanti : c'est le
      navigateur qui décide quand (souvent quelques fois par jour).
   ===================================================================== */

(function (AF) {
  'use strict';

  const supported = 'Notification' in window;

  AF.notify = {
    supported,

    // 'granted' (autorisé), 'denied' (refusé), 'default' (pas encore demandé), ou 'unsupported'
    permission() {
      return supported ? Notification.permission : 'unsupported';
    },

    // Demande la permission (doit être appelé après un clic de l'utilisateur)
    async request() {
      if (!supported) return 'unsupported';
      const result = await Notification.requestPermission();
      if (result === 'granted') {
        await AF.notify.registerBackgroundCheck();
        AF.notify.show('Notifications activées 🎉', { body: 'ArwinFelin vous préviendra pour les rappels.' });
      }
      return result;
    },

    // Affiche une notification. Sur Android, il FAUT passer par le service worker.
    async show(title, options = {}) {
      if (AF.notify.permission() !== 'granted') return false;
      const opts = { icon: 'icons/icon-192.png', badge: 'icons/badge-96.png', lang: 'fr', ...options };
      try {
        const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
        if (reg) await reg.showNotification(title, opts);
        else new Notification(title, opts);
        return true;
      } catch (e) {
        console.warn('Notification impossible', e);
        return false;
      }
    },

    // Vérifie les rappels arrivés à échéance et envoie les notifications
    async check() {
      const [reminders, health, cats, notified] = await Promise.all([
        AF.db.getAll('reminders'), AF.db.getAll('health'), AF.getCats(), AF.db.getSetting('notified', {})
      ]);
      await AF.updateReminderBadge(reminders, health, cats);
      if (AF.notify.permission() !== 'granted') return;

      const list = AF.collectNotifications({ reminders, health, cats, notified });
      if (!list.length) return;
      const clean = AF.pruneNotified(notified);
      // S'il y en a beaucoup d'un coup (à l'ouverture), on les regroupe en une seule
      if (list.length > 3) {
        await AF.notify.show(list.length + ' rappels pour vos chats', {
          body: list.slice(0, 4).map((n) => n.title.replace(/^\S+ /, '')).join(' · '), tag: 'af-summary', data: { url: '#/rappels' }
        });
      } else {
        for (const n of list) await AF.notify.show(n.title, { body: n.body, tag: n.key, data: { url: '#/rappels' } });
      }
      for (const n of list) clean[n.key] = Date.now();
      await AF.db.setSetting('notified', clean);
    },

    // Android/Chrome : réveil périodique en arrière-plan (si le navigateur l'accepte)
    async registerBackgroundCheck() {
      try {
        const reg = await navigator.serviceWorker.ready;
        if (!('periodicSync' in reg)) return false;
        const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
        if (status.state !== 'granted') return false;
        await reg.periodicSync.register('af-reminders', { minInterval: 60 * 60 * 1000 }); // au mieux 1 fois par heure
        return true;
      } catch (e) {
        return false;
      }
    },

    // Lance la surveillance pendant que l'appli est ouverte
    start() {
      const run = () => AF.notify.check().catch((e) => console.warn(e));
      setTimeout(run, 1200);
      setInterval(run, 30000);
      // Quand on revient sur l'appli (après l'avoir mise en arrière-plan)
      document.addEventListener('visibilitychange', () => { if (!document.hidden) run(); });
      if (AF.notify.permission() === 'granted' && 'serviceWorker' in navigator) AF.notify.registerBackgroundCheck();
    }
  };

  // Nombre de rappels à faire aujourd'hui (ou en retard) : pastille rouge sur l'onglet
  // et, si l'appli est installée, petit chiffre sur son icône (navigator.setAppBadge).
  AF.updateReminderBadge = async function (reminders, health, cats) {
    if (!reminders) [reminders, health, cats] = await Promise.all([AF.db.getAll('reminders'), AF.db.getAll('health'), AF.getCats()]);
    const now = new Date();
    const todo = AF.todayItems(reminders, now).filter((i) => !i.done && (i.overdue || i.date <= now)).length
      + AF.healthReminderItems(health, cats, 0).length;
    const tab = document.querySelector('.tabbar [data-tab=reminders]');
    if (tab) {
      let dot = tab.querySelector('.tab-dot');
      if (todo && !dot) { dot = document.createElement('span'); dot.className = 'tab-dot'; tab.appendChild(dot); }
      if (dot) { if (todo) dot.textContent = todo > 9 ? '9+' : todo; else dot.remove(); }
    }
    try {
      if ('setAppBadge' in navigator) todo ? navigator.setAppBadge(todo) : navigator.clearAppBadge();
    } catch (e) { /* pas grave */ }
    return todo;
  };
})(self.AF);
