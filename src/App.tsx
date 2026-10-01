import { lazy, Suspense, useEffect, useRef } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { I18nProvider, useI18n } from './lib/i18n';
import { configError } from './lib/supabase';
import { applyTheme } from './lib/theme';
import { Login } from './pages/Login';
import { Setup } from './pages/Setup';

const RadioPage = lazy(() => import('./pages/RadioPage').then((m) => ({ default: m.RadioPage })));
const Command = lazy(() => import('./pages/Command').then((m) => ({ default: m.Command })));

function Screen({ title, body, action }: { title: string; body?: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="auth camo">
      <div className="auth-card">
        <h1 className="auth-title">{title}</h1>
        {body && <p className="auth-sub">{body}</p>}
        {action && (
          <button type="button" className="ptt ptt-form" onClick={action.onClick}>
            <span className="ptt-label">{action.label}</span>
          </button>
        )}
      </div>
    </div>
  );
}

function Gate() {
  const { status, error, member, reload, signOut } = useAuth();
  const { t, setLang } = useI18n();
  const synced = useRef<string | null>(null);

  // Apply the member's saved skin and language once per sign-in.
  useEffect(() => {
    if (!member || synced.current === member.id) return;
    synced.current = member.id;
    applyTheme(member.theme);
    setLang(member.language);
  }, [member, setLang]);

  if (status === 'loading') return <Screen title="FIELD UNIT" body={t('loading')} />;
  if (status === 'error') return <Screen title="NO LINK" body={error ?? t('errorGeneric')} action={{ label: t('retry'), onClick: reload }} />;
  if (status === 'signed-out') {
    return (
      <Routes>
        <Route path="/setup" element={<Setup />} />
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }
  if (status === 'no-member') {
    return <Screen title={t('noMemberTitle')} body={t('noMemberBody')} action={{ label: t('signOut'), onClick: () => void signOut() }} />;
  }
  return (
    <Suspense fallback={<Screen title="FIELD UNIT" body={t('loading')} />}>
      <Routes>
        <Route path="/" element={<RadioPage />} />
        <Route path="/command" element={<Command />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  if (configError) {
    return (
      <div className="auth camo">
        <div className="auth-card">
          <h1 className="auth-title">SETUP NEEDED</h1>
          <p className="auth-sub">{configError}</p>
        </div>
      </div>
    );
  }
  return (
    <I18nProvider>
      <AuthProvider>
        <BrowserRouter>
          <Gate />
        </BrowserRouter>
      </AuthProvider>
    </I18nProvider>
  );
}
