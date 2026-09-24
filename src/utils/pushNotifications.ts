import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { api } from '../api/client';
import { isCategoryMuted } from './notificationPrefs';

// STATUS: REAL — closes a gap that was invisible from the backend
// side: POST /profile/push-token and the actual Expo push-sending
// pipeline (push.util.js, notifyUsers.middleware.js) were BOTH
// already fully built and wired into real controllers (exams,
// courses, messages). But nothing on mobile ever requested
// notification permission, fetched a device push token, or called
// that registration endpoint — so every user's pushToken in the
// database was always null, and every one of those real push sends
// was silently, permanently skipped (see push.util.js's own
// no-token-is-not-an-error handling). This file is the missing other
// half, not new backend work.
//
// Push tokens only exist on a physical device with a real Expo
// project ID — they are not available on the iOS Simulator (Android
// emulators with Play Services CAN get one). getExpoPushTokenAsync
// will throw in an unsupported environment; that's treated as a
// silent no-op here, exactly like push.util.js treats a null token
// on the backend, not as an error to surface to the user — someone
// testing in a simulator should not see a scary alert about a
// feature that fundamentally cannot work there.

// Foreground display behavior: without this handler, a push arriving
// while the app is OPEN is received by the OS but never shown as a
// visible alert/sound — the default behavior on both platforms is to
// suppress foreground notifications entirely, which reads as "push
// doesn't work" during exactly the kind of quick manual test someone
// does right after wiring this up.
//
// Also checks notificationPrefs' client-side category mute here —
// see that file's own header comment for exactly what this does and
// does NOT do (it only ever suppresses the foreground alert; it
// cannot stop the server from sending, and has no effect on
// background/closed-app OS notifications).
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const type = notification.request.content.data?.type as string | undefined;
    const muted = await isCategoryMuted(type);
    return {
      shouldShowAlert: !muted,
      shouldPlaySound: !muted,
      shouldSetBadge: false,
    };
  },
});

export async function registerForPushNotifications(): Promise<void> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      // Deliberately silent, no Alert — a user declining notification
      // permission is a normal, common, entirely valid choice, not an
      // error state the app should nag about here. If a dedicated
      // "enable notifications" settings flow is ever built, THAT is
      // the right place to explain what's missing and offer to
      // re-prompt — not this background registration call.
      return;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );

    await api.post('/profile/push-token', { pushToken: tokenResponse.data });
  } catch (err) {
    // Covers: simulator/emulator without push capability, no network
    // to reach Expo's token service, or the registration API call
    // itself failing. None of these should ever block or interrupt
    // whatever screen triggered this (see call site in _layout.tsx —
    // fired once after successful auth, never awaited by the UI).
    console.log('[push] Registration skipped or failed (non-fatal):', err);
  }
}
