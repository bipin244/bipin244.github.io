/**
 * Supabase client — initialize once for the whole app.
 * Get URL + anon key from: Supabase Dashboard → Project Settings → API
 */
const SUPABASE_URL = 'https://hrjpxgfjseqtrigtztlb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhyanB4Z2Zqc2VxdHJpZ3R6dGxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0NjQzNzYsImV4cCI6MjEwMTA0MDM3Nn0.mIq6-NjOWUW66LmU9CMxcWv1XF97JxdDXaquLiR849Q';

if (typeof supabase === 'undefined' || !supabase.createClient) {
  console.error('Supabase JS SDK not loaded. Include @supabase/supabase-js before this file.');
}

/** Shared Supabase client (browser CDN UMD exposes global `supabase`) */
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function assertSupabaseConfigured() {
  if (!SUPABASE_URL || SUPABASE_URL.startsWith('YOUR_') ||
      !SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.startsWith('YOUR_')) {
    throw new Error('Supabase is not configured. Update js/supabase.js with your project URL and anon key.');
  }
}

/** Turn Supabase/Postgrest errors into readable messages */
function supabaseError(error, fallback = 'Something went wrong') {
  if (!error) return fallback;
  return error.message || error.error_description || fallback;
}
