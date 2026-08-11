/**
 * Supabase Authentication — Email / Password
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
    return { id: data.user.id, email: data.user.email };
  } catch (e) {
    if (e.code) throw e;
    throw new Error(e.message || 'Login failed');
  }
}

async function logout() {
  try {
    if (typeof AppStore !== 'undefined') AppStore.clear();
    await sb.auth.signOut();
  } catch (e) {
    console.warn(e);
  }
  window.location.href = 'login.html';
}

async function getCurrentUser() {
  try {
    const { data, error } = await sb.auth.getUser();
    if (error || !data.user) return null;
    return { id: data.user.id, email: data.user.email };
  } catch (e) {
    return null;
  }
}

async function requireAuth() {
  assertSupabaseConfigured();
  const user = await getCurrentUser();
  if (user) return user;
  window.location.href = 'login.html';
  throw new Error('Not authenticated');
}

async function redirectIfAuthenticated() {
  const user = await getCurrentUser();
  if (user) window.location.href = 'index.html';
}
