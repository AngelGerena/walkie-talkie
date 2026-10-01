import { useEffect, useState } from 'react';
import { channelName, useI18n } from '../lib/i18n';
import { pad2 } from '../lib/platform';
import { useRadio } from '../radio/RadioProvider';

interface BatteryLike {
  level: number;
  addEventListener: (e: string, cb: () => void) => void;
  removeEventListener: (e: string, cb: () => void) => void;
}

function useBattery(): number | null {
  const [level, setLevel] = useState<number | null>(null);
  useEffect(() => {
    const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryLike> };
    if (!nav.getBattery) return;
    let battery: BatteryLike | null = null;
    const update = () => battery && setLevel(Math.round(battery.level * 100));
    nav
      .getBattery()
      .then((b) => {
        battery = b;
        update();
        b.addEventListener('levelchange', update);
      })
      .catch(() => undefined);
    return () => battery?.removeEventListener('levelchange', update);
  }, []);
  return level;
}

function useTicker(active: boolean): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [active]);
  return now;
}

export function Lcd() {
  const { t, lang } = useI18n();
  const { channel, channelIndex, conn, onDuty, floor, talking, talkStartedAt, unitsHere } = useRadio();
  const battery = useBattery();
  const now = useTicker(talking);
  const rx = !!floor && !floor.self;

  const bars = conn === 'on' ? 4 : conn === 'reconnecting' ? 1 : conn === 'connecting' ? 2 : 0;
  const elapsed = talkStartedAt ? Math.floor((now - talkStartedAt) / 1000) : 0;

  let status: string;
  if (!onDuty) status = t('lcdOffDuty');
  else if (conn === 'connecting') status = t('lcdConnecting');
  else if (conn === 'reconnecting') status = t('lcdReconnecting');
  else if (conn === 'error') status = t('lcdError');
  else if (talking) status = `TX ${pad2(Math.floor(elapsed / 60))}:${pad2(elapsed % 60)}`;
  else if (rx && floor) status = `RX ${floor.callsign.toUpperCase()}`;
  else status = t('lcdClear');

  return (
    <section className={`lcd${rx ? ' lcd-rx' : ''}`} aria-live="polite" aria-label="Radio display">
      <div className="lcd-row lcd-small">
        <span className="lcd-sig">
          {t('lcdSig')}
          <span className="sig-bars" aria-hidden>
            {[1, 2, 3, 4].map((n) => (
              <span key={n} className={`sig-bar${n <= bars ? ' on' : ''}`} style={{ height: 4 + n * 4 }} />
            ))}
          </span>
        </span>
        {battery !== null && (
          <span>
            {t('lcdBat')} {battery}%
          </span>
        )}
      </div>
      <div className="lcd-row lcd-main">
        <span className="lcd-ch">CH {pad2(channelIndex + 1)}</span>
        <span className="lcd-name">{channel ? channelName(channel, lang).toUpperCase() : '--'}</span>
      </div>
      <div className="lcd-row lcd-small">
        <span>{onDuty && conn === 'on' ? `${unitsHere} ${t('lcdUnits')}` : ''}</span>
        <span className="lcd-status">{status}</span>
      </div>
    </section>
  );
}
