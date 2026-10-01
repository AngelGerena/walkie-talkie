import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { MEMBER_COLUMNS, Member, Team } from './types';

type Status = 'loading' | 'signed-out' | 'no-member' | 'ready' | 'error';

interface AuthValue {
  status: Status;
  session: Session | null;
  member: Member | null;
  team: Team | null;
  error: string | null;
  isLead: boolean;
  reload: () => void;
  patchMember: (patch: Partial<Member>) => void;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthValue | null>(null);
const LOAD_TIMEOUT_MS = 10000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [session, setSession] = useState<Session | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const load = useCallback(async (s: Session | null) => {
    const mine = ++seq.current;
    setSession(s);
    if (!s) {
      setMember(null);
      setTeam(null);
      setStatus('signed-out');
      return;
    }
    const timer = setTimeout(() => {
      if (seq.current === mine) {
        setError('Could not reach the server. Check your signal and try again.');
        setStatus('error');
      }
    }, LOAD_TIMEOUT_MS);
    try {
      const { data: m, error: mErr } = await supabase
        .from('members')
        .select(MEMBER_COLUMNS)
        .eq('user_id', s.user.id)
        .maybeSingle();
      if (mErr) throw mErr;
      if (seq.current !== mine) return;
      if (!m) {
        setMember(null);
        setTeam(null);
        setStatus('no-member');
        return;
      }
      const { data: t, error: tErr } = await supabase
        .from('teams')
        .select('id, church_name, team_name, code')
        .eq('id', (m as Member).team_id)
        .single();
      if (tErr) throw tErr;
      if (seq.current !== mine) return;
      setMember(m as Member);
      setTeam(t as Team);
      setError(null);
      setStatus('ready');
    } catch (e) {
      if (seq.current !== mine) return;
      setError(e instanceof Error ? e.message : 'Could not load your team.');
      setStatus('error');
    } finally {
      clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => void load(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      // Never await Supabase calls inside this callback: it holds a lock.
      if (event === 'TOKEN_REFRESHED') {
        setSession(s);
        return;
      }
      setTimeout(() => void load(s), 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [load]);

  const reload = useCallback(() => {
    setStatus('loading');
    supabase.auth.getSession().then(({ data }) => void load(data.session));
  }, [load]);

  const patchMember = useCallback((patch: Partial<Member>) => {
    setMember((m) => (m ? { ...m, ...patch } : m));
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return (
    <Ctx.Provider
      value={{ status, session, member, team, error, isLead: member?.role === 'lead', reload, patchMember, signOut }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}
