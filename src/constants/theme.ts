import { useThemeStore } from '../store/themeStore';

// Static fallback palette (light mode) — kept as a plain export so
// any file that genuinely can't use a hook (e.g. a non-component
// utility file) still has a sane default. Prefer useColors() inside
// components; it's the only one that actually reacts to the toggle.
export const Colors = {
  primary: '#0B6BFF',
  secondary: '#22C55E',
  accent: '#00C2FF',
  background: '#F8FAFC',
  backgroundDark: '#0A0A0A',
  text: '#0F172A',
  textDark: '#F8FAFC',
  textMuted: '#64748B',
  textMutedDark: '#94A3B8',
  border: '#E2E8F0',
  borderDark: '#1E293B',
  danger: '#EF4444',
  white: '#FFFFFF',
  black: '#000000',
} as const;

// Card/surface color needs a dark equivalent too — light mode uses
// Colors.white for cards against a near-white background; dark mode
// needs a surface distinct from the near-black background, or every
// card in the app would be invisible against it.
const SURFACE_DARK = '#151515';

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string; // card/composer backgrounds — was Colors.white before
  text: string;
  textMuted: string;
  border: string;
  danger: string;
  white: string;
  black: string;
}

const lightColors: ThemeColors = {
  primary: Colors.primary,
  secondary: Colors.secondary,
  accent: Colors.accent,
  background: Colors.background,
  surface: Colors.white,
  text: Colors.text,
  textMuted: Colors.textMuted,
  border: Colors.border,
  danger: Colors.danger,
  white: Colors.white,
  black: Colors.black,
};

const darkColors: ThemeColors = {
  primary: Colors.primary,
  secondary: Colors.secondary,
  accent: Colors.accent,
  background: Colors.backgroundDark,
  surface: SURFACE_DARK,
  text: Colors.textDark,
  textMuted: Colors.textMutedDark,
  border: Colors.borderDark,
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
