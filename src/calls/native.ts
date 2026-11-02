import { Platform } from 'react-native';

// Calls need native code (WebRTC) that only exists in an app BUILT with it. An older build of the
// app, or a web preview, does not have it, and importing it there would crash the whole app at
// start. So nothing in the app imports LiveKit at the top of a file: it is loaded here, once, inside
// a try/catch, and every call feature asks this file first. If the native code is missing, the call
// buttons simply do not appear and nothing else changes.

export type LiveKitReactNative = typeof import('@livekit/react-native');
export type LiveKitClient = typeof import('livekit-client');

let cached: { rn: LiveKitReactNative; client: LiveKitClient } | null | undefined;

export function loadLiveKit(): { rn: LiveKitReactNative; client: LiveKitClient } | null {
  if (cached !== undefined) return cached;
  if (Platform.OS === 'web') {
    cached = null;
    return cached;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const rn = require('@livekit/react-native') as LiveKitReactNative;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const client = require('livekit-client') as LiveKitClient;
    rn.registerGlobals();
    cached = { rn, client };
  } catch {
    cached = null;
  }
  return cached;
}

export const callsSupportedByThisBuild = (): boolean => loadLiveKit() !== null;
