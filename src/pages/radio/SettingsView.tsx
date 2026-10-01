import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { isIOS } from '../../lib/platform';
import { currentPushState, enablePush, PushResult } from '../../lib/push';
import { setSetting, useSettings } from '../../lib/settings';
import { supabase } from '../../lib/supabase';
import { applyTheme, THEMES } from '../../lib/theme';
import type { Lang, ThemeId } from '../../lib/types';
import { Toggle } from '../../components/Toggle';

export function SettingsView() {
  const { t, lang, setLang } = useI18n();
  const { member, isLead, patchMember, signOut } = useAuth();
  const s = useSettings();
  const [push, setPush] = useState<'on' | 'off' | 'unsupported'>('off');
  const [pushMsg, setPushMsg] = useState<string | null>(null);
  const [post, setPost] = useState(member?.post ?? '');
  const [postSaved, setPostSaved] = useState(false);

  useEffect(() => {
    void currentPushState().then(setPush);
  }, []);

  if (!member) return null;

  const pickTheme = (id: ThemeId) => {
    applyTheme(id);
    patchMember({ theme: id });
    void supabase.from('members').update({ theme: id }).eq('id', member.id);
  };

  const pickLang = (l: Lang) => {
    setLang(l);
    patchMember({ language: l });
    void supabase.from('members').update({ language: l }).eq('id', member.id);
  };

  const turnOnAlerts = async () => {
    setPushMsg(null);
    const r: PushResult = await enablePush(member);
    if (r === 'on') {
      setPush('on');
      patchMember({ push_enabled: true });
    } else if (r === 'denied') setPushMsg(t('alertsDenied'));
    else if (r === 'unsupported') setPushMsg(t('alertsUnsupported'));
    else setPushMsg(t('errorGeneric'));
  };

  const savePost = async () => {
    const value = post.trim() || null;
    await supabase.from('members').update({ post: value }).eq('id', member.id);
    patchMember({ post: value });
    setPostSaved(true);
    window.setTimeout(() => setPostSaved(false), 2000);
  };

  return (
    <div className="screen">
      <h2 className="screen-title">{t('settingsTitle')}</h2>

      <section className="panel">
        <h3 className="panel-title">{t('themeTitle')}</h3>
        <div className="themes" role="radiogroup" aria-label={t('themeTitle')}>
          {THEMES.map((th) => (
            <button
              key={th.id}
              type="button"
              role="radio"
              aria-checked={member.theme === th.id}
              className={`theme-card${member.theme === th.id ? ' is-active' : ''}`}
              onClick={() => pickTheme(th.id)}
            >
              <span className="theme-swatch camo" data-theme={th.id} aria-hidden>
                <span className="theme-lcd" />
              </span>
              <span className="theme-name">{lang === 'es' ? th.es : th.en}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="setting-row">
          <span className="setting-label">{t('languageTitle')}</span>
          <div className="segmented" role="group" aria-label={t('languageTitle')}>
            <button type="button" aria-pressed={lang === 'en'} className={lang === 'en' ? 'is-active' : ''} onClick={() => pickLang('en')}>
              English
            </button>
            <button type="button" aria-pressed={lang === 'es'} className={lang === 'es' ? 'is-active' : ''} onClick={() => pickLang('es')}>
              Español
            </button>
          </div>
        </div>
        <div className="setting-row setting-col">
          <label className="setting-label" htmlFor="my-post">
            {t('myPost')}
          </label>
          <div className="inline-form">
            <input id="my-post" className="input" value={post} maxLength={60} onChange={(e) => setPost(e.target.value)} />
            <button type="button" className="btn btn-small" onClick={() => void savePost()}>
              {postSaved ? t('saved') : t('save')}
            </button>
          </div>
        </div>
      </section>

      <section className="panel">
        <Toggle label={t('shiftMode')} hint={t('shiftModeHint')} checked={s.shiftMode} onChange={(v) => setSetting('shiftMode', v)} />
        <Toggle label={t('rogerBeep')} hint={t('rogerBeepHint')} checked={s.rogerBeep} onChange={(v) => setSetting('rogerBeep', v)} />
        <Toggle label={t('vibrateLabel')} hint={t('vibrateHint')} checked={s.vibrate} onChange={(v) => setSetting('vibrate', v)} />
        <Toggle label={t('headsetLabel')} hint={t('headsetHint')} checked={s.headset} onChange={(v) => setSetting('headset', v)} />
      </section>

      <section className="panel">
        <h3 className="panel-title">{t('alertsTitle')}</h3>
        {push === 'on' ? (
          <p className="setting-hint">{t('alertsOn')}</p>
        ) : (
          <>
            <p className="setting-hint">{t('alertsHint')}</p>
            <button type="button" className="btn btn-block" onClick={() => void turnOnAlerts()}>
              {t('alertsOff')}
            </button>
          </>
        )}
        {pushMsg && <p className="field-error">{pushMsg}</p>}
      </section>

      {isIOS && <p className="tip">{t('iphoneTip')}</p>}

      <div className="settings-foot">
        {isLead && (
          <Link className="btn btn-block" to="/command">
            {t('commandLink')}
          </Link>
        )}
        <button type="button" className="btn btn-block btn-ghost" onClick={() => void signOut()}>
          {t('signOut')}
        </button>
      </div>
    </div>
  );
}
