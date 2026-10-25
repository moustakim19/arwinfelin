/* =====================================================================
   views/placeholders.js — Onglets qui arrivent dans les prochaines étapes
   ===================================================================== */

(function (AF) {
  'use strict';
  AF.route('/rappels', AF.comingSoon('Rappels'), 'reminders');
  AF.route('/profil', AF.comingSoon('Profil'), 'profile');
})(self.AF);
