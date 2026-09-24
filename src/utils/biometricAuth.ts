import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';

// STATUS: REAL — this is a genuine client-side gate on the session
// token that already exists in SecureStore, NOT a new authentication
// mode and NOT a new backend endpoint. The distinction matters: a
// device's Face ID / fingerprint proves someone unlocked THIS PHONE,
// not that the backend has re-verified anyone. What actually
// authorizes API calls is still the JWT written by authStore's
// completeAuth() at login/OTP-verification time. All this file does
// is decide WHEN authStore.hydrate() is allowed to hand that existing
// token back to the app on a cold start — it never issues, refreshes,
// or re-derives a token itself. If you're looking for a NEW backend
// route for "biometric login", there isn't one, and there doesn't
// need to be one for what this feature actually is.
//
// Toggle lives in Settings (see settings/index.tsx), persisted here
// as a plain boolean in AsyncStorage (not SecureStore — this is a
// UI preference, not a secret; the actual secret, the JWT, stays in
// SecureStore where it already was).

const ENABLED_KEY = 'unilink_biometric_enabled';

export async function isBiometricSupported(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) return false;
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  return isEnrolled;
}

export async function isBiometricEnabled(): Promise<boolean> {
  const value = await AsyncStorage.getItem(ENABLED_KEY);
  return value === 'true';
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(ENABLED_KEY, enabled ? 'true' : 'false');
}

export type BiometricPromptResult = 'success' | 'cancelled' | 'unavailable';

// Prompts once. Deliberately does NOT loop internally — per Bryanna's
// call, a failed scan (wrong finger, bad angle, etc.) should let the
// user try again rather than immediately falling back to the manual
// login screen, but that retry loop belongs in the CALLING screen
// (where it can show "Try again" UI and a way to bail out to password
// login), not hidden inside this utility where a caller can't observe
// or interrupt it. This function's job is just "run one prompt,
// report what happened" — see RootLayout's usage for the retry loop.
export async function promptBiometric(): Promise<BiometricPromptResult> {
  const supported = await isBiometricSupported();
  if (!supported) return 'unavailable';

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock UniLink',
    // Explicitly false: if Face ID/Touch ID fails, let the OS offer
    // its own PIN/passcode fallback rather than silently dropping to
    // our own password screen — that's a better, more familiar UX
    // and doesn't require us to re-implement a fallback prompt.
    disableDeviceFallback: false,
    cancelLabel: 'Use password instead',
  });

  if (result.success) return 'success';
  // LocalAuthentication reports both an explicit user-cancel and a
  // failed/mismatched scan through the same `success: false` shape —
  // it does not reliably distinguish "wrong finger" from "user tapped
  // cancel" across iOS/Android in every case, so both are treated as
  // 'cancelled' here and it's on the calling screen's retry loop to
  // ask the user what they want to do next rather than guessing.
  return 'cancelled';
}
