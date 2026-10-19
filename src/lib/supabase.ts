import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// Client-side Supabase. Uses only the publishable key; row level security
// protects every table. Never put a secret or service_role key in the app.
const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const missing = [
  !url && 'VITE_SUPABASE_URL',
  !publishableKey && 'VITE_SUPABASE_PUBLISHABLE_KEY',
].filter(Boolean);

if (missing.length > 0) {
  throw new Error(
    `Missing Supabase configuration: ${missing.join(' and ')}. ` +
      'Copy .env.example to .env, fill in the values from your Supabase project ' +
      '(Project Settings > API), then restart the dev server.',
  );
}

export const supabase = createClient<Database>(url as string, publishableKey as string, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
