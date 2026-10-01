import { useState } from 'react';
import { useAuth } from '../../lib/auth';
import { playTransmission } from '../../lib/feed';
import { channelName, useI18n } from '../../lib/i18n';
import { formatClock, formatDuration } from '../../lib/platform';
import { useRadio } from '../../radio/RadioProvider';
import { PlayIcon } from '../../components/Icons';
import { Transcript } from './Transcript';

export function TalkView() {
  const { t, lang } = useI18n();
  const { isLead } = useAuth();
  const { channel, onDuty, conn, connError, needsAudio, unlockAudio, floor, transmissions, goOffDuty } = useRadio();
  const [playErr, setPlayErr] = useState<string | null>(null);

  const last = transmissions.find((x) => x.channel_id === channel?.id);
  const rx = floor && !floor.self ? floor : null;

  return (
    <div className="grille">
      <div className="grille-content">
        {!onDuty && (
          <div className="card">
            <h2 className="card-title">{t('offDutyTitle')}</h2>
            <p className="card-body">{t('offDutyBody', { channel: channel ? channelName(channel, lang) : '' })}</p>
          </div>
        )}

        {connError && (
          <div className="card card-danger" role="alert">
            <p className="card-body">{connError === 'mic' ? t('errorMic') : connError === 'generic' ? t('errorGeneric') : connError}</p>
          </div>
        )}

        {onDuty && needsAudio && (
          <button type="button" className="btn btn-block" onClick={() => void unlockAudio()}>
            {t('speakerOff')}
          </button>
        )}

        {rx && (
          <div className="card card-rx" aria-live="assertive">
            <p className="rx-label">RX</p>
            <p className="rx-who">{t('nowTalking', { callsign: rx.callsign })}</p>
            {isLead && !rx.lead && <p className="card-body">{t('leadOverride')}</p>}
          </div>
        )}

        {last && (
          <div className="card">
            <div className="tx-head">
              <span className="tx-who">
                {t('lastCall')}: {last.callsign}
              </span>
              <span className="tx-meta">
                {formatClock(last.started_at, lang)} · {formatDuration(last.duration_ms)}
              </span>
            </div>
            <Transcript tx={last} />
            {last.audio_path && (
              <button
                type="button"
                className="btn btn-small"
                onClick={() => {
                  setPlayErr(null);
                  playTransmission(last).catch((e: Error) => setPlayErr(e.message));
                }}
              >
                <PlayIcon /> {t('play')}
              </button>
            )}
            {playErr && <p className="field-error">{playErr}</p>}
          </div>
        )}

        {onDuty && conn === 'on' && !last && !rx && <p className="grille-note">{t('noCalls')}</p>}

        {onDuty && (
          <button type="button" className="link-btn" onClick={() => void goOffDuty()}>
            {t('goOffDuty')}
          </button>
        )}
      </div>
    </div>
  );
}
