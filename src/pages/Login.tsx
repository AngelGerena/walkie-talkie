import { FormEvent, useState } from 'react';
import { memberEmail, normalizeTeamCode, PIN_PATTERN } from '../../shared/identity';
import { useI18n } from '../lib/i18n';
import { AUTH_EMAIL_DOMAIN, callFunction, supabase } from '../lib/supabase';

const REMEMBER = 'sd-radio-login';

function remembered(): { team: string; callsign: string } {
  try {
    return JSON.parse(localStorage.getItem(REMEMBER) || '') as { team: string; callsign: string };
  } catch {
    return { team: '', callsign: '' };
  }
}

export function Login() {
  const { t, lang, setLang } = useI18n();
  const saved = remembered();
  const [mode, setMode] = useState<'signin' | 'activate'>('signin');
  const [team, setTeam] = useState(saved.team);
  const [callsign, setCallsign] = useState(saved.callsign);
  const [pin, setPin] = useState('');
  const [code, setCode] = useState('');
  const [pin2, setPin2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = async (teamCode: string, cs: string, p: string) => {
    const { error: err } = await supabase.auth.signInWithPassword({
      email: memberEmail(normalizeTeamCode(teamCode), cs, AUTH_EMAIL_DOMAIN),
      password: p,
    });
    if (err) throw new Error(t('wrongLogin'));
    localStorage.setItem(REMEMBER, JSON.stringify({ team: normalizeTeamCode(teamCode), callsign: cs.trim() }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!PIN_PATTERN.test(pin)) return setError(t('pinFormat'));
    if (mode === 'activate' && pin !== pin2) return setError(t('pinsDontMatch'));
    setBusy(true);
    try {
      if (mode === 'activate') {
        await callFunction('claim-invite', { team_code: team, callsign, code, pin });
      }
      await signIn(team, callsign, pin);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth camo">
      <div className="auth-card">
        <div className="auth-top">
          <div className="segmented segmented-small" role="group" aria-label="Language">
            <button type="button" aria-pressed={lang === 'en'} className={lang === 'en' ? 'is-active' : ''} onClick={() => setLang('en')}>
              EN
            </button>
            <button type="button" aria-pressed={lang === 'es'} className={lang === 'es' ? 'is-active' : ''} onClick={() => setLang('es')}>
              ES
            </button>
          </div>
        </div>
        <h1 className="auth-title">FIELD UNIT</h1>
        <p className="auth-sub">{t('appName')}</p>

        <form className="form" onSubmit={(e) => void submit(e)}>
          <div className="field">
            <label htmlFor="team">{t('teamCode')}</label>
            <input id="team" className="input input-lcd" autoCapitalize="characters" autoComplete="organization" value={team} onChange={(e) => setTeam(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="callsign">{t('callsign')}</label>
            <input id="callsign" className="input" autoComplete="username" value={callsign} onChange={(e) => setCallsign(e.target.value)} required />
          </div>
          {mode === 'activate' && (
            <div className="field">
              <label htmlFor="code">{t('activationCode')}</label>
              <input id="code" className="input input-lcd" autoCapitalize="characters" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} required />
            </div>
          )}
          <div className="field">
            <label htmlFor="pin">{mode === 'activate' ? t('newPin') : `${t('pin')} (${t('pinHint')})`}</label>
            <input
              id="pin"
              className="input input-pin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              autoComplete={mode === 'activate' ? 'new-password' : 'current-password'}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              required
            />
          </div>
          {mode === 'activate' && (
            <div className="field">
              <label htmlFor="pin2">{t('confirmPin')}</label>
              <input
                id="pin2"
                className="input input-pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                autoComplete="new-password"
                value={pin2}
                onChange={(e) => setPin2(e.target.value.replace(/\D/g, ''))}
                required
              />
            </div>
          )}
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="ptt ptt-form" disabled={busy}>
            <span className="ptt-label">{mode === 'activate' ? t('activateButton') : t('signInButton')}</span>
          </button>
        </form>

        <button
          type="button"
          className="link-btn"
          onClick={() => {
            setMode(mode === 'signin' ? 'activate' : 'signin');
            setError(null);
          }}
        >
          {mode === 'signin' ? t('firstTime') : t('haveAccount')}
        </button>
      </div>
    </div>
  );
}
