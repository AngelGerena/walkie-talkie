import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ALERT_LABELS } from '../../shared/identity';
import { useAuth } from '../lib/auth';
import { playTransmission, useTeamFeed } from '../lib/feed';
import { formatClock, formatDuration } from '../lib/platform';
import { useTeamPresence } from '../lib/presence';
import { callFunction, supabase } from '../lib/supabase';
import { CHANNEL_COLUMNS, Channel, MEMBER_COLUMNS, Member, Transmission } from '../lib/types';
import { PlayIcon } from '../components/Icons';

type Section = 'live' | 'members' | 'channels' | 'incidents' | 'team';

interface Issued {
  callsign: string;
  team_code: string;
  code: string;
  expires_at: string;
}

function englishText(tx: Transmission): string {
  if (tx.status === 'pending') return 'Transcribing';
  if (!tx.transcript) return tx.status === 'skipped' ? 'No transcript' : '';
  if (tx.transcript_lang === 'es' && tx.translation) return `${tx.translation} (ES)`;
  return tx.transcript;
}

export function Command() {
  const { member, team, isLead } = useAuth();
  const [section, setSection] = useState<Section>('live');
  const [members, setMembers] = useState<Member[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const { transmissions, alerts } = useTeamFeed(member?.team_id);
  const presence = useTeamPresence(member?.team_id, null);

  const loadMembers = useCallback(async () => {
    if (!member) return;
    const { data } = await supabase.from('members').select(MEMBER_COLUMNS).eq('team_id', member.team_id).order('callsign');
    setMembers((data || []) as Member[]);
  }, [member]);

  const loadChannels = useCallback(async () => {
    if (!member) return;
    const { data } = await supabase.from('channels').select(CHANNEL_COLUMNS).eq('team_id', member.team_id).order('sort');
    setChannels((data || []) as Channel[]);
  }, [member]);

  useEffect(() => {
    void loadMembers();
    void loadChannels();
  }, [loadMembers, loadChannels]);

  if (!isLead) {
    return (
      <div className="cmd-denied">
        <h1>Team leads only</h1>
        <p>The command dashboard is for team leads. Ask your lead if you need access.</p>
        <Link className="btn" to="/">
          Back to the radio
        </Link>
      </div>
    );
  }

  const nav: { id: Section; label: string }[] = [
    { id: 'live', label: 'Live command' },
    { id: 'incidents', label: 'Incidents' },
    { id: 'members', label: 'Team members' },
    { id: 'channels', label: 'Channels' },
    { id: 'team', label: 'Team settings' },
  ];

  return (
    <div className="cmd">
      <aside className="cmd-side">
        <div className="cmd-brand">
          <span className="cmd-model">FIELD UNIT</span>
          <span className="cmd-church">{team?.church_name}</span>
        </div>
        <nav className="cmd-nav" aria-label="Command sections">
          {nav.map((n) => (
            <button
              key={n.id}
              type="button"
              className={section === n.id ? 'is-active' : ''}
              aria-current={section === n.id ? 'page' : undefined}
              onClick={() => setSection(n.id)}
            >
              {n.label}
            </button>
          ))}
        </nav>
        <Link className="btn btn-block" to="/">
          Open the radio
        </Link>
      </aside>
      <main className="cmd-main">
        {section === 'live' && (
          <LiveSection members={members} channels={channels} presence={presence} transmissions={transmissions} alerts={alerts} reloadMembers={loadMembers} />
        )}
        {section === 'incidents' && <IncidentsSection alerts={alerts} />}
        {section === 'members' && <MembersSection members={members} reload={loadMembers} />}
        {section === 'channels' && <ChannelsSection channels={channels} reload={loadChannels} />}
        {section === 'team' && <TeamSection />}
      </main>
    </div>
  );
}

// ---------- Live ----------

function LiveSection({
  members,
  channels,
  presence,
  transmissions,
  alerts,
  reloadMembers,
}: {
  members: Member[];
  channels: Channel[];
  presence: ReturnType<typeof useTeamPresence>;
  transmissions: Transmission[];
  alerts: ReturnType<typeof useTeamFeed>['alerts'];
  reloadMembers: () => Promise<void>;
}) {
  const { member, team } = useAuth();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [posts, setPosts] = useState<Record<string, string>>({});

  const today = new Date().toDateString();
  const onDuty = presence.filter((p) => p.channel_id).length;
  const activated = members.filter((m) => m.user_id).length;
  const txToday = transmissions.filter((t) => new Date(t.started_at).toDateString() === today).length;
  const openIncidents = alerts.filter((a) => a.kind !== 'broadcast' && !a.resolved_at).length;
  const chName = (id: string | null) => channels.find((c) => c.id === id)?.name_en ?? '';

  const broadcast = async (e: FormEvent) => {
    e.preventDefault();
    if (!member || !message.trim()) return;
    setSending(true);
    setNote(null);
    const { data, error } = await supabase
      .from('alerts')
      .insert({ team_id: member.team_id, member_id: member.id, callsign: member.callsign, kind: 'broadcast', message: message.trim() })
      .select('id')
      .single();
    if (error || !data) {
      setNote('The broadcast could not be saved. Try again.');
    } else {
      const r = await callFunction<{ sent: number }>('send-alert', { alert_id: data.id }).catch(() => null);
      setNote(r ? `Broadcast sent to ${r.sent} phone${r.sent === 1 ? '' : 's'} and shown to everyone with the app open.` : 'Shown in the app. Push delivery failed.');
      setMessage('');
    }
    setSending(false);
  };

  const savePost = async (m: Member) => {
    const value = (posts[m.id] ?? m.post ?? '').trim() || null;
    await supabase.from('members').update({ post: value }).eq('id', m.id);
    setPosts((p) => {
      const n = { ...p };
      delete n[m.id];
      return n;
    });
    await reloadMembers();
  };

  return (
    <>
      <header className="cmd-head">
        <div>
          <p className="cmd-live">Live now</p>
          <h1 className="cmd-title">{team?.team_name}</h1>
        </div>
      </header>

      <div className="cmd-stats">
        <div className="cmd-stat">
          <span>On duty</span>
          <strong>
            {onDuty} / {activated}
          </strong>
        </div>
        <div className="cmd-stat">
          <span>Calls today</span>
          <strong>{txToday}</strong>
        </div>
        <div className={`cmd-stat${openIncidents ? ' is-danger' : ''}`}>
          <span>Open incidents</span>
          <strong>{openIncidents}</strong>
        </div>
        <div className="cmd-stat">
          <span>Talking now</span>
          <strong>{presence.find((p) => p.talking)?.callsign ?? 'Nobody'}</strong>
        </div>
      </div>

      <div className="cmd-grid">
        <section className="cmd-panel cmd-span2">
          <h2>Live call feed</h2>
          {transmissions.length === 0 ? (
            <p className="empty">Calls appear here the moment someone releases the talk button.</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Unit</th>
                    <th>Channel</th>
                    <th>Transcript</th>
                    <th>
                      <span className="sr-only">Play</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {transmissions.slice(0, 25).map((t) => (
                    <tr key={t.id}>
                      <td className="mono">{formatClock(t.started_at, 'en')}</td>
                      <td>{t.callsign}</td>
                      <td>{chName(t.channel_id)}</td>
                      <td>
                        {englishText(t)} <span className="muted">{formatDuration(t.duration_ms)}</span>
                      </td>
                      <td>
                        {t.audio_path && (
                          <button type="button" className="play-btn" aria-label={`Play call from ${t.callsign}`} onClick={() => void playTransmission(t).catch(() => undefined)}>
                            <PlayIcon />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="cmd-panel">
          <h2>Team broadcast</h2>
          <form onSubmit={(e) => void broadcast(e)} className="form">
            <label htmlFor="bc-msg" className="sr-only">
              Message to the whole team
            </label>
            <textarea
              id="bc-msg"
              className="input"
              rows={3}
              maxLength={200}
              placeholder="Doors close in 5 minutes. All units to posts."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <button type="submit" className="btn btn-block" disabled={sending || !message.trim()}>
              Send to every phone
            </button>
            {note && <p className="muted">{note}</p>}
          </form>
        </section>

        <section className="cmd-panel cmd-span3">
          <h2>Posts and status</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Unit</th>
                  <th>Status</th>
                  <th>Channel</th>
                  <th>Post</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const p = presence.find((x) => x.member_id === m.id);
                  const status = p?.talking
                    ? 'Talking'
                    : p?.channel_id
                      ? 'On duty'
                      : p
                        ? 'App open'
                        : !m.user_id
                          ? 'Not activated'
                          : m.push_enabled
                            ? 'Alerts only'
                            : 'Offline';
                  return (
                    <tr key={m.id}>
                      <td>
                        {m.callsign}
                        {m.role === 'lead' && <span className="tag">Lead</span>}
                      </td>
                      <td>{status}</td>
                      <td>{chName(p?.channel_id ?? null)}</td>
                      <td>
                        <div className="inline-form">
                          <label htmlFor={`post-${m.id}`} className="sr-only">
                            Post for {m.callsign}
                          </label>
                          <input
                            id={`post-${m.id}`}
                            className="input input-compact"
                            value={posts[m.id] ?? m.post ?? ''}
                            onChange={(e) => setPosts((s) => ({ ...s, [m.id]: e.target.value }))}
                          />
                          {posts[m.id] !== undefined && posts[m.id] !== (m.post ?? '') && (
                            <button type="button" className="btn btn-small" onClick={() => void savePost(m)}>
                              Save
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}

// ---------- Incidents ----------

function IncidentsSection({ alerts }: { alerts: ReturnType<typeof useTeamFeed>['alerts'] }) {
  const { member } = useAuth();
  const list = alerts.filter((a) => a.kind !== 'broadcast');
  const resolve = async (id: string) => {
    if (!member) return;
    await supabase.from('alerts').update({ resolved_at: new Date().toISOString(), resolved_by: member.id }).eq('id', id);
  };
  return (
    <>
      <header className="cmd-head">
        <h1 className="cmd-title">Incidents</h1>
      </header>
      <section className="cmd-panel">
        {list.length === 0 ? (
          <p className="empty">No SOS alerts yet. When someone holds the SOS key, the incident lands here for follow-up.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Type</th>
                  <th>Unit</th>
                  <th>Where</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {list.map((a) => (
                  <tr key={a.id} className={a.resolved_at ? '' : 'row-open'}>
                    <td className="mono">
                      {new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} {formatClock(a.created_at, 'en')}
                    </td>
                    <td>{ALERT_LABELS[a.kind].en}</td>
                    <td>{a.callsign}</td>
                    <td>
                      {a.post}
                      {a.lat !== null && a.lng !== null && (
                        <>
                          {' '}
                          <a href={`https://maps.google.com/?q=${a.lat},${a.lng}`} target="_blank" rel="noreferrer">
                            Map
                          </a>
                        </>
                      )}
                    </td>
                    <td>
                      {a.resolved_at ? (
                        `Resolved ${formatClock(a.resolved_at, 'en')}`
                      ) : (
                        <button type="button" className="btn btn-small" onClick={() => void resolve(a.id)}>
                          Mark resolved
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

// ---------- Members ----------

function MembersSection({ members, reload }: { members: Member[]; reload: () => Promise<void> }) {
  const { member: me } = useAuth();
  const [callsign, setCallsign] = useState('');
  const [role, setRole] = useState<'member' | 'lead'>('member');
  const [post, setPost] = useState('');
  const [issued, setIssued] = useState<Issued | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (body: Record<string, unknown>, showCode = false) => {
    setBusy(true);
    setError(null);
    try {
      const r = await callFunction<Issued>('admin-members', body);
      if (showCode) setIssued(r);
      await reload();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (await run({ action: 'create', callsign, role, post }, true)) {
      setCallsign('');
      setPost('');
      setRole('member');
    }
  };

  const shareText = issued
    ? `Security Detail Radio\nOpen ${window.location.origin} on your phone and tap "First time here".\nTeam code: ${issued.team_code}\nCallsign: ${issued.callsign}\nActivation code: ${issued.code}\nThe code works once and expires ${new Date(issued.expires_at).toLocaleDateString('en-US')}.`
    : '';

  return (
    <>
      <header className="cmd-head">
        <h1 className="cmd-title">Team members</h1>
      </header>

      {issued && (
        <section className="cmd-panel cmd-issued" aria-live="polite">
          <h2>Activation code for {issued.callsign}</h2>
          <p className="issued-code">{issued.code}</p>
          <p className="muted">
            Shown once. Send it to them privately. They pick their own PIN when they activate. Expires{' '}
            {new Date(issued.expires_at).toLocaleDateString('en-US')}.
          </p>
          <div className="inline-form">
            <button type="button" className="btn btn-small" onClick={() => void navigator.clipboard?.writeText(shareText)}>
              Copy instructions
            </button>
            <button type="button" className="btn btn-small btn-ghost" onClick={() => setIssued(null)}>
              Done
            </button>
          </div>
        </section>
      )}

      <section className="cmd-panel">
        <h2>Add a member</h2>
        <form className="cmd-form" onSubmit={(e) => void add(e)}>
          <div className="field">
            <label htmlFor="m-call">Callsign</label>
            <input id="m-call" className="input" value={callsign} maxLength={24} onChange={(e) => setCallsign(e.target.value)} placeholder="Unit 8" required />
          </div>
          <div className="field">
            <label htmlFor="m-post">Post</label>
            <input id="m-post" className="input" value={post} maxLength={60} onChange={(e) => setPost(e.target.value)} placeholder="Front doors" />
          </div>
          <div className="field">
            <label htmlFor="m-role">Role</label>
            <select id="m-role" className="input" value={role} onChange={(e) => setRole(e.target.value as 'member' | 'lead')}>
              <option value="member">Member</option>
              <option value="lead">Team lead</option>
            </select>
          </div>
          <button type="submit" className="btn" disabled={busy}>
            Add and get code
          </button>
        </form>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
      </section>

      <section className="cmd-panel">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Callsign</th>
                <th>Role</th>
                <th>Account</th>
                <th>Alerts</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <MemberRow key={m.id} m={m} isMe={m.id === me?.id} busy={busy} run={run} />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function MemberRow({
  m,
  isMe,
  busy,
  run,
}: {
  m: Member;
  isMe: boolean;
  busy: boolean;
  run: (body: Record<string, unknown>, showCode?: boolean) => Promise<boolean>;
}) {
  const [name, setName] = useState(m.callsign);
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => setName(m.callsign), [m.callsign]);

  return (
    <tr>
      <td>
        <div className="inline-form">
          <label htmlFor={`cs-${m.id}`} className="sr-only">
            Callsign
          </label>
          <input id={`cs-${m.id}`} className="input input-compact" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} />
          {name.trim() && name.trim() !== m.callsign && (
            <button type="button" className="btn btn-small" disabled={busy} onClick={() => void run({ action: 'update', member_id: m.id, callsign: name.trim() })}>
              Rename
            </button>
          )}
        </div>
      </td>
      <td>
        <label htmlFor={`role-${m.id}`} className="sr-only">
          Role
        </label>
        <select
          id={`role-${m.id}`}
          className="input input-compact"
          value={m.role}
          disabled={busy || isMe}
          onChange={(e) => void run({ action: 'update', member_id: m.id, role: e.target.value })}
        >
          <option value="member">Member</option>
          <option value="lead">Team lead</option>
        </select>
      </td>
      <td>{m.user_id ? 'Activated' : m.invite_expires_at ? `Code expires ${new Date(m.invite_expires_at).toLocaleDateString('en-US')}` : 'Not activated'}</td>
      <td>{m.push_enabled ? 'On' : 'Off'}</td>
      <td>
        <div className="inline-form">
          <button type="button" className="btn btn-small" disabled={busy} onClick={() => void run({ action: 'reset', member_id: m.id }, true)}>
            {m.user_id ? 'Reset PIN' : 'New code'}
          </button>
          {!isMe &&
            (confirmDelete ? (
              <>
                <button type="button" className="btn btn-small btn-danger" disabled={busy} onClick={() => void run({ action: 'delete', member_id: m.id })}>
                  Confirm remove
                </button>
                <button type="button" className="btn btn-small btn-ghost" onClick={() => setConfirmDelete(false)}>
                  Keep
                </button>
              </>
            ) : (
              <button type="button" className="btn btn-small btn-ghost" onClick={() => setConfirmDelete(true)}>
                Remove
              </button>
            ))}
        </div>
      </td>
    </tr>
  );
}

// ---------- Channels ----------

function ChannelsSection({ channels, reload }: { channels: Channel[]; reload: () => Promise<void> }) {
  const { member } = useAuth();
  const [nameEn, setNameEn] = useState('');
  const [nameEs, setNameEs] = useState('');
  const [error, setError] = useState<string | null>(null);
  const nextSort = useMemo(() => (channels.length ? Math.max(...channels.map((c) => c.sort)) + 1 : 1), [channels]);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!member) return;
    setError(null);
    const { error: err } = await supabase
      .from('channels')
      .insert({ team_id: member.team_id, name_en: nameEn.trim(), name_es: nameEs.trim() || nameEn.trim(), sort: nextSort });
    if (err) setError(err.message);
    else {
      setNameEn('');
      setNameEs('');
      await reload();
    }
  };

  const update = async (id: string, patch: Partial<Channel>) => {
    const { error: err } = await supabase.from('channels').update(patch).eq('id', id);
    if (err) setError(err.message);
    await reload();
  };

  const remove = async (id: string) => {
    const { error: err } = await supabase.from('channels').delete().eq('id', id);
    if (err) setError(err.message);
    await reload();
  };

  const move = async (index: number, dir: -1 | 1) => {
    const a = channels[index];
    const b = channels[index + dir];
    if (!a || !b) return;
    await supabase.from('channels').update({ sort: b.sort }).eq('id', a.id);
    await supabase.from('channels').update({ sort: a.sort }).eq('id', b.id);
    await reload();
  };

  return (
    <>
      <header className="cmd-head">
        <h1 className="cmd-title">Channels</h1>
      </header>
      <section className="cmd-panel">
        <h2>Add a channel</h2>
        <form className="cmd-form" onSubmit={(e) => void add(e)}>
          <div className="field">
            <label htmlFor="c-en">Name in English</label>
            <input id="c-en" className="input" value={nameEn} maxLength={40} onChange={(e) => setNameEn(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="c-es">Name in Spanish</label>
            <input id="c-es" className="input" value={nameEs} maxLength={40} onChange={(e) => setNameEs(e.target.value)} />
          </div>
          <button type="submit" className="btn">
            Add channel
          </button>
        </form>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
      </section>
      <section className="cmd-panel">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>CH</th>
                <th>English</th>
                <th>Spanish</th>
                <th>Leads only</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {channels.map((c, i) => (
                <ChannelRow key={c.id} c={c} index={i} last={i === channels.length - 1} update={update} remove={remove} move={move} />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function ChannelRow({
  c,
  index,
  last,
  update,
  remove,
  move,
}: {
  c: Channel;
  index: number;
  last: boolean;
  update: (id: string, patch: Partial<Channel>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  move: (index: number, dir: -1 | 1) => Promise<void>;
}) {
  const [en, setEn] = useState(c.name_en);
  const [es, setEs] = useState(c.name_es);
  const [confirm, setConfirm] = useState(false);
  const dirty = en.trim() !== c.name_en || es.trim() !== c.name_es;
  return (
    <tr>
      <td className="mono">{String(index + 1).padStart(2, '0')}</td>
      <td>
        <label htmlFor={`en-${c.id}`} className="sr-only">
          English name
        </label>
        <input id={`en-${c.id}`} className="input input-compact" value={en} onChange={(e) => setEn(e.target.value)} />
      </td>
      <td>
        <label htmlFor={`es-${c.id}`} className="sr-only">
          Spanish name
        </label>
        <input id={`es-${c.id}`} className="input input-compact" value={es} onChange={(e) => setEs(e.target.value)} />
      </td>
      <td>
        <input type="checkbox" aria-label={`Leads only for ${c.name_en}`} checked={c.leads_only} onChange={(e) => void update(c.id, { leads_only: e.target.checked })} />
      </td>
      <td>
        <div className="inline-form">
          {dirty && (
            <button type="button" className="btn btn-small" onClick={() => void update(c.id, { name_en: en.trim(), name_es: es.trim() || en.trim() })}>
              Save
            </button>
          )}
          <button type="button" className="btn btn-small btn-ghost" disabled={index === 0} onClick={() => void move(index, -1)} aria-label={`Move ${c.name_en} up`}>
            Up
          </button>
          <button type="button" className="btn btn-small btn-ghost" disabled={last} onClick={() => void move(index, 1)} aria-label={`Move ${c.name_en} down`}>
            Down
          </button>
          {confirm ? (
            <button type="button" className="btn btn-small btn-danger" onClick={() => void remove(c.id)}>
              Confirm delete
            </button>
          ) : (
            <button type="button" className="btn btn-small btn-ghost" onClick={() => setConfirm(true)}>
              Delete
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ---------- Team settings ----------

function TeamSection() {
  const { team, reload } = useAuth();
  const [church, setChurch] = useState(team?.church_name ?? '');
  const [name, setName] = useState(team?.team_name ?? '');
  const [note, setNote] = useState<string | null>(null);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!team) return;
    const { error } = await supabase.from('teams').update({ church_name: church.trim(), team_name: name.trim() }).eq('id', team.id);
    setNote(error ? error.message : 'Saved.');
    if (!error) reload();
  };

  return (
    <>
      <header className="cmd-head">
        <h1 className="cmd-title">Team settings</h1>
      </header>
      <section className="cmd-panel">
        <form className="form" onSubmit={(e) => void save(e)}>
          <div className="field">
            <label htmlFor="t-church">Church name</label>
            <input id="t-church" className="input" value={church} onChange={(e) => setChurch(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="t-name">Team name</label>
            <input id="t-name" className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field">
            <span className="field-label">Team code</span>
            <p className="issued-code issued-code-small">{team?.code}</p>
          </div>
          <button type="submit" className="btn">
            Save changes
          </button>
          {note && <p className="muted">{note}</p>}
        </form>
      </section>
    </>
  );
}
