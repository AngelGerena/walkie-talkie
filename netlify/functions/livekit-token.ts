// Issues a short-lived LiveKit token for one channel after checking that
// the caller is on the team and allowed on that channel.
import { AccessToken } from 'livekit-server-sdk';
import { admin, handle, HttpError, json, readBody, requireMember } from '../lib/server';

export default handle(async (req) => {
  const me = await requireMember(req);
  const { channel_id } = await readBody<{ channel_id: string }>(req);
  if (!channel_id) throw new HttpError(400, 'Pick a channel.');

  const { data: channel } = await admin()
    .from('channels')
    .select('id, team_id, leads_only')
    .eq('id', channel_id)
    .eq('team_id', me.team_id)
    .maybeSingle();
  if (!channel) throw new HttpError(404, 'That channel does not exist.');
  if (channel.leads_only && me.role !== 'lead') throw new HttpError(403, 'That channel is for team leads.');

  const key = process.env.LIVEKIT_API_KEY;
  const secret = process.env.LIVEKIT_API_SECRET;
  if (!key || !secret) throw new HttpError(500, 'Audio server keys are missing (LIVEKIT_API_KEY / LIVEKIT_API_SECRET).');

  const token = new AccessToken(key, secret, {
    identity: me.id,
    name: me.callsign,
    metadata: JSON.stringify({ callsign: me.callsign, role: me.role, post: me.post }),
    ttl: '8h',
  });
  token.addGrant({
    room: `${me.team_id}:${channel.id}`,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  return json(200, { token: await token.toJwt() });
});
