import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { PIN_PATTERN } from '../../shared/identity';
import { callFunction } from '../lib/supabase';

export function Setup() {
  const [form, setForm] = useState({ secret: '', church_name: '', team_name: 'Security Detail', team_code: '', callsign: 'Lead', pin: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!PIN_PATTERN.test(form.pin)) return setError('PIN must be exactly 6 digits.');
    setBusy(true);
    try {
      const r = await callFunction<{ team_code: string }>('bootstrap', form);
      setDone(r.team_code);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth camo">
      <div className="auth-card">
        <h1 className="auth-title">FIRST-TIME SETUP</h1>
        {done ? (
          <>
            <p className="auth-sub">
              Your team is ready. Team code <strong>{done}</strong>. Sign in with callsign {form.callsign} and your PIN. Then remove
              BOOTSTRAP_SECRET from Netlify.
            </p>
            <Link className="ptt ptt-form" to="/login">
              <span className="ptt-label">Go to sign in</span>
            </Link>
          </>
        ) : (
          <form className="form" onSubmit={(e) => void submit(e)}>
            <div className="field">
              <label htmlFor="s-secret">Setup key (BOOTSTRAP_SECRET)</label>
              <input id="s-secret" className="input" type="password" value={form.secret} onChange={set('secret')} required />
            </div>
            <div className="field">
              <label htmlFor="s-church">Church name</label>
              <input id="s-church" className="input" value={form.church_name} onChange={set('church_name')} required />
            </div>
            <div className="field">
              <label htmlFor="s-team">Team name</label>
              <input id="s-team" className="input" value={form.team_name} onChange={set('team_name')} required />
            </div>
            <div className="field">
              <label htmlFor="s-code">Team code (4 to 16 letters, numbers or dashes)</label>
              <input id="s-code" className="input input-lcd" autoCapitalize="characters" value={form.team_code} onChange={set('team_code')} required />
            </div>
            <div className="field">
              <label htmlFor="s-call">Your callsign</label>
              <input id="s-call" className="input" value={form.callsign} onChange={set('callsign')} required />
            </div>
            <div className="field">
              <label htmlFor="s-pin">Your 6-digit PIN</label>
              <input
                id="s-pin"
                className="input input-pin"
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={form.pin}
                onChange={(e) => setForm((f) => ({ ...f, pin: e.target.value.replace(/\D/g, '') }))}
                required
              />
            </div>
            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="ptt ptt-form" disabled={busy}>
              <span className="ptt-label">Create team</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
