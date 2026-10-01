// Scheduled daily. Keeps the Supabase free project from pausing and
// deletes recorded audio older than RETENTION_DAYS (transcripts stay).
import { admin } from '../lib/server';

export default async (): Promise<Response> => {
  const db = admin();
  await db.from('teams').select('id', { count: 'exact', head: true });

  const days = Number(process.env.RETENTION_DAYS || 30);
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();
  const { data: old } = await db
    .from('transmissions')
    .select('id, audio_path')
    .lt('started_at', cutoff)
    .not('audio_path', 'is', null)
    .limit(500);

  if (old && old.length) {
    const paths = old.map((t) => t.audio_path as string);
    await db.storage.from('transmissions').remove(paths);
    await db.from('transmissions').update({ audio_path: null }).in('id', old.map((t) => t.id));
  }
  return new Response(JSON.stringify({ ok: true, cleaned: old?.length || 0 }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const config = { schedule: '@daily' };
