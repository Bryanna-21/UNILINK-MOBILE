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
  bio?: string;
  phone?: string;
  admissionNumber?: string;
  avatarUrl?: string;
  coverUrl?: string;
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

  // True when hydrate() found a valid stored session AND biometric
  // lock is enabled, but the biometric prompt hasn't succeeded yet
  // this app-open. `user` stays null while this is true — the
  // session token itself is still safely in SecureStore untouched,
  // it's simply not been exposed to the app's UI/API layer yet.
  // RootLayout renders a dedicated unlock screen while this is true,
  // instead of the login screen or the authenticated tabs.
  pendingBiometricUnlock: boolean;

  // Locally updates the cached user object without a network call —
  // for merging in fields a mutation (like profile edit) just
  // confirmed were saved, without needing a full re-fetch/re-login.
  setUser: (user: UniLinkUser) => void;

  // Called once the biometric prompt succeeds (see RootLayout) —
  // releases the already-hydrated-but-held user into real state.
  // Does NOT re-read SecureStore or make a network call: the user
  // object was already loaded during hydrate(), just not exposed yet.
  completeBiometricUnlock: () => void;

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
  // Pre-login flow — distinct from requestPasswordChange/confirmPasswordChange
  // above, which require an authenticated session. Mirrors web's
  // AuthContext.js forgotPassword/resetPassword exactly: two calls,
  // email first to get a code, then email+code+both password fields
  // together (backend re-checks the match server-side too).
  forgotPassword: (email: string) => Promise<SimpleResult>;
  resetPassword: (
    email: string,
    code: string,
    newPassword: string,
    confirmNewPassword: string
  ) => Promise<SimpleResult>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;

  // Internal holding spot for a user object hydrate() has loaded but
  // not yet released to `user`, because biometric unlock is pending.
  // Not meant to be read by screens directly — go through `user` and
  // `pendingBiometricUnlock` instead. Exported on the interface only
  // because zustand's `set`/`get` need it to be part of the same
  // store object; treat it as private.
  _heldUser: UniLinkUser | null;
}

// Persists token + user and flips auth state - shared by login(),
// verifyOtp(), and verifyLoginOtp() since all three end the same way:
// a real token exists, the session is now fully live.
async function completeAuth(token: string, user: UniLinkUser, set: (partial: Partial<AuthState>) => void) {
  await SecureStore.setItemAsync('unilink_token', token);
  await SecureStore.setItemAsync('unilink_user', JSON.stringify(user));
  set({ user, isLoading: false, isWakingServer: false, error: null });
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: false,
  isWakingServer: false,
  isHydrated: false,
  error: null,
  pendingBiometricUnlock: false,
  _heldUser: null,

  // Same persistence approach as completeAuth above — must write to
  // SecureStore, not just update in-memory Zustand state, or a
  // profile edit would appear to succeed and then silently vanish
  // the next time the app is fully closed and reopened (hydrate()
  // reads unilink_user back from SecureStore on cold start).
  setUser: (user) => {
    SecureStore.setItemAsync('unilink_user', JSON.stringify(user)).catch(() => {
      // Non-fatal: the in-memory update below still lands for the
      // current session even if the disk write fails for some reason.
    });
    set({ user });
  },

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

  // Pre-login. Matches web's AuthContext.js forgotPassword exactly:
  // POST /auth/forgot-password, { email } only.
  forgotPassword: async (email) => {
    try {
      const res = await api.post('/auth/forgot-password', { email });
      return { success: true, message: res.data.message };
    } catch (err: any) {
      return { success: false, message: err?.response?.data?.message || 'Could not process the request.' };
    }
  },

  // Matches web's AuthContext.js resetPassword exactly: POST
  // /auth/reset-password with all four fields, including
  // confirmNewPassword — the backend re-validates the match itself
  // rather than trusting the client-side check alone.
  resetPassword: async (email, code, newPassword, confirmNewPassword) => {
    try {
      const res = await api.post('/auth/reset-password', {
        email,
        code,
        newPassword,
        confirmNewPassword,
      });
      return { success: true, message: res.data.message };
    } catch (err: any) {
      return { success: false, message: err?.response?.data?.message || 'Could not reset the password.' };
    }
  },

  logout: async () => {
    await SecureStore.deleteItemAsync('unilink_token');
    await SecureStore.deleteItemAsync('unilink_user');
    set({ user: null, pendingBiometricUnlock: false, _heldUser: null });
  },

  // Reads the stored session same as before. NEW: if biometric lock
  // is enabled, the loaded user is held in `_heldUser` and
  // `pendingBiometricUnlock` is raised instead of setting `user`
  // directly — RootLayout renders an unlock prompt in that state and
  // calls completeBiometricUnlock() once the scan succeeds. If
  // biometric is disabled (the default), behavior is byte-for-byte
  // identical to before this feature existed: `user` is set directly,
  // nothing is held back.
  //
  // Deliberately checks isBiometricEnabled() dynamically here rather
  // than caching it — if the user just toggled the setting off in
  // Settings, the NEXT cold start should honor that immediately
  // without needing any other cache to be invalidated.
  hydrate: async () => {
    try {
      const storedUser = await SecureStore.getItemAsync('unilink_user');
      const storedToken = await SecureStore.getItemAsync('unilink_token');
      if (storedUser && storedToken) {
        const parsedUser = JSON.parse(storedUser) as UniLinkUser;
        const { isBiometricEnabled, isBiometricSupported } = await import('../utils/biometricAuth');
        const wantsLock = await isBiometricEnabled();
        // Also re-check hardware/enrollment, not just the saved
        // preference — if the user disabled their device's Face ID
        // entirely after enabling this setting, don't strand them
        // behind a prompt that can never succeed.
        const canLock = wantsLock && (await isBiometricSupported());
        if (canLock) {
          set({ _heldUser: parsedUser, pendingBiometricUnlock: true });
        } else {
          set({ user: parsedUser });
        }
      }
    } finally {
      set({ isHydrated: true });
    }
  },

  completeBiometricUnlock: () => {
    const held = get()._heldUser;
    set({ user: held, pendingBiometricUnlock: false, _heldUser: null });
  },
}));
