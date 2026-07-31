/**
 * Login page — Supabase Auth
 */
$(async function () {
  applyTheme(getTheme());
  try {
    await redirectIfAuthenticated();
  } catch (e) { /* ignore */ }

  $('#login-form').on('submit', async function (e) {
    e.preventDefault();
    const email = $('#email').val();
    const password = $('#password').val();
    const $btn = $('#login-btn');
    const $err = $('#login-error');

    $err.addClass('d-none').text('');
    $btn.prop('disabled', true).html(
      '<span class="spinner-border spinner-border-sm me-2"></span>Signing in...'
    );

    try {
      await login(email, password);
      window.location.href = 'index.html';
    } catch (err) {
      let msg = 'Login failed. Check email and password.';
      if (err.message?.includes('not configured')) {
        msg = 'Supabase is not configured. Update js/supabase.js';
      } else if (err.message) {
        msg = err.message;
      }
      $err.removeClass('d-none').text(msg);
      $btn.prop('disabled', false).text('Sign In');
    }
  });
});
