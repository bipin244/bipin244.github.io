/**
 * Supabase Authentication — Email / Password
 */

/**
 * Sign in with email and password
 * @returns {Promise<{id: string, email: string}>}
 */
async function login(email, password) {
  assertSupabaseConfigured();
  try {
    const { data, error } = await sb.auth.signInWithPassword({
      email: email.trim(),
      password
    });
    if (error) {
      const err = new Error(supabaseError(error, 'Invalid email or password'));
      err.code = 'auth/invalid-credential';
      throw err;
    }
    return {
      id: data.user.id,
      email: data.user.email
    };
  } catch (e) {
    if (e.code) throw e;
    throw new Error(e.message || 'Login failed');
  }
}

/**
 * Sign out and go to login page
 */
async function logout() {
  try {
    if (typeof AppStore !== 'undefined') AppStore.clear();
    await sb.auth.signOut();
  } catch (e) {
    console.warn(e);
  }
  window.location.href = 'login.html';
}

/**
 * Current authenticated user (or null)
 */
async function getCurrentUser() {
  try {
    const { data, error } = await sb.auth.getUser();
    if (error || !data.user) return null;
    return { id: data.user.id, email: data.user.email };
  } catch (e) {
    return null;
  }
}

/**
 * Require auth — redirect to login.html if not signed in
 */
async function requireAuth() {
  assertSupabaseConfigured();
  const user = await getCurrentUser();
  if (user) return user;
  window.location.href = 'login.html';
  throw new Error('Not authenticated');
}

/**
 * If already logged in, leave the login page
 */
async function redirectIfAuthenticated() {
  const user = await getCurrentUser();
  if (user) window.location.href = 'index.html';
}

/**
 * Change password (re-authenticate with current password first)
 */
async function changePassword(currentPassword, newPassword) {
  const user = await getCurrentUser();
  if (!user?.email) throw new Error('No user signed in');

  const { error: reauthError } = await sb.auth.signInWithPassword({
    email: user.email,
    password: currentPassword
  });
  if (reauthError) {
    const err = new Error('Current password is incorrect');
    err.code = 'auth/wrong-password';
    throw err;
  }

  const { error } = await sb.auth.updateUser({ password: newPassword });
  if (error) throw new Error(supabaseError(error, 'Failed to change password'));
}
