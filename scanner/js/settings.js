/**
 * Settings view — account, theme, password, device categories
 */
const SettingsView = {
  bound: false,
  categoriesMissing: false,

  bind() {
    if (this.bound) return;
    this.bound = true;

    $('#theme-switch').on('change', function () {
      applyTheme(this.checked ? 'dark' : 'light');
      $('.btn-theme i').attr('class', this.checked ? 'bi bi-sun' : 'bi bi-moon');
    });

    $('#password-form').on('submit', async function (e) {
      e.preventDefault();
      const current = $('#current-password').val();
      const next = $('#new-password').val();
      const confirmPw = $('#confirm-password').val();

      if (next.length < 6) {
        showToast('New password must be at least 6 characters', 'warning');
        return;
      }
      if (next !== confirmPw) {
        showToast('Passwords do not match', 'warning');
        return;
      }

      const $btn = $(this).find('button[type="submit"]');
      $btn.prop('disabled', true);
      try {
        await changePassword(current, next);
        showToast('Password updated');
        this.reset();
      } catch (err) {
        console.error(err);
        let msg = 'Failed to change password';
        if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
          msg = 'Current password is incorrect';
        }
        showToast(msg, 'error');
      } finally {
        $btn.prop('disabled', false);
      }
    });

    $('#btn-add-category').on('click', () => this.openCategoryModal());

    $('#category-form').on('submit', async (e) => {
      e.preventDefault();
      await this.saveCategory();
    });

    $(document).on('click', '#category-icon-picker .icon-pick', function () {
      const icon = $(this).data('icon');
      $('#category-icon').val(icon);
      $('#category-icon-picker .icon-pick').removeClass('active').attr('aria-pressed', 'false');
      $(this).addClass('active').attr('aria-pressed', 'true');
    });

    $(document).on('click', '.btn-edit-category', (e) => {
      const id = $(e.currentTarget).closest('[data-category-id]').data('category-id');
      const cat = AppStore.getCategories().find(c => c.id === id);
      if (cat) this.openCategoryModal(cat);
    });

    $(document).on('click', '.btn-delete-category', async (e) => {
      const id = $(e.currentTarget).closest('[data-category-id]').data('category-id');
      const cat = AppStore.getCategories().find(c => c.id === id);
      if (!cat) return;
      const ok = await confirmAction(
        `Delete category "${cat.name}"? Devices using this type must be reassigned first.`
      );
      if (!ok) return;
      try {
        await deleteCategory(id);
        AppStore.removeCategory(id);
        this.renderCategories();
        fillDeviceTypeSelect();
        showToast('Category deleted');
      } catch (err) {
        console.error(err);
        showToast(err.message || 'Failed to delete category', 'error');
      }
    });
  },

  async show(user) {
    $('#user-email').text(user?.email || '—');
    $('#theme-switch').prop('checked', getTheme() === 'dark');
    try {
      await AppStore.ensureCategories(true);
    } catch (e) {
      console.warn(e);
    }
    this.categoriesMissing = AppStore.isCategoriesTableMissing();
    this.renderCategories();
  },

  renderCategories() {
    const list = AppStore.getCategories();
    const $el = $('#categories-list');
    if (!$el.length) return;

    if (this.categoriesMissing) {
      $el.html(`
        <div class="alert alert-warning mb-0 small" role="alert">
          <strong>Database setup needed.</strong>
          Open Supabase → SQL Editor and run
          <code>scanner/supabase/migration_device_types.sql</code>,
          then tap Refresh below.
        </div>
      `);
      return;
    }

    if (!list.length) {
      $el.html('<p class="text-secondary small mb-0">No categories yet. Tap Add to create one.</p>');
      return;
    }

    $el.html(list.map(c => `
      <div class="category-row" data-category-id="${escapeHtml(c.id)}">
        <div class="category-row-main">
          <i class="bi ${escapeHtml(c.icon || 'bi-cpu')}" aria-hidden="true"></i>
          <span class="category-name">${escapeHtml(c.name)}</span>
        </div>
        <div class="category-row-actions">
          <button type="button" class="icon-btn btn-edit-category" title="Edit" aria-label="Edit ${escapeHtml(c.name)}">
            <i class="bi bi-pencil"></i>
          </button>
          <button type="button" class="icon-btn btn-delete-category" title="Delete" aria-label="Delete ${escapeHtml(c.name)}">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>
    `).join(''));
  },

  openCategoryModal(cat = null) {
    const isEdit = !!cat?.id;
    $('#category-modal-title').text(isEdit ? 'Edit Category' : 'Add Category');
    $('#category-id').val(cat?.id || '');
    $('#category-name').val(cat?.name || '');
    const icon = cat?.icon || 'bi-cpu';
    $('#category-icon').val(icon);
    this.renderIconPicker(icon);
    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('category-modal'));
    modal.show();
    setTimeout(() => $('#category-name').trigger('focus'), 300);
  },

  renderIconPicker(selected) {
    const icons = typeof CATEGORY_ICON_OPTIONS !== 'undefined' ? CATEGORY_ICON_OPTIONS : ['bi-cpu'];
    $('#category-icon-picker').html(icons.map(icon => {
      const active = icon === selected ? ' active' : '';
      return `
        <button type="button" class="icon-pick${active}" data-icon="${escapeHtml(icon)}"
                aria-pressed="${icon === selected ? 'true' : 'false'}" title="${escapeHtml(icon)}">
          <i class="bi ${escapeHtml(icon)}" aria-hidden="true"></i>
        </button>
      `;
    }).join(''));
  },

  async saveCategory() {
    const id = $('#category-id').val();
    const name = ($('#category-name').val() || '').trim();
    const icon = ($('#category-icon').val() || 'bi-cpu').trim();

    if (!name) {
      showToast('Category name is required', 'warning');
      return;
    }

    const $btn = $('#category-form button[type="submit"]');
    $btn.prop('disabled', true);
    try {
      let saved;
      if (id) {
        saved = await updateCategory(id, { name, icon });
        AppStore.upsertCategory(saved);
        showToast('Category updated');
      } else {
        saved = await createCategory({ name, icon });
        AppStore.upsertCategory(saved);
        showToast('Category added');
      }
      this.renderCategories();
      fillDeviceTypeSelect();
      bootstrap.Modal.getInstance(document.getElementById('category-modal'))?.hide();
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Failed to save category', 'error');
    } finally {
      $btn.prop('disabled', false);
    }
  }
};
