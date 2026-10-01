import { channelName, useI18n } from '../../lib/i18n';
import { pad2 } from '../../lib/platform';
import { useRadio } from '../../radio/RadioProvider';
import { LockIcon } from '../../components/Icons';

export function ChannelsView({ onPicked }: { onPicked: () => void }) {
  const { t, lang } = useI18n();
  const { channels, channel, selectChannel, presence } = useRadio();

  return (
    <div className="screen">
      <h2 className="screen-title">{t('channelsTitle')}</h2>
      <ul className="list">
        {channels.map((c, i) => {
          const here = presence.filter((p) => p.channel_id === c.id);
          const talker = here.find((p) => p.talking);
          const active = c.id === channel?.id;
          return (
            <li key={c.id}>
              <button
                type="button"
                className={`row-btn${active ? ' is-active' : ''}`}
                aria-current={active ? 'true' : undefined}
                onClick={() => {
                  selectChannel(c.id);
                  onPicked();
                }}
              >
                <span className="ch-num">{pad2(i + 1)}</span>
                <span className="row-main">
                  <span className="row-title">
                    {channelName(c, lang)} {c.leads_only && <LockIcon />}
                  </span>
                  <span className="row-sub">
                    {active ? t('youAreHere') : c.leads_only ? t('leadsOnly') : t('unitsOn', { n: here.length })}
                    {active && ` · ${t('unitsOn', { n: here.length })}`}
                  </span>
                </span>
                <span className={`row-status${talker ? ' is-live' : ''}`}>
                  {talker ? t('talkingNow', { callsign: talker.callsign }) : t('quiet')}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
