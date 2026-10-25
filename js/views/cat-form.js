/* =====================================================================
   views/cat-form.js — Formulaire pour ajouter ou modifier un chat
   ===================================================================== */

(function (AF) {
  'use strict';

  // Suggestions de couleurs de robe (l'utilisateur peut aussi écrire autre chose)
  const COLORS = [
    'Noir', 'Blanc', 'Roux', 'Crème', 'Gris (bleu)', 'Tigré brun', 'Tigré roux', 'Tigré gris',
    'Écaille de tortue', 'Tricolore (calico)', 'Noir et blanc', 'Roux et blanc', 'Gris et blanc',
    'Seal point', 'Blue point', 'Chocolat', 'Lilas', 'Cannelle', 'Fauve', 'Smoke', 'Silver'
  ];

  async function catFormView(params) {
    const isEdit = Boolean(params.id);
    const cat = isEdit ? await AF.db.get('cats', params.id) : null;
    if (isEdit && !cat) {
      return { html: AF.topbar({ title: 'Chat introuvable', back: true }) + AF.emptyState({ title: "Ce chat n'existe plus" }) };
    }
    const c = cat || {};
    // Noms des races proposés dans la liste (fournis par races.js s'il est chargé)
    const breedNames = (AF.BREEDS || []).map((b) => b.name);

    const html = `
      ${AF.topbar({ title: isEdit ? 'Modifier ' + c.name : 'Nouveau chat', back: true })}
      <form class="page form" id="cat-form" novalidate>
        ${AF.photoPickerHTML('cat-photo', { shape: 'round', label: 'Sa plus belle photo', placeholder: AF.catFaceSVG(AF.colorFromText(c.name || '')) })}

        <div class="card form-card">
          <label class="field">
            <span>Nom <em>*</em></span>
            <input name="name" required maxlength="40" autocomplete="off" placeholder="Ex. Minou" value="${AF.esc(c.name)}">
          </label>

          <label class="field">
            <span>Date de naissance</span>
            <input type="date" name="birthDate" max="${AF.today()}" value="${AF.esc(c.birthDate)}">
            <small>Approximative si vous ne la connaissez pas exactement.</small>
          </label>

          <div class="field">
            <span>Sexe</span>
            <div class="seg" role="radiogroup" aria-label="Sexe">
              <label><input type="radio" name="sex" value="female" ${c.sex === 'female' ? 'checked' : ''}><span>♀ Femelle</span></label>
              <label><input type="radio" name="sex" value="male" ${c.sex === 'male' ? 'checked' : ''}><span>♂ Mâle</span></label>
            </div>
          </div>
        </div>

        <div class="card form-card">
          <label class="field">
            <span>Race</span>
            <input name="breed" list="breed-list" maxlength="60" autocomplete="off" placeholder="Ex. Européen, Maine Coon…" value="${AF.esc(c.breed)}">
            <datalist id="breed-list">${breedNames.map((n) => `<option value="${AF.esc(n)}">`).join('')}</datalist>
          </label>

          <label class="field">
            <span>Couleur de la robe</span>
            <input name="color" list="color-list" maxlength="40" autocomplete="off" placeholder="Ex. Tigré roux" value="${AF.esc(c.color)}">
            <datalist id="color-list">${COLORS.map((n) => `<option value="${AF.esc(n)}">`).join('')}</datalist>
          </label>

          <label class="field">
            <span>Numéro de puce</span>
            <input name="chip" inputmode="numeric" maxlength="20" autocomplete="off" placeholder="15 chiffres, ex. 250269…" value="${AF.esc(c.chip)}">
          </label>

          <label class="switch-row">
            <span>
              <strong>Stérilisé(e)</strong>
              <small>Castré ou stérilisée</small>
            </span>
            <input type="checkbox" class="switch" name="sterilized" ${c.sterilized ? 'checked' : ''}>
          </label>
        </div>

        <div class="form-actions">
          <button type="submit" class="btn btn-primary btn-lg btn-block">${AF.icon('check')} ${isEdit ? 'Enregistrer' : 'Ajouter ce chat'}</button>
          ${isEdit ? `<button type="button" class="btn btn-ghost-danger btn-block" data-delete>${AF.icon('trash')} Supprimer ${AF.esc(c.name)}</button>` : ''}
        </div>
      </form>`;

    function mount(root) {
      const form = root.querySelector('#cat-form');
      const photo = AF.photoPicker(root.querySelector('#cat-photo'), c.photo || null, { maxSize: 1000 });

      form.addEventListener('submit', async (event) => {
        event.preventDefault(); // empêche le navigateur de recharger la page
        const data = AF.formData(form);

        if (!data.name) {
          AF.toast('Il faut au moins un nom 🐾', 'error');
          form.name.focus();
          return;
        }
        if (data.birthDate && data.birthDate > AF.today()) {
          AF.toast('La date de naissance est dans le futur', 'error');
          return;
        }

        // On garde les champs existants (...c) et on remplace par les nouveaux
        const saved = {
          ...c,
          id: c.id || AF.uid(),
          name: data.name,
          birthDate: data.birthDate || '',
          sex: data.sex || '',
          breed: data.breed,
          color: data.color,
          chip: data.chip,
          sterilized: data.sterilized,
          photo: photo.getBlob(),
          createdAt: c.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        const button = form.querySelector('[type=submit]');
        button.disabled = true;
        try {
          await AF.db.put('cats', saved);
          AF.requestPersistentStorage();
          AF.toast(isEdit ? 'Modifications enregistrées' : saved.name + ' fait partie de la famille !', 'success');
          if (isEdit) {
            // On revient sur la fiche, qui se réaffiche avec les nouvelles infos
            AF.back('/chat/' + encodeURIComponent(saved.id));
          } else {
            // "replace" : le bouton retour ne reviendra pas sur le formulaire
            AF.go('/chat/' + encodeURIComponent(saved.id), { replace: true });
          }
        } catch (error) {
          console.error(error);
          AF.toast("L'enregistrement a échoué : " + error.message, 'error');
          button.disabled = false;
        }
      });

      const deleteBtn = root.querySelector('[data-delete]');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
          const ok = await AF.confirm({
            title: 'Supprimer ' + c.name + ' ?',
            message: 'Toutes ses données (santé, poids, souvenirs, rappels) seront effacées. Cette action est définitive.',
            confirmText: 'Supprimer',
            danger: true
          });
          if (!ok) return;
          await AF.db.deleteCat(c.id);
          AF.toast(c.name + ' a été supprimé(e)', 'info');
          AF.go('/', { replace: true });
        });
      }
    }

    return { html, mount };
  }

  AF.route('/nouveau', catFormView, 'home');
  AF.route('/chat/:id/modifier', catFormView, 'home');
})(self.AF);
