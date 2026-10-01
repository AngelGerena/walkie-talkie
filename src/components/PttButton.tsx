import { KeyboardEvent, PointerEvent, useRef } from 'react';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { useRadio } from '../radio/RadioProvider';
import { MicIcon } from './Icons';

export function PttButton() {
  const { t } = useI18n();
  const { isLead } = useAuth();
  const { onDuty, conn, floor, talking, startTalk, stopTalk, goOnDuty } = useRadio();
  const pressing = useRef(false);

  const busy = !!floor && !floor.self && !(isLead && !floor.lead);
  const ready = onDuty && conn === 'on';

  const press = async () => {
    if (!ready || pressing.current) return;
    pressing.current = true;
    const ok = await startTalk();
    if (!ok) pressing.current = false;
    else if (!pressing.current) void stopTalk();
  };
  const release = () => {
    if (!pressing.current) return;
    pressing.current = false;
    void stopTalk();
  };

  if (!onDuty) {
    return (
      <button type="button" className="ptt" onClick={() => void goOnDuty()}>
        <span className="ptt-label">{t('pttGoOnDuty')}</span>
      </button>
    );
  }

  let label = t('pttHold');
  if (conn === 'connecting' || conn === 'reconnecting') label = t('pttConnecting');
  else if (talking) label = t('pttRelease');
  else if (busy) label = t('pttBusy');

  return (
    <button
      type="button"
      className={`ptt${talking ? ' is-talking' : ''}${busy ? ' is-busy' : ''}`}
      disabled={!ready}
      aria-pressed={talking}
      onPointerDown={(e: PointerEvent<HTMLButtonElement>) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture?.(e.pointerId);
        void press();
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e: KeyboardEvent<HTMLButtonElement>) => {
        if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
          e.preventDefault();
          void press();
        }
      }}
      onKeyUp={(e: KeyboardEvent<HTMLButtonElement>) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          release();
        }
      }}
    >
      <MicIcon size={30} />
      <span className="ptt-label">{label}</span>
    </button>
  );
}
