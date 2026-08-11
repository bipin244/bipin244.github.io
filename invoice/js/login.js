/**
 * Login page
 */
$(async () => {
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
    $btn.prop('disabled', true).text('Signing in…');
    try {
      await login(email, password);
      window.location.href = 'index.html';
    } catch (err) {
      console.error(err);
      $err.removeClass('d-none').text(err.message || 'Login failed');
      $btn.prop('disabled', false).text('Sign In');
    }
  });
});
