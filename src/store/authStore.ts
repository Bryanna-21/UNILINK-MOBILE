import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { api } from '../api/client';

export type UserRole = 'student' | 'lecturer' | 'admin';

export interface UniLinkUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  universityId?: string;
}

interface AuthState {
  user: UniLinkUser | null;
  isLoading: boolean;
  isWakingServer: boolean;
  isHydrated: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (payload: {
    name: string;
    email: string;
    password: string;
    confirmPassword: string;
    universityId?: string;
    role?: UserRole;
  }) => Promise<boolean>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
}

// Matches the exact response shape from auth.routes.js on the real backend:
// { status, message, token, user: { id, name, email, role, universityId } }
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: false,
  isWakingServer: false,
  isHydrated: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, isWakingServer: false, error: null });
    // Render free tier can take 30-60s to wake from a cold start (the
    // client's own retry handles this). If we're still waiting past the
    // point a warm server would've responded, flip a flag so the screen
    // can show "waking up the server" instead of a bare, unexplained spinner.
    const wakeTimer = setTimeout(() => set({ isWakingServer: true }), 4000);
    try {
      const res = await api.post('/auth/login', { email, password });
      const { token, user } = res.data;
      await SecureStore.setItemAsync('unilink_token', token);
      await SecureStore.setItemAsync('unilink_user', JSON.stringify(user));
      set({ user, isLoading: false, isWakingServer: false });
      return true;
    } catch (err: any) {
      const message =
        err?.response?.data?.message || 'Login failed. Check your connection and try again.';
      set({ isLoading: false, isWakingServer: false, error: message });
      return false;
    } finally {
      clearTimeout(wakeTimer);
    }
  },

  register: async (payload) => {
    set({ isLoading: true, isWakingServer: false, error: null });
    const wakeTimer = setTimeout(() => set({ isWakingServer: true }), 4000);
    try {
      const res = await api.post('/auth/register', payload);
      const { token, user } = res.data;
      await SecureStore.setItemAsync('unilink_token', token);
      await SecureStore.setItemAsync('unilink_user', JSON.stringify(user));
      set({ user, isLoading: false, isWakingServer: false });
      return true;
    } catch (err: any) {
      const message =
        err?.response?.data?.message || 'Registration failed. Check your connection and try again.';
      set({ isLoading: false, isWakingServer: false, error: message });
      return false;
    } finally {
      clearTimeout(wakeTimer);
    }
  },

  logout: async () => {
    await SecureStore.deleteItemAsync('unilink_token');
    await SecureStore.deleteItemAsync('unilink_user');
    set({ user: null });
  },

  hydrate: async () => {
    try {
      const storedUser = await SecureStore.getItemAsync('unilink_user');
      const storedToken = await SecureStore.getItemAsync('unilink_token');
      if (storedUser && storedToken) {
        set({ user: JSON.parse(storedUser) });
      }
    } finally {
      set({ isHydrated: true });
    }
  },
}));
