import { useI18n } from '../lib/i18n';

export type View = 'talk' | 'channels' | 'log' | 'team' | 'settings' | 'sos';

interface Props {
  view: View;
  onChange: (v: View) => void;
}

export function KeyRow({ view, onChange }: Props) {
  const { t } = useI18n();
  const keys: { id: View; label: string }[] = [
    { id: 'talk', label: t('keyTalk') },
    { id: 'channels', label: t('keyCh') },
    { id: 'log', label: t('keyLog') },
    { id: 'team', label: t('keyTeam') },
    { id: 'settings', label: t('keySet') },
  ];
  return (
    <nav className="keys" aria-label="Radio keys">
      {keys.map((k) => (
        <button
          key={k.id}
          type="button"
          className={`key${view === k.id ? ' is-active' : ''}`}
          aria-current={view === k.id ? 'page' : undefined}
          onClick={() => onChange(k.id)}
        >
          {k.label}
        </button>
      ))}
      <button type="button" className="key key-sos" onClick={() => onChange('sos')}>
        {t('keySos')}
      </button>
    </nav>
  );
}
