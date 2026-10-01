import { useSyncExternalStore } from 'react';

export interface LocalSettings {
  shiftMode: boolean;
  rogerBeep: boolean;
  vibrate: boolean;
  headset: boolean;
  muted: boolean;
}

const KEY = 'sd-radio-settings';
const DEFAULTS: LocalSettings = { shiftMode: true, rogerBeep: true, vibrate: true, headset: false, muted: false };

function read(): LocalSettings {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) || '{}') as Partial<LocalSettings>) };
  } catch {
    return DEFAULTS;
  }
}

let current = read();
const listeners = new Set<() => void>();

export function getSettings(): LocalSettings {
  return current;
}

export function setSetting<K extends keyof LocalSettings>(key: K, value: LocalSettings[K]): void {
  current = { ...current, [key]: value };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* private mode */
  }
  listeners.forEach((l) => l());
}

export function useSettings(): LocalSettings {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );
}
