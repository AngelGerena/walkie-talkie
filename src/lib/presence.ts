import { useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';

export interface PresenceEntry {
  member_id: string;
  callsign: string;
  post: string | null;
  role: 'lead' | 'member';
  channel_id: string | null;
  talking: boolean;
}

/**
 * Team-wide presence. Pass `self` to appear on the roster (radio), or
 * null to watch without appearing (command dashboard).
 */
export function useTeamPresence(teamId: string | undefined, self: PresenceEntry | null): PresenceEntry[] {
  const [entries, setEntries] = useState<PresenceEntry[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const selfRef = useRef(self);
  selfRef.current = self;
  const tracking = self !== null;
  const memberId = self?.member_id;

  useEffect(() => {
    if (!teamId) return;
    const key = memberId ?? `observer-${Math.random().toString(36).slice(2)}`;
    const ch = supabase.channel(`presence:${teamId}`, { config: { presence: { key } } });
    const sync = () => {
      const state = ch.presenceState<PresenceEntry>();
      const list: PresenceEntry[] = [];
      for (const metas of Object.values(state)) {
        const last = metas[metas.length - 1];
        if (last && last.member_id) list.push(last);
      }
      setEntries(list);
    };
    ch.on('presence', { event: 'sync' }, sync).subscribe((status) => {
      if (status === 'SUBSCRIBED' && selfRef.current) void ch.track(selfRef.current);
    });
    channelRef.current = ch;
    return () => {
      channelRef.current = null;
      void supabase.removeChannel(ch);
    };
  }, [teamId, tracking, memberId]);

  const selfKey = self ? JSON.stringify(self) : '';
  useEffect(() => {
    if (channelRef.current && selfRef.current) void channelRef.current.track(selfRef.current).catch(() => undefined);
  }, [selfKey]);

  return entries;
}
