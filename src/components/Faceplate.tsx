import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { setSetting, useSettings } from '../lib/settings';
import { useRadio } from '../radio/RadioProvider';

interface Props {
  onChannelKnob: () => void;
}

export function Faceplate({ onChannelKnob }: Props) {
  const { t } = useI18n();
  const { team } = useAuth();
  const { channelIndex, talking, floor } = useRadio();
  const { muted } = useSettings();
  const rx = !!floor && !floor.self;
  const chAngle = -120 + Math.max(0, channelIndex) * 40;

  return (
    <header className="faceplate">
      <div className="knob-wrap">
        <button type="button" className="knob" onClick={onChannelKnob} aria-label={t('channelsTitle')}>
          <span className="knob-tick" style={{ transform: `rotate(${chAngle}deg)` }} />
        </button>
        <span className="knob-label">{t('knobCh')}</span>
      </div>

      <div className="plate">
        <div className="leds" aria-hidden>
          <span className={`led led-tx${talking ? ' is-on' : ''}`} />
          <span className={`led led-rx${rx ? ' is-on' : ''}`} />
        </div>
        <span className="plate-model">FIELD UNIT</span>
        <span className="plate-team">{team?.team_name || 'Security Detail'}</span>
      </div>

      <div className="knob-wrap">
        <button
          type="button"
          className="knob"
          onClick={() => setSetting('muted', !muted)}
          aria-pressed={muted}
          aria-label={muted ? `${t('knobVol')}: ${t('muted')}` : t('knobVol')}
        >
          <span className="knob-tick" style={{ transform: `rotate(${muted ? -135 : 45}deg)` }} />
        </button>
        <span className="knob-label">{muted ? t('muted') : t('knobVol')}</span>
      </div>
    </header>
  );
}
