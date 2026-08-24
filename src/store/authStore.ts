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

// Result shapes returned by login/register/verifyOtp/etc. Callers
// (the screens) branch on `success` and, on failure, on `reason` -
// mirrors the web AuthContext.js contract exactly, since both talk to
// the same backend routes.
export type AuthActionResult =
  | { success: true; user: UniLinkUser }
  | { success: false; reason: 'requiresVerification' | 'requiresTwoFactor'; userId: string; message: string }
  | { success: false; reason: 'error'; message: string };

export type SimpleResult = { success: true; message?: string } | { success: false; message: string };

interface AuthState {
  user: UniLinkUser | null;
  isLoading: boolean;
  isWakingServer: boolean;
  isHydrated: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<AuthActionResult>;
  register: (payload: {
    name: string;
    email: string;
    password: string;
    confirmPassword: string;
    universityId?: string;
  }) => Promise<{ success: true; userId: string; email: string; message?: string } | { success: false; message: string }>;
  verifyOtp: (userId: string, code: string) => Promise<AuthActionResult>;
  verifyLoginOtp: (userId: string, code: string) => Promise<AuthActionResult>;
  resendOtp: (userId: string) => Promise<SimpleResult>;
  requestPasswordChange: (
    currentPassword: string,
    newPassword: string,
    confirmNewPassword: string
  ) => Promise<SimpleResult>;
  confirmPasswordChange: (code: string) => Promise<SimpleResult>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
}

// Persists token + user and flips auth state - shared by login(),
// verifyOtp(), and verifyLoginOtp() since all three end the same way:
// a real token exists, the session is now fully live.
async function completeAuth(token: string, user: UniLinkUser, set: (partial: Partial<AuthState>) => void) {
  await SecureStore.setItemAsync('unilink_token', token);
  await SecureStore.setItemAsync('unilink_user', JSON.stringify(user));
  set({ user, isLoading: false, isWakingServer: false, error: null });
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: false,
  isWakingServer: false,
  isHydrated: false,
  error: null,

  // /auth/login has THREE possible outcomes, not one:
  //   1. 403 + requiresVerification - account exists but signup OTP was
  //      never confirmed. No token. Caller routes to verify-otp.
  //   2. 200 + requiresTwoFactor - password correct, 2FA enabled. No
  //      token yet. Caller routes to verify-login-otp.
  //   3. 200 + token - fully authenticated.
  // The old version of this function assumed outcome 3 was the only
  // one - it would silently store `undefined` as the token for the
  // other two cases and navigate to home anyway.
  login: async (email, password) => {
    set({ isLoading: true, isWakingServer: false, error: null });
    const wakeTimer = setTimeout(() => set({ isWakingServer: true }), 4000);
    try {
      const res = await api.post('/auth/login', { email, password });
      const data = res.data;

      if (data.requiresTwoFactor) {
        set({ isLoading: false, isWakingServer: false });
        return { success: false, reason: 'requiresTwoFactor', userId: data.userId, message: data.message };
      }

      await completeAuth(data.token, data.user, set);
      return { success: true, user: data.user };
    } catch (err: any) {
      const data = err?.response?.data;
      set({ isLoading: false, isWakingServer: false, error: data?.message || 'Login failed.' });

      if (data?.requiresVerification) {
        return { success: false, reason: 'requiresVerification', userId: data.userId, message: data.message };
      }

      return {
        success: false,
        reason: 'error',
        message: data?.message || 'Login failed. Check your connection and try again.',
      };
    } finally {
      clearTimeout(wakeTimer);
    }
  },

  // /auth/register NEVER returns a token - the account exists but is
  // unverified until verify-otp succeeds. The old version destructured
  // a token that was never there and silently set user to undefined
  // on every single registration.
  register: async (payload) => {
    set({ isLoading: true, isWakingServer: false, error: null });
    const wakeTimer = setTimeout(() => set({ isWakingServer: true }), 4000);
    try {
      const res = await api.post('/auth/register', payload);
      const data = res.data;
      set({ isLoading: false, isWakingServer: false });
      return { success: true, userId: data.userId, email: data.email, message: data.message };
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Registration failed. Check your connection and try again.';
      set({ isLoading: false, isWakingServer: false, error: message });
      return { success: false, message };
    } finally {
      clearTimeout(wakeTimer);
    }
  },

  verifyOtp: async (userId, code) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.post('/auth/verify-otp', { userId, code });
      const data = res.data;
      await completeAuth(data.token, data.user, set);
      return { success: true, user: data.user };
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Verification failed.';
      set({ isLoading: false, error: message });
      return { success: false, reason: 'error', message };
    }
  },

  verifyLoginOtp: async (userId, code) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.post('/auth/verify-login-otp', { userId, code });
      const data = res.data;
      await completeAuth(data.token, data.user, set);
      return { success: true, user: data.user };
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Verification failed.';
      set({ isLoading: false, error: message });
      return { success: false, reason: 'error', message };
    }
  },

  // Only knows the "verify_signup" purpose on the backend - there is
  // no dedicated 2FA-login resend endpoint yet. Screens should not
  // wire this to a "resend" button on the 2FA screen for the same
  // reason noted on web: it would issue the wrong kind of code.
  resendOtp: async (userId) => {
    try {
      const res = await api.post('/auth/resend-otp', { userId });
      return { success: true, message: res.data.message };
    } catch (err: any) {
      return { success: false, message: err?.response?.data?.message || 'Could not resend the code.' };
    }
  },

  requestPasswordChange: async (currentPassword, newPassword, confirmNewPassword) => {
    try {
      const res = await api.post('/auth/request-password-change', {
        currentPassword,
        newPassword,
        confirmNewPassword,
      });
      return { success: true, message: res.data.message };
    } catch (err: any) {
      return { success: false, message: err?.response?.data?.message || 'Could not start the password change.' };
    }
  },

  confirmPasswordChange: async (code) => {
    try {
      const res = await api.post('/auth/confirm-password-change', { code });
      return { success: true, message: res.data.message };
    } catch (err: any) {
      return { success: false, message: err?.response?.data?.message || 'Could not confirm the password change.' };
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
