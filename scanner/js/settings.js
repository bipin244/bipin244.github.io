/**
 * Settings view
 */
const SettingsView = {
  bound: false,

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
  },

  show(user) {
    $('#user-email').text(user?.email || '—');
    $('#theme-switch').prop('checked', getTheme() === 'dark');
  }
};
