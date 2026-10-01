import { useEffect, useRef, useState } from 'react';
import { ALERT_KINDS, ALERT_LABELS } from '../../../shared/identity';
import type { AlertKind } from '../../../shared/identity';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { vibrate } from '../../lib/platform';
import { callFunction, supabase } from '../../lib/supabase';

const HOLD_MS = 3000;

function getPosition(): Promise<{ lat: number; lng: number } | null> {
  if (!('geolocation' in navigator)) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 30000 },
    );
  });
}

export function EmergencyView({ onClose }: { onClose: () => void }) {
  const { t, lang } = useI18n();
  const { member } = useAuth();
  const [kind, setKind] = useState<AlertKind>('medical');
  const [where, setWhere] = useState(member?.post ?? '');
  const [gps, setGps] = useState(true);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<'ready' | 'sending' | 'sent' | 'failed'>('ready');
  const startRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
  }, []);

  const send = async () => {
    if (!member) return;
    setPhase('sending');
    vibrate([200, 100, 200]);
    const pos = gps ? await getPosition() : null;
    const { data, error } = await supabase
      .from('alerts')
      .insert({
        team_id: member.team_id,
        member_id: member.id,
        callsign: member.callsign,
        kind,
        post: where.trim() || null,
        lat: pos?.lat ?? null,
        lng: pos?.lng ?? null,
      })
      .select('id')
      .single();
    if (error || !data) {
      setPhase('failed');
      return;
    }
    await callFunction('send-alert', { alert_id: data.id }).catch(() => undefined);
    setPhase('sent');
  };

  const tick = () => {
    if (startRef.current === null) return;
    const p = Math.min(1, (performance.now() - startRef.current) / HOLD_MS);
    setProgress(p);
    if (p >= 1) {
      startRef.current = null;
      void send();
      return;
    }
    frameRef.current = requestAnimationFrame(tick);
  };

  const begin = () => {
    if (phase === 'sending' || phase === 'sent') return;
    startRef.current = performance.now();
    vibrate(40);
    frameRef.current = requestAnimationFrame(tick);
  };
  const cancelHold = () => {
    if (startRef.current === null) return;
    startRef.current = null;
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    setProgress(0);
  };

  if (phase === 'sent') {
    return (
      <div className="sos">
        <h2 className="sos-title">{t('sosSent')}</h2>
        <p className="sos-body">{t('sosSentBody')}</p>
        <button type="button" className="btn btn-light btn-block" onClick={onClose}>
          {t('done')}
        </button>
      </div>
    );
  }

  return (
    <div className="sos">
      <div className="sos-head">
        <button type="button" className="btn btn-ghost-light btn-small" onClick={onClose}>
          {t('cancel')}
        </button>
      </div>
      <h2 className="sos-title">{t('sosTitle')}</h2>
      <p className="sos-body">{t('sosBody')}</p>

      <div className="sos-grid" role="radiogroup" aria-label={t('sosTitle')}>
        {ALERT_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            className={`sos-kind${kind === k ? ' is-active' : ''}`}
            onClick={() => setKind(k)}
          >
            {ALERT_LABELS[k][lang]}
          </button>
        ))}
      </div>

      <label className="sos-label" htmlFor="sos-where">
        {t('sosWhere')}
      </label>
      <input id="sos-where" className="input input-danger" value={where} maxLength={80} onChange={(e) => setWhere(e.target.value)} />

      <label className="sos-check">
        <input type="checkbox" checked={gps} onChange={(e) => setGps(e.target.checked)} />
        {t('sosGps')}
      </label>

      {phase === 'failed' && <p className="sos-error" role="alert">{t('sosFailed')}</p>}

      <button
        type="button"
        className="sos-send"
        disabled={phase === 'sending'}
        onPointerDown={(e) => {
          e.preventDefault();
          begin();
        }}
        onPointerUp={cancelHold}
        onPointerLeave={cancelHold}
        onPointerCancel={cancelHold}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
            e.preventDefault();
            begin();
          }
        }}
        onKeyUp={cancelHold}
      >
        <span className="sos-fill" style={{ transform: `scaleX(${progress})` }} aria-hidden />
        <span className="sos-send-label">{phase === 'sending' ? t('sosSending') : t('sosHold')}</span>
      </button>
    </div>
  );
}
