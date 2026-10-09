/**
 * Ledgio — Supabase Cloud Database Configuration
 * 
 * Instructions:
 * Replace 'PASTE_YOUR_ANON_KEY_HERE' below with your actual anon public key from Supabase.
 */

window.SUPABASE_CONFIG = {
  url: 'https://kbfppganpaiybqfleiuo.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtiZnBwZ2FucGFpeWJxZmxlaXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0ODg3MjksImV4cCI6MjEwMzA2NDcyOX0.SC-pFXG4G2QVnYIFULAiCVnzuTAi-Ig06uM-KcUiQW8'
};

// Admin user IDs authorized for administrative views, telemetry access, and announcements
window.LEDGIO_ADMIN_USER_IDS = ['583ea03b-2246-482f-8a92-670c5c0b7c4f'];

// Supabase Client Singleton Factory & Instance Cache (Sole createClient origin in Ledgio)
window.getSupabaseClient = function() {
  if (window.supabaseClient) {
    return window.supabaseClient;
  }
  const url = window.SUPABASE_CONFIG?.url;
  const anonKey = window.SUPABASE_CONFIG?.anonKey;
  const isConfigured = url && anonKey && anonKey !== 'PASTE_YOUR_ANON_KEY_HERE';
  if (isConfigured && window.supabase && typeof window.supabase.createClient === 'function') {
    try {
      // Supabase JS v2 natively coordinates cross-tab session locks via navigator.locks
      window.supabaseClient = window.supabase.createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: window.localStorage
        }
      });
      return window.supabaseClient;
    } catch (e) {
      console.warn('Supabase singleton initialization error:', e);
      return null;
    }
  }
  return null;
};

// Attempt eager initialization if Supabase library is loaded
if (typeof window !== 'undefined' && window.supabase) {
  window.getSupabaseClient();
}
