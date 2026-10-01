// Background function (runs up to 15 minutes, returns 202 immediately).
// Transcribes a recorded transmission and translates it EN <-> ES.
import { admin, handle, json, readBody, requireMember } from '../lib/server';

const TRANSLATE_MODEL = 'claude-haiku-4-5-20251001';

async function transcribe(blob: Blob, filename: string, key: string) {
  const form = new FormData();
  form.append('file', blob, filename);
  form.append('model', 'whisper-1');
  form.append('response_format', 'verbose_json');
  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Transcription failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { text?: string; language?: string };
  const language = (data.language || '').toLowerCase();
  const lang: 'en' | 'es' = language.startsWith('es') || language.startsWith('span') ? 'es' : 'en';
  return { text: (data.text || '').trim(), lang };
}

async function translate(text: string, from: 'en' | 'es', key: string): Promise<string | null> {
  const target = from === 'es' ? 'English' : 'Spanish';
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: TRANSLATE_MODEL,
      max_tokens: 400,
      system:
        `You translate short church security radio transmissions into ${target}. ` +
        'Keep callsigns, unit numbers, names and locations exactly as spoken. ' +
        'Reply with the translation only, no notes or quotation marks.',
      messages: [{ role: 'user', content: text }],
    }),
  });
  if (!res.ok) throw new Error(`Translation failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  return data.content?.find((c) => c.type === 'text')?.text?.trim() || null;
}

export default handle(async (req) => {
  const me = await requireMember(req);
  const { transmission_id } = await readBody<{ transmission_id: string }>(req);
  const db = admin();

  const { data: tx } = await db
    .from('transmissions')
    .select('id, team_id, member_id, audio_path, mime_type')
    .eq('id', transmission_id)
    .eq('team_id', me.team_id)
    .maybeSingle();
  if (!tx || tx.member_id !== me.id || !tx.audio_path) return json(200, { skipped: true });

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    await db.from('transmissions').update({ status: 'skipped' }).eq('id', tx.id);
    return json(200, { skipped: true });
  }

  try {
    const { data: file, error } = await db.storage.from('transmissions').download(tx.audio_path);
    if (error || !file) throw new Error(`Download failed: ${error?.message}`);
    const filename = tx.audio_path.split('/').pop() || 'audio.webm';
    const { text, lang } = await transcribe(file, filename, openaiKey);
    let translation: string | null = null;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (text && anthropicKey) translation = await translate(text, lang, anthropicKey);
    await db
      .from('transmissions')
      .update({ transcript: text || null, transcript_lang: lang, translation, status: 'done' })
      .eq('id', tx.id);
  } catch (err) {
    console.error(err);
    await db.from('transmissions').update({ status: 'failed' }).eq('id', tx.id);
  }
  return json(200, { ok: true });
});
