// A team member activates their account (or resets their PIN) using the
// one-time activation code a lead gave them. They choose their own PIN.
import { admin, handle, HttpError, json, readBody, hashCode, EMAIL_DOMAIN } from '../lib/server';
import { memberEmail, normalizeTeamCode, PIN_PATTERN } from '../../shared/identity';

interface Body {
  team_code: string;
  callsign: string;
  code: string;
  pin: string;
}

export default handle(async (req) => {
  const body = await readBody<Body>(req);
  const teamCode = normalizeTeamCode(body.team_code || '');
  const callsign = (body.callsign || '').trim();
  if (!PIN_PATTERN.test(body.pin || '')) throw new HttpError(400, 'Choose a PIN of exactly 6 digits.');
  const denied = new HttpError(400, 'Team code, callsign or activation code does not match. Check with your team lead.');

  const db = admin();
  const { data: team } = await db.from('teams').select('id, code').eq('code', teamCode).maybeSingle();
  if (!team) throw denied;

  const { data: members } = await db
    .from('members')
    .select('id, user_id, callsign, invite_hash, invite_expires_at')
    .eq('team_id', team.id);
  const member = (members || []).find((m) => m.callsign.toLowerCase() === callsign.toLowerCase());
  if (!member || !member.invite_hash || member.invite_hash !== hashCode(body.code || '')) throw denied;
  if (member.invite_expires_at && new Date(member.invite_expires_at).getTime() < Date.now()) {
    throw new HttpError(400, 'That activation code has expired. Ask your team lead for a new one.');
  }

  const email = memberEmail(team.code, member.callsign, EMAIL_DOMAIN);
  if (member.user_id) {
    const { error } = await db.auth.admin.updateUserById(member.user_id, { password: body.pin, email });
    if (error) throw new HttpError(500, `Could not update your PIN: ${error.message}`);
  } else {
    const { data, error } = await db.auth.admin.createUser({
      email,
      password: body.pin,
      email_confirm: true,
      user_metadata: { callsign: member.callsign },
    });
    if (error || !data.user) throw new HttpError(500, `Could not activate your account: ${error?.message}`);
    await db.from('members').update({ user_id: data.user.id }).eq('id', member.id);
  }

  await db.from('members').update({ invite_hash: null, invite_expires_at: null }).eq('id', member.id);
  return json(200, { ok: true, callsign: member.callsign });
});
