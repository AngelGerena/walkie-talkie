import { supabase, VAPID_PUBLIC_KEY } from './supabase';
import type { Member } from './types';

export type PushResult = 'on' | 'unsupported' | 'denied' | 'error';

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && !!VAPID_PUBLIC_KEY;
}

function keyToBytes(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Must be called from a tap (iOS requirement). */
export async function enablePush(member: Member): Promise<PushResult> {
  if (!pushSupported()) return 'unsupported';
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return 'denied';
    const reg = await navigator.serviceWorker.ready;
    const sub =
      (await reg.pushManager.getSubscription()) ||
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyToBytes(VAPID_PUBLIC_KEY) as BufferSource,
      }));
    const json = sub.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return 'error';
    await supabase.from('push_subscriptions').delete().eq('endpoint', json.endpoint);
    const { error } = await supabase.from('push_subscriptions').insert({
      member_id: member.id,
      team_id: member.team_id,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    });
    if (error) return 'error';
    await supabase.from('members').update({ push_enabled: true }).eq('id', member.id);
    return 'on';
  } catch {
    return 'error';
  }
}

export async function currentPushState(): Promise<'on' | 'off' | 'unsupported'> {
  if (!pushSupported()) return 'unsupported';
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    return sub && Notification.permission === 'granted' ? 'on' : 'off';
  } catch {
    return 'off';
  }
}
