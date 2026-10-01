import { useI18n } from '../../lib/i18n';
import type { Transmission } from '../../lib/types';

/** Shows a call's words in the reader's language, with the original underneath when translated. */
export function Transcript({ tx }: { tx: Transmission }) {
  const { t, lang } = useI18n();
  if (tx.status === 'pending') return <p className="tx-text tx-muted">{t('transcribing')}</p>;
  if (!tx.transcript) return null;
  const sameLang = !tx.transcript_lang || tx.transcript_lang === lang;
  if (sameLang || !tx.translation) return <p className="tx-text">{tx.transcript}</p>;
  const from = tx.transcript_lang === 'es' ? t('spanish') : t('english');
  return (
    <>
      <p className="tx-text">{tx.translation}</p>
      <p className="tx-original" lang={tx.transcript_lang ?? undefined}>
        {t('translatedFrom', { lang: from })}: {tx.transcript}
      </p>
    </>
  );
}
