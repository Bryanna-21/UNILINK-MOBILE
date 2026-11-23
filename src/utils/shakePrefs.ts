import AsyncStorage from '@react-native-async-storage/async-storage';

// "Shake to report a problem": on by default, switched off in Settings. Stored on this device only.
const KEY = 'unilink_shake_to_report';
const listeners = new Set<() => void>();

export async function isShakeToReportEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) !== 'off';
  } catch {
    return true;
  }
}

export async function setShakeToReportEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, enabled ? 'on' : 'off');
  } catch {
    // The switch simply does not stick; nothing else depends on it.
  }
  listeners.forEach((fn) => fn());
}

// The shake listener uses this to start or stop at once when the switch is flipped.
export function onShakePrefChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
