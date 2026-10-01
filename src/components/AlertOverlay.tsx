import { useState } from 'react';
import { ALERT_LABELS } from '../../shared/identity';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { formatClock } from '../lib/platform';
import { supabase } from '../lib/supabase';
import { useRadio } from '../radio/RadioProvider';
import { PinIcon } from './Icons';

export function AlertOverlay() {
  const { t, lang } = useI18n();
  const { member, isLead } = useAuth();
  const { activeAlert: a, dismissAlert } = useRadio();
  const [saving, setSaving] = useState(false);
  if (!a) return null;

  const broadcast = a.kind === 'broadcast';

  const resolve = async () => {
    if (!member) return;
    setSaving(true);
    await supabase.from('alerts').update({ resolved_at: new Date().toISOString(), resolved_by: member.id }).eq('id', a.id);
    setSaving(false);
    dismissAlert();
  };

  return (
    <div className={`overlay${broadcast ? ' overlay-broadcast' : ''}`} role="alertdialog" aria-modal="true" aria-labelledby="alert-title">
      <div className="overlay-inner">
        <span className="overlay-tag">{broadcast ? ALERT_LABELS.broadcast[lang] : t('alertIncoming')}</span>
        <h2 id="alert-title" className="overlay-title">
          {broadcast ? a.callsign : ALERT_LABELS[a.kind][lang]}
        </h2>
        {!broadcast && (
          <p className="overlay-who">
            {a.callsign} · {formatClock(a.created_at, lang)}
          </p>
        )}
        {a.post && (
          <p className="overlay-where">
            <PinIcon /> {a.post}
          </p>
        )}
        {a.message && <p className="overlay-message">{a.message}</p>}
        <div className="overlay-actions">
          {a.lat !== null && a.lng !== null && (
            <a className="btn btn-ghost-light" href={`https://maps.google.com/?q=${a.lat},${a.lng}`} target="_blank" rel="noreferrer">
              {t('openMap')}
            </a>
          )}
          {isLead && !broadcast && !a.resolved_at && (
            <button type="button" className="btn btn-ghost-light" disabled={saving} onClick={() => void resolve()}>
              {t('markResolved')}
            </button>
          )}
          <button type="button" className="btn btn-light" onClick={dismissAlert}>
            {t('acknowledge')}
          </button>
        </div>
      </div>
    </div>
  );
}
