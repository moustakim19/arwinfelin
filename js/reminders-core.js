/* =====================================================================
   reminders-core.js — Le calcul des rappels (unique ou répété)
   ---------------------------------------------------------------------
   Ce fichier ne touche pas à l'écran : il est utilisé à la fois par la
   page ET par le service worker (sw.js), qui peut vérifier les rappels
   en arrière-plan quand le navigateur le permet.

   Un rappel ressemble à :
   {
     id, catId,                 // catId vide = pour tous les chats
     title: 'Vermifuge',
     kind: 'meal' | 'litter' | 'vaccine' | 'vet' | 'care' | 'other',
     start: '2026-10-25T08:00', // première fois
     repeat: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly',
     doneUntil: '2026-10-25T08:00'  // dernière occurrence cochée "faite"
   }
   ===================================================================== */

(function (AF) {
  'use strict';

  AF.REPEATS = {
    none: 'Une seule fois',
    daily: 'Tous les jours',
    weekly: 'Chaque semaine',
    monthly: 'Chaque mois',
    yearly: 'Chaque année'
  };

  // La n-ième occurrence d'un rappel (n = 0 pour la première)
  AF.nthOccurrence = function (start, repeat, n) {
    const d = AF.parseDate(start);
    if (repeat === 'daily') d.setDate(d.getDate() + n);
    else if (repeat === 'weekly') d.setDate(d.getDate() + 7 * n);
    else if (repeat === 'monthly' || repeat === 'yearly') {
      const months = repeat === 'monthly' ? n : 12 * n;
      const day = d.getDate();
      d.setDate(1);
      d.setMonth(d.getMonth() + months);
      // Le 31 du mois n'existe pas toujours : on prend le dernier jour du mois
      d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
    }
    return d;
  };

  // Estimation rapide du nombre d'occurrences entre le début et une date
  function estimateIndex(start, repeat, date) {
    const s = AF.parseDate(start);
    if (repeat === 'daily') return Math.floor((date - s) / 86400000);
    if (repeat === 'weekly') return Math.floor((date - s) / (7 * 86400000));
    const months = (date.getFullYear() - s.getFullYear()) * 12 + (date.getMonth() - s.getMonth());
    return repeat === 'monthly' ? months : Math.floor(months / 12);
  }

  // Toutes les occurrences NON faites entre deux dates (incluses)
  AF.occurrencesBetween = function (r, from, to) {
    const done = r.doneUntil ? AF.parseDate(r.doneUntil) : null;
    const isOpen = (d) => !done || d > done;
    const out = [];
    if (!r.start) return out;
    if (r.repeat === 'none' || !AF.REPEATS[r.repeat]) {
      const d = AF.parseDate(r.start);
      if (d >= from && d <= to && isOpen(d)) out.push(d);
      return out;
    }
    let n = Math.max(0, estimateIndex(r.start, r.repeat, from) - 1);
    for (let guard = 0; guard < 400; guard++, n++) {
      const d = AF.nthOccurrence(r.start, r.repeat, n);
      if (d > to) break;
      if (d >= from && isOpen(d)) out.push(d);
    }
    return out;
  };

  // La prochaine occurrence non faite à partir de maintenant
  AF.nextOccurrence = function (r, now = new Date()) {
    const far = new Date(now);
    far.setFullYear(far.getFullYear() + 2);
    return AF.occurrencesBetween(r, AF.startOfDay(now), far)[0] || null;
  };

  // Un rappel "en retard" : occurrence passée, pas faite, avant aujourd'hui.
  // - rappel unique : en retard tant qu'il n'est pas coché ;
  // - rappel répété : seulement s'il est mensuel ou annuel, et depuis moins de 60 jours
  //   (un repas d'hier oublié n'a plus de sens aujourd'hui).
  AF.overdueOccurrence = function (r, now = new Date()) {
    const today = AF.startOfDay(now);
    if (r.repeat === 'none' || !AF.REPEATS[r.repeat]) {
      const d = AF.parseDate(r.start);
      const done = r.doneUntil && AF.parseDate(r.doneUntil) >= d;
      return d < today && !done ? d : null;
    }
    if (r.repeat !== 'monthly' && r.repeat !== 'yearly') return null;
    const from = new Date(today);
    from.setDate(from.getDate() - 60);
    const list = AF.occurrencesBetween(r, from, new Date(today - 1));
    return list.length ? list[list.length - 1] : null;
  };

  // Les rappels du jour (faits ou non) et en retard, triés par heure.
  // Renvoie des "items" : { reminder, date, done, overdue }
  AF.todayItems = function (reminders, now = new Date()) {
    const start = AF.startOfDay(now);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    const items = [];
    for (const r of reminders) {
      if (r.paused) continue;
      const overdue = AF.overdueOccurrence(r, now);
      if (overdue) items.push({ reminder: r, date: overdue, done: false, overdue: true });
      // Les occurrences d'aujourd'hui (on regarde aussi celles déjà cochées)
      const all = AF.occurrencesBetween({ ...r, doneUntil: '' }, start, end);
      const done = r.doneUntil ? AF.parseDate(r.doneUntil) : null;
      for (const d of all) items.push({ reminder: r, date: d, done: Boolean(done && d <= done), overdue: false });
    }
    return items.sort((a, b) => a.date - b.date);
  };

  // Prépare les notifications à envoyer maintenant (sans doublon).
  // "notified" = objet { clé: date } des notifications déjà envoyées.
  // Utilisé par la page ET par le service worker.
  AF.collectNotifications = function ({ reminders, health, cats, notified, now = new Date() }) {
    const catName = new Map(cats.map((c) => [c.id, c.name]));
    const out = [];
    for (const item of AF.todayItems(reminders, now)) {
      if (item.done || item.date > now) continue; // pas encore l'heure, ou déjà fait
      const key = item.reminder.id + '@' + AF.toLocalDateTime(item.date);
      if (notified[key]) continue;
      const who = catName.get(item.reminder.catId);
      out.push({
        key,
        title: (item.overdue ? '⏰ En retard : ' : '🐾 ') + item.reminder.title,
        body: (who ? who + ' · ' : '') + (item.overdue ? 'prévu le ' + AF.formatDate(AF.toISODate(item.date)) : 'à ' + AF.formatTime(AF.toLocalDateTime(item.date)))
      });
    }
    for (const { entry, days } of AF.healthReminderItems(health, cats, 0)) {
      const key = 'h:' + entry.id + '@' + entry.nextDate;
      if (notified[key]) continue;
      out.push({
        key,
        title: (days < 0 ? '⏰ ' : '💉 ') + entry.name + ' · ' + (catName.get(entry.catId) || ''),
        body: days < 0 ? 'Rappel santé en retard de ' + AF.plural(-days, 'jour', 'jours') : "Rappel santé prévu aujourd'hui"
      });
    }
    return out;
  };

  // Retire les clés de plus de 3 jours pour que la liste ne grossisse pas
  AF.pruneNotified = function (notified) {
    const limit = Date.now() - 3 * 86400000;
    const clean = {};
    for (const [key, time] of Object.entries(notified || {})) if (time > limit) clean[key] = time;
    return clean;
  };

  // Les soins du carnet de santé transformés en rappels "automatiques"
  AF.healthReminderItems = function (healthEntries, cats, withinDays = 60) {
    const catIds = new Set(cats.map((c) => c.id));
    return AF.activeCare(healthEntries)
      .filter((e) => e.nextDate && catIds.has(e.catId))
      .map((e) => ({ entry: e, days: AF.daysUntil(e.nextDate) }))
      .filter((x) => x.days <= withinDays)
      .sort((a, b) => a.entry.nextDate.localeCompare(b.entry.nextDate));
  };
})(self.AF);
