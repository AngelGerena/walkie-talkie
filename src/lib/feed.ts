import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import { ALERT_COLUMNS, Alert, TX_COLUMNS, Transmission } from './types';

/** Recent transmissions and alerts for the team, kept live with Realtime. */
export function useTeamFeed(teamId: string | undefined, onNewAlert?: (a: Alert) => void) {
  const [transmissions, setTransmissions] = useState<Transmission[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const alertRef = useRef(onNewAlert);
  alertRef.current = onNewAlert;

  const reload = useCallback(async () => {
    if (!teamId) return;
    const [tx, al] = await Promise.all([
      supabase.from('transmissions').select(TX_COLUMNS).eq('team_id', teamId).order('started_at', { ascending: false }).limit(80),
      supabase.from('alerts').select(ALERT_COLUMNS).eq('team_id', teamId).order('created_at', { ascending: false }).limit(40),
    ]);
    if (tx.data) setTransmissions(tx.data as Transmission[]);
    if (al.data) setAlerts(al.data as Alert[]);
  }, [teamId]);

  useEffect(() => {
    if (!teamId) return;
    void reload();
    const filter = `team_id=eq.${teamId}`;
    const ch = supabase
      .channel(`feed:${teamId}:${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transmissions', filter }, (p) => {
        const row = p.new as Transmission;
        setTransmissions((prev) => [row, ...prev.filter((x) => x.id !== row.id)].slice(0, 120));
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'transmissions', filter }, (p) => {
        const row = p.new as Transmission;
        setTransmissions((prev) => prev.map((x) => (x.id === row.id ? row : x)));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alerts', filter }, (p) => {
        const row = p.new as Alert;
        setAlerts((prev) => [row, ...prev.filter((x) => x.id !== row.id)]);
        alertRef.current?.(row);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'alerts', filter }, (p) => {
        const row = p.new as Alert;
        setAlerts((prev) => prev.map((x) => (x.id === row.id ? row : x)));
      })
      .subscribe();

    const onVisible = () => {
      if (document.visibilityState === 'visible') void reload();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      void supabase.removeChannel(ch);
    };
  }, [teamId, reload]);

  return { transmissions, alerts, reload };
}

export async function playTransmission(tx: Transmission): Promise<void> {
  if (!tx.audio_path) return;
  const { data, error } = await supabase.storage.from('transmissions').createSignedUrl(tx.audio_path, 300);
  if (error || !data) throw new Error('Could not load that recording.');
  const audio = new Audio(data.signedUrl);
  await audio.play();
}
