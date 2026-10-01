import type { ThemeId } from './types';

export const THEMES: { id: ThemeId; en: string; es: string; chrome: string }[] = [
  { id: 'woodland', en: 'Woodland', es: 'Bosque', chrome: '#151812' },
  { id: 'desert', en: 'Desert', es: 'Desierto', chrome: '#2B2217' },
  { id: 'urban', en: 'Urban', es: 'Urbano', chrome: '#141516' },
];

const KEY = 'sd-radio-theme';

export function storedTheme(): ThemeId {
  const t = localStorage.getItem(KEY);
  return t === 'desert' || t === 'urban' ? t : 'woodland';
}

export function applyTheme(id: ThemeId): void {
  document.documentElement.dataset.theme = id;
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* private mode */
  }
  const chrome = THEMES.find((t) => t.id === id)?.chrome;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && chrome) meta.setAttribute('content', chrome);
}
