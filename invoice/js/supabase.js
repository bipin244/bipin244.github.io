/**
 * Supabase client — same project as Serial Number Manager (scanner)
 */
const SUPABASE_URL = 'https://gpceewigvfqeqavinlcv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdwY2Vld2lndmZxZXFhdmlubGN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwNjUwMzQsImV4cCI6MjEwMTY0MTAzNH0.FyKvfy8ocoHm2ygmu3Hd4LCwyfJRrO_SoD7mQ7u7eps';

if (typeof supabase === 'undefined' || !supabase.createClient) {
  console.error('Supabase JS SDK not loaded.');
}

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function assertSupabaseConfigured() {
  if (!SUPABASE_URL || SUPABASE_URL.startsWith('YOUR_') ||
      !SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.startsWith('YOUR_')) {
    throw new Error('Supabase is not configured. Update js/supabase.js.');
  }
}

function supabaseError(error, fallback = 'Something went wrong') {
  if (!error) return fallback;
  return error.message || error.error_description || fallback;
}
