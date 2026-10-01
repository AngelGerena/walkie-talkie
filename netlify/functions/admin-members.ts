// Team lead tools: add a member, issue a new activation code, rename or
// change role, and remove a member. Runs with the service role.
import {
  admin, handle, HttpError, json, readBody, requireMember, requireLead,
  hashCode, newActivationCode, EMAIL_DOMAIN,
} from '../lib/server';
import { memberEmail } from '../../shared/identity';

type Body =
  | { action: 'create'; callsign: string; role?: 'lead' | 'member'; post?: string }
  | { action: 'reset'; member_id: string }
  | { action: 'update'; member_id: string; callsign?: string; role?: 'lead' | 'member' }
  | { action: 'delete'; member_id: string };

const CODE_DAYS = 7;

export default handle(async (req) => {
  const me = await requireMember(req);
  requireLead(me);
  const body = await readBody<Body>(req);
  const db = admin();

  const { data: team } = await db.from('teams').select('id, code').eq('id', me.team_id).single();
  if (!team) throw new HttpError(404, 'Team not found.');

  const loadTarget = async (id: string) => {
    const { data } = await db
      .from('members')
      .select('id, team_id, user_id, callsign, role')
      .eq('id', id)
      .eq('team_id', me.team_id)
      .maybeSingle();
    if (!data) throw new HttpError(404, 'That member is not on your team.');
    return data;
  };

  const issueCode = async (memberId: string) => {
    const code = newActivationCode();
    const expires = new Date(Date.now() + CODE_DAYS * 86400000).toISOString();
    await db.from('members').update({ invite_hash: hashCode(code), invite_expires_at: expires }).eq('id', memberId);
    return { code, expires_at: expires };
  };

  switch (body.action) {
    case 'create': {
      const callsign = (body.callsign || '').trim();
      if (!callsign || callsign.length > 24) throw new HttpError(400, 'Callsign must be 1 to 24 characters.');
      const { data: created, error } = await db
        .from('members')
        .insert({
          team_id: me.team_id,
          callsign,
          role: body.role === 'lead' ? 'lead' : 'member',
          post: body.post?.trim() || null,
        })
        .select('id')
        .single();
      if (error || !created) {
        if (error?.code === '23505') throw new HttpError(409, 'Someone on the team already uses that callsign.');
        throw new HttpError(500, `Could not add the member: ${error?.message}`);
      }
      const code = await issueCode(created.id);
      return json(200, { member_id: created.id, callsign, team_code: team.code, ...code });
    }

    case 'reset': {
      const target = await loadTarget(body.member_id);
      const code = await issueCode(target.id);
      return json(200, { member_id: target.id, callsign: target.callsign, team_code: team.code, ...code });
    }

    case 'update': {
      const target = await loadTarget(body.member_id);
      const patch: Record<string, string> = {};
      if (body.role && body.role !== target.role) {
        if (target.id === me.id && body.role !== 'lead') throw new HttpError(400, 'You cannot remove your own lead role.');
        patch.role = body.role;
      }
      const newCallsign = body.callsign?.trim();
      if (newCallsign && newCallsign !== target.callsign) {
        if (newCallsign.length > 24) throw new HttpError(400, 'Callsign must be 24 characters or fewer.');
        patch.callsign = newCallsign;
      }
      if (Object.keys(patch).length === 0) return json(200, { ok: true });
      const { error } = await db.from('members').update(patch).eq('id', target.id);
      if (error) {
        if (error.code === '23505') throw new HttpError(409, 'Someone on the team already uses that callsign.');
        throw new HttpError(500, error.message);
      }
      if (patch.callsign && target.user_id) {
        await db.auth.admin.updateUserById(target.user_id, { email: memberEmail(team.code, patch.callsign, EMAIL_DOMAIN) });
      }
      return json(200, { ok: true });
    }

    case 'delete': {
      const target = await loadTarget(body.member_id);
      if (target.id === me.id) throw new HttpError(400, 'You cannot remove yourself.');
      await db.from('members').delete().eq('id', target.id);
      if (target.user_id) await db.auth.admin.deleteUser(target.user_id);
      return json(200, { ok: true });
    }

    default:
      throw new HttpError(400, 'Unknown action.');
  }
});
