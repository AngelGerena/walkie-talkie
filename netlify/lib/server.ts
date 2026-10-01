import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createHash, randomInt } from 'node:crypto';

export interface MemberRow {
  id: string;
  team_id: string;
  user_id: string | null;
  callsign: string;
  role: 'lead' | 'member';
  post: string | null;
  language: 'en' | 'es';
}

let cached: SupabaseClient | null = null;

export function admin(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new HttpError(500, 'Server is missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  cached = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return cached;
}

export const EMAIL_DOMAIN = process.env.VITE_AUTH_EMAIL_DOMAIN || 'radio.finessemedia.pro';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export async function readBody<T>(req: Request): Promise<T> {
  if (req.method !== 'POST') throw new HttpError(405, 'Use POST.');
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, 'Request body must be JSON.');
  }
}

/** Verifies the caller's Supabase session and returns their member row. */
export async function requireMember(req: Request): Promise<MemberRow> {
  const header = req.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) throw new HttpError(401, 'Sign in again to continue.');
  const db = admin();
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'Your session expired. Sign in again.');
  const { data: member } = await db
    .from('members')
    .select('id, team_id, user_id, callsign, role, post, language')
    .eq('user_id', data.user.id)
    .maybeSingle();
  if (!member) throw new HttpError(403, 'This account is not on a security team.');
  return member as MemberRow;
}

export function requireLead(member: MemberRow): void {
  if (member.role !== 'lead') throw new HttpError(403, 'Only team leads can do that.');
}

export function hashCode(code: string): string {
  return createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
}

/** Activation code without look-alike characters (no 0/O, 1/I/L). */
export function newActivationCode(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) out += alphabet[randomInt(alphabet.length)];
  return out;
}

export function handle(fn: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    try {
      return await fn(req);
    } catch (err) {
      if (err instanceof HttpError) return json(err.status, { error: err.message });
      console.error(err);
      return json(500, { error: 'Something went wrong on the server. Try again in a moment.' });
    }
  };
}
