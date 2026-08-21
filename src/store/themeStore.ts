import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

export type ThemeMode = 'light' | 'dark';

interface ThemeState {
  mode: ThemeMode;
  isHydrated: boolean;
  toggle: () => void;
  setMode: (mode: ThemeMode) => void;
  hydrate: () => Promise<void>;
}

// Mirrors authStore's pattern exactly: plain Zustand (no persist
// middleware), manual SecureStore read on hydrate, manual write on
// every change. Kept consistent with the rest of this codebase rather
// than introducing a second persistence approach.
export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: 'light',
  isHydrated: false,

  toggle: () => {
    const next: ThemeMode = get().mode === 'light' ? 'dark' : 'light';
    set({ mode: next });
    SecureStore.setItemAsync('unilink_theme', next).catch(() => {
      // Non-fatal — the toggle still works for the current session
      // even if persistence fails; it just won't survive a restart.
    });
  },

  setMode: (mode) => {
    set({ mode });
    SecureStore.setItemAsync('unilink_theme', mode).catch(() => {});
  },

  hydrate: async () => {
    try {
      const stored = await SecureStore.getItemAsync('unilink_theme');
      if (stored === 'light' || stored === 'dark') {
        set({ mode: stored });
      }
    } finally {
      set({ isHydrated: true });
    }
  },
}));
