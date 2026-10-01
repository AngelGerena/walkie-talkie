import type { AlertKind } from '../../shared/identity';

export type Role = 'lead' | 'member';
export type Lang = 'en' | 'es';
export type ThemeId = 'woodland' | 'desert' | 'urban';

export interface Team {
  id: string;
  church_name: string;
  team_name: string;
  code: string;
}

export interface Member {
  id: string;
  team_id: string;
  user_id: string | null;
  callsign: string;
  role: Role;
  post: string | null;
  language: Lang;
  theme: ThemeId;
  push_enabled: boolean;
  invite_expires_at: string | null;
  created_at: string;
}
export const MEMBER_COLUMNS =
  'id, team_id, user_id, callsign, role, post, language, theme, push_enabled, invite_expires_at, created_at';

export interface Channel {
  id: string;
  team_id: string;
  name_en: string;
  name_es: string;
  sort: number;
  leads_only: boolean;
}
export const CHANNEL_COLUMNS = 'id, team_id, name_en, name_es, sort, leads_only';

export interface Transmission {
  id: string;
  team_id: string;
  channel_id: string;
  member_id: string | null;
  callsign: string;
  started_at: string;
  duration_ms: number;
  audio_path: string | null;
  mime_type: string | null;
  transcript: string | null;
  transcript_lang: Lang | null;
  translation: string | null;
  status: 'pending' | 'done' | 'failed' | 'skipped';
}
export const TX_COLUMNS =
  'id, team_id, channel_id, member_id, callsign, started_at, duration_ms, audio_path, mime_type, transcript, transcript_lang, translation, status';

export interface Alert {
  id: string;
  team_id: string;
  member_id: string | null;
  callsign: string;
  kind: AlertKind;
  post: string | null;
  message: string | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}
export const ALERT_COLUMNS = 'id, team_id, member_id, callsign, kind, post, message, lat, lng, created_at, resolved_at, resolved_by';
