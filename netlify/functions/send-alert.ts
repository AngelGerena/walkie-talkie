// Sends a push notification for an SOS alert or team broadcast, or pings
// one member to open the radio. Works even when their phone is locked.
import webpush from 'web-push';
import { admin, handle, HttpError, json, readBody, requireMember, requireLead } from '../lib/server';
import { ALERT_LABELS, AlertKind } from '../../shared/identity';

type Body = { alert_id: string } | { ping_member_id: string };

interface SubRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  member_id: string;
  members: { language: 'en' | 'es' } | { language: 'en' | 'es' }[] | null;
}

function langOf(row: SubRow): 'en' | 'es' {
  const m = Array.isArray(row.members) ? row.members[0] : row.members;
  return m?.language === 'es' ? 'es' : 'en';
}

export default handle(async (req) => {
  const me = await requireMember(req);
  const body = await readBody<Body>(req);
  const db = admin();

  const pub = process.env.VITE_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) throw new HttpError(500, 'Push keys are missing (VITE_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY).');
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:angel@finessemedia.pro', pub, priv);

  let subs: SubRow[] = [];
  let build: (lang: 'en' | 'es') => { title: string; body: string; tag: string; urgent: boolean };

  if ('alert_id' in body) {
    const { data: alert } = await db
      .from('alerts')
      .select('id, team_id, callsign, kind, post, message')
      .eq('id', body.alert_id)
      .eq('team_id', me.team_id)
      .maybeSingle();
    if (!alert) throw new HttpError(404, 'Alert not found.');
    const kind = alert.kind as AlertKind;
    const { data } = await db
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth, member_id, members(language)')
      .eq('team_id', me.team_id)
      .neq('member_id', me.id);
    subs = (data || []) as unknown as SubRow[];
    build = (lang) =>
      kind === 'broadcast'
        ? {
            title: lang === 'es' ? `Mensaje de ${alert.callsign}` : `Broadcast from ${alert.callsign}`,
            body: alert.message || '',
            tag: `alert-${alert.id}`,
            urgent: false,
          }
        : {
            title: `SOS: ${ALERT_LABELS[kind][lang]}`,
            body: `${alert.callsign}${alert.post ? ` · ${alert.post}` : ''}${alert.message ? ` · ${alert.message}` : ''}`,
            tag: `alert-${alert.id}`,
            urgent: true,
          };
  } else {
    requireLead(me);
    const { data } = await db
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth, member_id, members(language)')
      .eq('team_id', me.team_id)
      .eq('member_id', body.ping_member_id);
    subs = (data || []) as unknown as SubRow[];
    build = (lang) => ({
      title: lang === 'es' ? 'Reporte, por favor' : 'Check in, please',
      body: lang === 'es' ? `${me.callsign} te pide abrir el radio.` : `${me.callsign} is asking you to open the radio.`,
      tag: `ping-${Date.now()}`,
      urgent: true,
    });
  }

  let sent = 0;
  let failed = 0;
  await Promise.all(
    subs.map(async (s) => {
      const payload = { ...build(langOf(s)), url: '/' };
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: 600, urgency: 'high' },
        );
        sent++;
      } catch (err) {
        failed++;
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await db.from('push_subscriptions').delete().eq('id', s.id);
      }
    }),
  );

  return json(200, { sent, failed });
});
