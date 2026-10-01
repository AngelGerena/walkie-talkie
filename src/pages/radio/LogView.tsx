import { useMemo, useState } from 'react';
import { ALERT_LABELS } from '../../../shared/identity';
import { playTransmission } from '../../lib/feed';
import { channelName, useI18n } from '../../lib/i18n';
import { formatClock, formatDuration } from '../../lib/platform';
import type { Alert, Transmission } from '../../lib/types';
import { useRadio } from '../../radio/RadioProvider';
import { PlayIcon } from '../../components/Icons';
import { Transcript } from './Transcript';

type Filter = 'all' | 'channel' | 'alerts';
type Item = { kind: 'tx'; at: string; tx: Transmission } | { kind: 'alert'; at: string; alert: Alert };

export function LogView() {
  const { t, lang } = useI18n();
  const { transmissions, alerts, channel, channels } = useRadio();
  const [filter, setFilter] = useState<Filter>('all');
  const [err, setErr] = useState<string | null>(null);

  const items = useMemo(() => {
    const list: Item[] = [];
    if (filter !== 'alerts') {
      for (const tx of transmissions) {
        if (filter === 'channel' && tx.channel_id !== channel?.id) continue;
        list.push({ kind: 'tx', at: tx.started_at, tx });
      }
    }
    if (filter !== 'channel') for (const a of alerts) list.push({ kind: 'alert', at: a.created_at, alert: a });
    return list.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 80);
  }, [transmissions, alerts, filter, channel?.id]);

  const chName = (id: string) => {
    const c = channels.find((x) => x.id === id);
    return c ? channelName(c, lang) : '';
  };

  const filters: { id: Filter; label: string }[] = [
    { id: 'all', label: t('filterAll') },
    { id: 'channel', label: t('filterChannel') },
    { id: 'alerts', label: t('filterAlerts') },
  ];

  return (
    <div className="screen">
      <h2 className="screen-title">{t('logTitle')}</h2>
      <div className="chips" role="group" aria-label={t('logTitle')}>
        {filters.map((f) => (
          <button key={f.id} type="button" className={`chip${filter === f.id ? ' is-active' : ''}`} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>
      {err && <p className="field-error">{err}</p>}
      {items.length === 0 && <p className="empty">{t('emptyLog')}</p>}
      <ul className="list">
        {items.map((it) =>
          it.kind === 'alert' ? (
            <li key={`a-${it.alert.id}`} className="log-item log-alert">
              <div className="tx-head">
                <span className="tx-who">
                  {it.alert.kind === 'broadcast' ? ALERT_LABELS.broadcast[lang] : `SOS · ${ALERT_LABELS[it.alert.kind][lang]}`} · {it.alert.callsign}
                </span>
                <span className="tx-meta">{formatClock(it.at, lang)}</span>
              </div>
              {it.alert.post && <p className="tx-text">{it.alert.post}</p>}
              {it.alert.message && <p className="tx-text">{it.alert.message}</p>}
              {it.alert.kind !== 'broadcast' && (
                <p className="tx-original">{it.alert.resolved_at ? t('resolved') : t('openStatus')}</p>
              )}
            </li>
          ) : (
            <li key={`t-${it.tx.id}`} className="log-item">
              {it.tx.audio_path ? (
                <button
                  type="button"
                  className="play-btn"
                  aria-label={`${t('play')} ${it.tx.callsign}`}
                  onClick={() => {
                    setErr(null);
                    playTransmission(it.tx).catch((e: Error) => setErr(e.message));
                  }}
                >
                  <PlayIcon />
                </button>
              ) : (
                <span className="play-btn is-empty" aria-hidden />
              )}
              <div className="log-body">
                <div className="tx-head">
                  <span className="tx-who">
                    {it.tx.callsign} · {chName(it.tx.channel_id)}
                  </span>
                  <span className="tx-meta">
                    {formatClock(it.at, lang)} · {formatDuration(it.tx.duration_ms)}
                  </span>
                </div>
                <Transcript tx={it.tx} />
              </div>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
