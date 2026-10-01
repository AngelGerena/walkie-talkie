import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { channelName, useI18n } from '../../lib/i18n';
import { callFunction, supabase } from '../../lib/supabase';
import { MEMBER_COLUMNS, Member } from '../../lib/types';
import { useRadio } from '../../radio/RadioProvider';

type Status = 'live' | 'standby' | 'alerts' | 'off' | 'inactive';

export function TeamView() {
  const { t, lang } = useI18n();
  const { member: me, isLead } = useAuth();
  const { presence, channels } = useRadio();
  const [members, setMembers] = useState<Member[]>([]);
  const [pinged, setPinged] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!me) return;
    void supabase
      .from('members')
      .select(MEMBER_COLUMNS)
      .eq('team_id', me.team_id)
      .order('callsign')
      .then(({ data }) => setMembers((data || []) as Member[]));
  }, [me]);

  const statusOf = (m: Member): Status => {
    const p = presence.find((x) => x.member_id === m.id);
    if (p?.channel_id) return 'live';
    if (p) return 'standby';
    if (!m.user_id) return 'inactive';
    if (m.push_enabled) return 'alerts';
    return 'off';
  };

  const label: Record<Status, string> = {
    live: t('statusLive'),
    standby: t('statusStandby'),
    alerts: t('statusAlertsOnly'),
    off: t('statusOff'),
    inactive: t('statusNotActivated'),
  };

  const order: Status[] = ['live', 'standby', 'alerts', 'off', 'inactive'];
  const sorted = [...members].sort((a, b) => order.indexOf(statusOf(a)) - order.indexOf(statusOf(b)));
  const count = (s: Status) => members.filter((m) => statusOf(m) === s).length;

  const ping = async (id: string) => {
    setPinged((p) => ({ ...p, [id]: true }));
    await callFunction('send-alert', { ping_member_id: id }).catch(() => setPinged((p) => ({ ...p, [id]: false })));
  };

  return (
    <div className="screen">
      <h2 className="screen-title">{t('teamTitle')}</h2>
      <div className="stats">
        <div className="stat">
          <span className="stat-num">{count('live')}</span>
          <span className="stat-label">{t('statusLive')}</span>
        </div>
        <div className="stat">
          <span className="stat-num">{count('alerts')}</span>
          <span className="stat-label">{t('statusAlertsOnly')}</span>
        </div>
        <div className="stat">
          <span className="stat-num">{count('off') + count('inactive')}</span>
          <span className="stat-label">{t('statusOff')}</span>
        </div>
      </div>
      <ul className="list">
        {sorted.map((m) => {
          const s = statusOf(m);
          const p = presence.find((x) => x.member_id === m.id);
          const ch = p?.channel_id ? channels.find((c) => c.id === p.channel_id) : null;
          return (
            <li key={m.id} className="member-row">
              <span className={`avatar${m.role === 'lead' ? ' is-lead' : ''}`} aria-hidden>
                {m.callsign.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase()}
              </span>
              <span className="row-main">
                <span className="row-title">
                  {m.callsign}
                  {m.id === me?.id && ` · ${t('you')}`}
                </span>
                <span className="row-sub">{[m.post, ch ? channelName(ch, lang) : null].filter(Boolean).join(' · ')}</span>
              </span>
              <span className={`row-status status-${s}`}>{p?.talking ? 'TX' : label[s]}</span>
              {isLead && m.id !== me?.id && m.push_enabled && s !== 'live' && (
                <button type="button" className="btn btn-small" disabled={pinged[m.id]} onClick={() => void ping(m.id)}>
                  {pinged[m.id] ? t('pinged') : t('ping')}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
