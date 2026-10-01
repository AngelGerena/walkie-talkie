import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const configError =
  !url || !anonKey
    ? 'This app is missing its Supabase settings. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Netlify, then redeploy with the cache cleared.'
    : null;

export const supabase = createClient(url || 'http://localhost:54321', anonKey || 'missing-key', {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'sd-radio-auth' },
});

export const LIVEKIT_URL = (import.meta.env.VITE_LIVEKIT_URL as string | undefined) || '';
export const VAPID_PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) || '';
export const AUTH_EMAIL_DOMAIN = (import.meta.env.VITE_AUTH_EMAIL_DOMAIN as string | undefined) || 'radio.finessemedia.pro';

/** Calls a Netlify Function with the current session attached. */
export async function callFunction<T = Record<string, unknown>>(name: string, body: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  let res: Response;
  try {
    res = await fetch(`/.netlify/functions/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('No connection. Check your signal and try again.');
  }
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status}).`);
  return json as T;
}
