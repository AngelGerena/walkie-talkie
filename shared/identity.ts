// Shared by the browser and Netlify Functions so sign-in and account
// creation always derive the same login address.

export function slug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function normalizeTeamCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '');
}

export function memberEmail(teamCode: string, callsign: string, domain: string): string {
  return `${slug(callsign)}.${slug(teamCode)}@${domain}`;
}

export const PIN_PATTERN = /^\d{6}$/;
export const TEAM_CODE_PATTERN = /^[A-Z0-9-]{4,16}$/;

export const ALERT_KINDS = ['medical', 'suspicious', 'lost_child', 'disturbance', 'fire', 'other'] as const;
export type AlertKind = (typeof ALERT_KINDS)[number] | 'broadcast';

export const ALERT_LABELS: Record<AlertKind, { en: string; es: string }> = {
  medical: { en: 'Medical', es: 'Médica' },
  suspicious: { en: 'Suspicious person', es: 'Persona sospechosa' },
  lost_child: { en: 'Lost child', es: 'Niño perdido' },
  disturbance: { en: 'Disturbance', es: 'Disturbio' },
  fire: { en: 'Fire / Evacuate', es: 'Fuego / Evacuar' },
  other: { en: 'Other emergency', es: 'Otra emergencia' },
  broadcast: { en: 'Team broadcast', es: 'Mensaje al equipo' },
};
