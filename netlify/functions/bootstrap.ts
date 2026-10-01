// One-time setup: creates the team, default channels and the first lead.
// Protected by BOOTSTRAP_SECRET. Remove that env var after setup.
import { admin, handle, HttpError, json, readBody, EMAIL_DOMAIN } from '../lib/server';
import { memberEmail, normalizeTeamCode, PIN_PATTERN, TEAM_CODE_PATTERN } from '../../shared/identity';

interface Body {
  secret: string;
  church_name: string;
  team_name?: string;
  team_code: string;
  callsign: string;
  pin: string;
}

const DEFAULT_CHANNELS = [
  { name_en: 'Main · All Posts', name_es: 'Principal · Todos', leads_only: false },
  { name_en: 'Parking Lot', name_es: 'Estacionamiento', leads_only: false },
  { name_en: 'Sanctuary', name_es: 'Santuario', leads_only: false },
  { name_en: "Children's Wing", name_es: 'Área de Niños', leads_only: false },
  { name_en: 'Medical Response', name_es: 'Respuesta Médica', leads_only: false },
  { name_en: 'Command', name_es: 'Mando', leads_only: true },
];

export default handle(async (req) => {
  const body = await readBody<Body>(req);
  const secret = process.env.BOOTSTRAP_SECRET;
  if (!secret) throw new HttpError(403, 'Setup is turned off. Add BOOTSTRAP_SECRET in Netlify to run it.');
  if (body.secret !== secret) throw new HttpError(403, 'That setup key is not correct.');

  const code = normalizeTeamCode(body.team_code || '');
  const church = (body.church_name || '').trim();
  const callsign = (body.callsign || '').trim();
  if (!church) throw new HttpError(400, 'Enter the church name.');
  if (!TEAM_CODE_PATTERN.test(code)) throw new HttpError(400, 'Team code must be 4 to 16 letters, numbers or dashes.');
  if (!callsign) throw new HttpError(400, 'Enter your callsign.');
  if (!PIN_PATTERN.test(body.pin || '')) throw new HttpError(400, 'PIN must be exactly 6 digits.');

  const db = admin();
  const { data: existing } = await db.from('teams').select('id').eq('code', code).maybeSingle();
  if (existing) throw new HttpError(409, 'A team with that code already exists.');

  const { data: team, error: teamErr } = await db
    .from('teams')
    .insert({ church_name: church, team_name: (body.team_name || 'Security Detail').trim(), code })
    .select('id')
    .single();
  if (teamErr || !team) throw new HttpError(500, `Could not create the team: ${teamErr?.message}`);

  await db.from('channels').insert(DEFAULT_CHANNELS.map((c, i) => ({ ...c, team_id: team.id, sort: i + 1 })));

  const { data: created, error: userErr } = await db.auth.admin.createUser({
    email: memberEmail(code, callsign, EMAIL_DOMAIN),
    password: body.pin,
    email_confirm: true,
    user_metadata: { callsign },
  });
  if (userErr || !created.user) {
    await db.from('teams').delete().eq('id', team.id);
    throw new HttpError(500, `Could not create your sign-in: ${userErr?.message}`);
  }

  const { error: memberErr } = await db.from('members').insert({
    team_id: team.id,
    user_id: created.user.id,
    callsign,
    role: 'lead',
    post: 'Command Post',
  });
  if (memberErr) throw new HttpError(500, `Could not add you to the team: ${memberErr.message}`);

  return json(200, { ok: true, team_code: code });
});
