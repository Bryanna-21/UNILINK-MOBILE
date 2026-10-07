import { useThemeStore } from '../store/themeStore';

// Static fallback palette (light mode) — kept as a plain export so
// any file that genuinely can't use a hook (e.g. a non-component
// utility file) still has a sane default. Prefer useColors() inside
// components; it's the only one that actually reacts to the toggle.
export const Colors = {
  primary: '#0B6BFF',
  primarySoft: '#EAF2FF',
  secondary: '#16A34A',
  secondarySoft: '#EAF8EF',
  accent: '#00B8E6',
  accentSoft: '#E8F9FD',
  background: '#F6F9FC',
  backgroundDark: '#081525',
  text: '#0F172A',
  textDark: '#F8FAFC',
  textMuted: '#64748B',
  textMutedDark: '#A9BCD2',
  border: '#E2E8F0',
  borderDark: '#243044',
  danger: '#EF4444',
  white: '#FFFFFF',
  black: '#000000',
} as const;

// Card/surface color needs a dark equivalent too — light mode uses
// Colors.white for cards against a near-white background; dark mode
// needs a surface distinct from the near-black background, or every
// card in the app would be invisible against it.
const SURFACE_DARK = '#0D1B2A';

export interface ThemeColors {
  primary: string;
  primarySoft: string;
  secondary: string;
  secondarySoft: string;
  accent: string;
  accentSoft: string;
  background: string;
  surface: string; // card/composer backgrounds — was Colors.white before
  text: string;
  textMuted: string;
  border: string;
  skeletonBase: string;
  skeletonHighlight: string;
  danger: string;
  white: string;
  black: string;
}

const lightColors: ThemeColors = {
  primary: Colors.primary,
  primarySoft: Colors.primarySoft,
  secondary: Colors.secondary,
  secondarySoft: Colors.secondarySoft,
  accent: Colors.accent,
  accentSoft: Colors.accentSoft,
  background: Colors.background,
  surface: Colors.white,
  text: Colors.text,
  textMuted: Colors.textMuted,
  border: Colors.border,
  skeletonBase: '#E5ECF4',
  skeletonHighlight: '#FFFFFF',
  danger: Colors.danger,
  white: Colors.white,
  black: Colors.black,
};

const darkColors: ThemeColors = {
  primary: Colors.primary,
  primarySoft: '#102B52',
  secondary: Colors.secondary,
  secondarySoft: '#103326',
  accent: Colors.accent,
  accentSoft: '#0D3040',
  background: Colors.backgroundDark,
  surface: SURFACE_DARK,
  text: Colors.textDark,
  textMuted: Colors.textMutedDark,
  border: Colors.borderDark,
  skeletonBase: '#17304A',
  skeletonHighlight: '#315C87',
  danger: Colors.danger,
  white: Colors.white,
  black: Colors.black,
};

// The hook every screen should switch to. Returns the correct palette
// for the current theme mode and re-renders the component when the
// mode changes, since it reads from the Zustand store rather than a
// static import.
export function useColors(): ThemeColors {
  const mode = useThemeStore((s) => s.mode);
  return mode === 'dark' ? darkColors : lightColors;
}

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const Motion = {
  fast: 120,
  normal: 180,
  enter: 240,
  exit: 160,
} as const;
