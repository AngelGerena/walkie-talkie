import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import type { Lang } from './types';

const en = {
  appName: 'Security Detail Radio',
  signIn: 'Sign in',
  activate: 'Activate',
  teamCode: 'Team code',
  callsign: 'Callsign',
  pin: 'PIN',
  pinHint: '6 digits',
  activationCode: 'Activation code',
  newPin: 'Choose a 6-digit PIN',
  confirmPin: 'Enter the PIN again',
  signInButton: 'Sign in',
  activateButton: 'Activate and sign in',
  firstTime: 'First time here, or resetting your PIN?',
  haveAccount: 'Already activated? Sign in',
  pinsDontMatch: 'The two PINs do not match.',
  pinFormat: 'Your PIN must be exactly 6 digits.',
  wrongLogin: 'Team code, callsign or PIN is not correct.',
  installTitle: 'Add to your Home Screen',
  installBody: 'On iPhone, tap Share, then Add to Home Screen. SOS alerts only reach the installed app.',
  dismiss: 'Dismiss',
  keyTalk: 'TALK',
  keyCh: 'CH',
  keyLog: 'LOG',
  keyTeam: 'TEAM',
  keySet: 'SET',
  keySos: 'SOS',
  knobCh: 'CH',
  knobVol: 'VOL',
  muted: 'MUTED',
  lcdSig: 'SIG',
  lcdBat: 'BAT',
  lcdOffDuty: 'OFF DUTY',
  lcdClear: 'CLEAR',
  lcdConnecting: 'LINKING',
  lcdReconnecting: 'RELINKING',
  lcdError: 'NO LINK',
  lcdUnits: 'UNITS ON',
  pttGoOnDuty: 'GO ON DUTY',
  pttHold: 'PUSH TO TALK',
  pttRelease: 'RELEASE TO SEND',
  pttBusy: 'CHANNEL BUSY',
  pttConnecting: 'LINKING',
  offDutyTitle: 'You are off duty',
  offDutyBody: 'Press Go on duty to join {channel}. Keep this app open on screen during your shift.',
  speakerOff: 'Tap to turn on the speaker',
  nowTalking: '{callsign} is talking',
  lastCall: 'Last call',
  noCalls: 'No calls yet on this channel.',
  play: 'Play',
  translatedFrom: 'Translated from {lang}',
  english: 'English',
  spanish: 'Spanish',
  transcribing: 'Transcribing',
  leadOverride: 'As a lead you can talk over this call.',
  goOffDuty: 'Go off duty',
  channelsTitle: 'Channels',
  unitsOn: '{n} on',
  leadsOnly: 'Leads only',
  youAreHere: 'You are here',
  talkingNow: '{callsign} talking',
  quiet: 'Quiet',
  logTitle: 'Log',
  filterAll: 'All',
  filterChannel: 'This channel',
  filterAlerts: 'Alerts',
  emptyLog: 'Nothing logged yet. Calls and alerts show up here with replay.',
  resolved: 'Resolved',
  openStatus: 'Open',
  teamTitle: 'Team',
  statusLive: 'On duty',
  statusStandby: 'App open',
  statusAlertsOnly: 'Alerts only',
  statusOff: 'Offline',
  statusNotActivated: 'Not activated',
  ping: 'Ping',
  pinged: 'Pinged',
  you: 'You',
  settingsTitle: 'Settings',
  themeTitle: 'Radio skin',
  languageTitle: 'Language',
  shiftMode: 'Shift mode',
  shiftModeHint: 'Keeps the screen awake so you hear live audio',
  rogerBeep: 'Roger beep',
  rogerBeepHint: 'Tone when a call ends',
  vibrateLabel: 'Vibrate on incoming',
  vibrateHint: 'Android phones',
  headsetLabel: 'Headset button to talk',
  headsetHint: 'Beta. Play/pause on some Bluetooth headsets starts and stops talking',
  alertsTitle: 'Emergency alerts',
  alertsOn: 'Alerts are on for this phone',
  alertsOff: 'Turn on alerts',
  alertsHint: 'Get SOS alerts even when your phone is locked.',
  alertsUnsupported: 'This browser cannot receive alerts. On iPhone, open the app from your Home Screen first.',
  alertsDenied: 'Notifications are blocked. Allow them for this app in your phone settings.',
  myPost: 'My post',
  save: 'Save',
  saved: 'Saved',
  commandLink: 'Open command dashboard',
  signOut: 'Sign out',
  iphoneTip:
    'Keep the app open on screen during your shift for live audio. If your phone locks you still get SOS alerts, and you can replay anything you missed in the Log.',
  sosTitle: 'Emergency alert',
  sosBody: 'Interrupts everyone, pushes an alert to every phone, and shares where you are.',
  sosWhere: 'Where are you?',
  sosGps: 'Attach my GPS location',
  sosHold: 'HOLD 3 SEC TO SEND',
  sosSending: 'SENDING',
  sosSent: 'Alert sent',
  sosSentBody: 'The team has been alerted. Stay on the radio.',
  sosFailed: 'The alert could not be sent. Call it out on the radio and try again.',
  cancel: 'Cancel',
  done: 'Done',
  alertIncoming: 'SOS',
  acknowledge: 'Acknowledge',
  markResolved: 'Mark resolved',
  openMap: 'Open map',
  errorMic: 'Microphone access is blocked. Allow the microphone for this app in your phone settings, then try again.',
  errorGeneric: 'Something went wrong. Try again.',
  noMemberTitle: 'Not on a team yet',
  noMemberBody: 'You are signed in, but this account is not on a security team. Ask your team lead to add you.',
  loading: 'Loading',
  retry: 'Try again',
} as const;

type Key = keyof typeof en;

const es: Record<Key, string> = {
  appName: 'Radio de Seguridad',
  signIn: 'Entrar',
  activate: 'Activar',
  teamCode: 'Código del equipo',
  callsign: 'Indicativo',
  pin: 'PIN',
  pinHint: '6 dígitos',
  activationCode: 'Código de activación',
  newPin: 'Elige un PIN de 6 dígitos',
  confirmPin: 'Escribe el PIN otra vez',
  signInButton: 'Entrar',
  activateButton: 'Activar y entrar',
  firstTime: '¿Primera vez aquí o cambiando tu PIN?',
  haveAccount: '¿Ya activaste? Entra aquí',
  pinsDontMatch: 'Los dos PIN no coinciden.',
  pinFormat: 'Tu PIN debe tener exactamente 6 dígitos.',
  wrongLogin: 'El código del equipo, el indicativo o el PIN no es correcto.',
  installTitle: 'Agrégala a tu pantalla de inicio',
  installBody: 'En iPhone, toca Compartir y luego Agregar a inicio. Las alertas SOS solo llegan a la app instalada.',
  dismiss: 'Cerrar',
  keyTalk: 'HABLAR',
  keyCh: 'CANAL',
  keyLog: 'REG',
  keyTeam: 'EQUIPO',
  keySet: 'AJUST',
  keySos: 'SOS',
  knobCh: 'CANAL',
  knobVol: 'VOL',
  muted: 'SILENCIO',
  lcdSig: 'SEÑ',
  lcdBat: 'BAT',
  lcdOffDuty: 'FUERA DE TURNO',
  lcdClear: 'LIBRE',
  lcdConnecting: 'CONECTANDO',
  lcdReconnecting: 'RECONECTANDO',
  lcdError: 'SIN ENLACE',
  lcdUnits: 'UNIDADES',
  pttGoOnDuty: 'ENTRAR DE TURNO',
  pttHold: 'OPRIME PARA HABLAR',
  pttRelease: 'SUELTA PARA ENVIAR',
  pttBusy: 'CANAL OCUPADO',
  pttConnecting: 'CONECTANDO',
  offDutyTitle: 'Estás fuera de turno',
  offDutyBody: 'Oprime Entrar de turno para unirte a {channel}. Deja la app abierta en pantalla durante tu turno.',
  speakerOff: 'Toca para activar el altavoz',
  nowTalking: '{callsign} está hablando',
  lastCall: 'Última llamada',
  noCalls: 'Todavía no hay llamadas en este canal.',
  play: 'Reproducir',
  translatedFrom: 'Traducido del {lang}',
  english: 'inglés',
  spanish: 'español',
  transcribing: 'Transcribiendo',
  leadOverride: 'Como líder puedes hablar encima de esta llamada.',
  goOffDuty: 'Salir de turno',
  channelsTitle: 'Canales',
  unitsOn: '{n} activos',
  leadsOnly: 'Solo líderes',
  youAreHere: 'Estás aquí',
  talkingNow: '{callsign} hablando',
  quiet: 'Tranquilo',
  logTitle: 'Registro',
  filterAll: 'Todo',
  filterChannel: 'Este canal',
  filterAlerts: 'Alertas',
  emptyLog: 'Nada registrado todavía. Las llamadas y alertas aparecen aquí para repetirlas.',
  resolved: 'Resuelta',
  openStatus: 'Abierta',
  teamTitle: 'Equipo',
  statusLive: 'De turno',
  statusStandby: 'App abierta',
  statusAlertsOnly: 'Solo alertas',
  statusOff: 'Desconectado',
  statusNotActivated: 'Sin activar',
  ping: 'Llamar',
  pinged: 'Enviado',
  you: 'Tú',
  settingsTitle: 'Ajustes',
  themeTitle: 'Estilo del radio',
  languageTitle: 'Idioma',
  shiftMode: 'Modo turno',
  shiftModeHint: 'Mantiene la pantalla encendida para oír el audio en vivo',
  rogerBeep: 'Tono de cierre',
  rogerBeepHint: 'Suena cuando termina una llamada',
  vibrateLabel: 'Vibrar al recibir',
  vibrateHint: 'Teléfonos Android',
  headsetLabel: 'Botón del audífono para hablar',
  headsetHint: 'Beta. Reproducir/pausa en algunos audífonos Bluetooth inicia y termina la llamada',
  alertsTitle: 'Alertas de emergencia',
  alertsOn: 'Las alertas están activas en este teléfono',
  alertsOff: 'Activar alertas',
  alertsHint: 'Recibe alertas SOS aunque tu teléfono esté bloqueado.',
  alertsUnsupported: 'Este navegador no puede recibir alertas. En iPhone, abre la app desde tu pantalla de inicio primero.',
  alertsDenied: 'Las notificaciones están bloqueadas. Permítelas para esta app en los ajustes del teléfono.',
  myPost: 'Mi puesto',
  save: 'Guardar',
  saved: 'Guardado',
  commandLink: 'Abrir panel de mando',
  signOut: 'Cerrar sesión',
  iphoneTip:
    'Deja la app abierta en pantalla durante tu turno para oír en vivo. Si el teléfono se bloquea igual recibes alertas SOS, y puedes repetir lo que te perdiste en el Registro.',
  sosTitle: 'Alerta de emergencia',
  sosBody: 'Interrumpe a todos, envía una alerta a cada teléfono y comparte dónde estás.',
  sosWhere: '¿Dónde estás?',
  sosGps: 'Adjuntar mi ubicación GPS',
  sosHold: 'MANTÉN 3 SEG PARA ENVIAR',
  sosSending: 'ENVIANDO',
  sosSent: 'Alerta enviada',
  sosSentBody: 'El equipo fue alertado. Mantente en el radio.',
  sosFailed: 'No se pudo enviar la alerta. Avisa por el radio e inténtalo otra vez.',
  cancel: 'Cancelar',
  done: 'Listo',
  alertIncoming: 'SOS',
  acknowledge: 'Entendido',
  markResolved: 'Marcar resuelta',
  openMap: 'Abrir mapa',
  errorMic: 'El micrófono está bloqueado. Permite el micrófono para esta app en los ajustes del teléfono y vuelve a intentarlo.',
  errorGeneric: 'Algo salió mal. Inténtalo otra vez.',
  noMemberTitle: 'Todavía no estás en un equipo',
  noMemberBody: 'Entraste, pero esta cuenta no está en un equipo de seguridad. Pide a tu líder que te agregue.',
  loading: 'Cargando',
  retry: 'Intentar otra vez',
};

const DICTS: Record<Lang, Record<Key, string>> = { en, es };
const KEY = 'sd-radio-lang';

interface I18n {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: Key, vars?: Record<string, string | number>) => string;
}

const Ctx = createContext<I18n | null>(null);

function initialLang(): Lang {
  const saved = localStorage.getItem(KEY);
  if (saved === 'en' || saved === 'es') return saved;
  return navigator.language?.toLowerCase().startsWith('es') ? 'es' : 'en';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    document.documentElement.lang = l;
    try {
      localStorage.setItem(KEY, l);
    } catch {
      /* private mode */
    }
  }, []);
  const t = useCallback(
    (key: Key, vars?: Record<string, string | number>) => {
      let s: string = DICTS[lang][key] ?? en[key];
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
      return s;
    },
    [lang],
  );
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const v = useContext(Ctx);
  if (!v) throw new Error('useI18n outside I18nProvider');
  return v;
}

export function channelName(c: { name_en: string; name_es: string }, lang: Lang): string {
  return lang === 'es' ? c.name_es || c.name_en : c.name_en;
}
