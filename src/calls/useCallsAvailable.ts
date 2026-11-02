import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { callsSupportedByThisBuild } from './native';

// Calls show up only when BOTH are true: the server switch is on (GET /config -> features.calls,
// set with FEATURE_CALLS in Render), and this build of the app contains the call code.
let serverFlag: boolean | null = null;
let inflight: Promise<boolean> | null = null;

function readServerFlag(): Promise<boolean> {
  if (serverFlag !== null) return Promise.resolve(serverFlag);
  if (!inflight) {
    inflight = api
      .get('/config')
      .then((res) => {
        serverFlag = res.data?.data?.features?.calls === true;
        return serverFlag;
      })
      .catch(() => false)
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function useCallsAvailable(): boolean {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!callsSupportedByThisBuild()) return undefined;
    readServerFlag().then((on) => {
      if (!cancelled) setAvailable(on);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return available;
}
