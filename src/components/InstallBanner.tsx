import { useState } from 'react';
import { useI18n } from '../lib/i18n';
import { isIOS, isStandalone } from '../lib/platform';
import { ShareIcon } from './Icons';

const KEY = 'sd-radio-install-dismissed';

export function InstallBanner() {
  const { t } = useI18n();
  const [hidden, setHidden] = useState(() => !isIOS || isStandalone() || localStorage.getItem(KEY) === '1');
  if (hidden) return null;
  return (
    <div className="install" role="note">
      <ShareIcon />
      <div className="install-text">
        <strong>{t('installTitle')}</strong>
        <span>{t('installBody')}</span>
      </div>
      <button
        type="button"
        className="install-close"
        onClick={() => {
          localStorage.setItem(KEY, '1');
          setHidden(true);
        }}
      >
        {t('dismiss')}
      </button>
    </div>
  );
}
