import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

// Env-driven with a hardcoded fallback — set EXPO_PUBLIC_API_URL to override
// (e.g. a local backend during development) without editing this file.
// Falls back to the live Render backend, same one the web frontend uses.
const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  Constants.expoConfig?.extra?.apiUrl ??
  'https://unilink-backend-1.onrender.com/api';

// Render free tier spins the backend down after ~15 min idle. The FIRST
// request after a cold start can take 30-60s to wake it up. A normal
// 15s timeout will fail that first call almost every time the app is
// opened after being closed a while — this is not an edge case, it WILL
// happen in any demo. So: short timeout for warm requests, but on
// timeout/network-error we retry once with a much longer window instead
// of just failing the request outright.
const WARM_TIMEOUT_MS = 15000;
const COLD_START_TIMEOUT_MS = 60000;

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: WARM_TIMEOUT_MS,
});

// Attach the stored JWT to every outgoing request, same contract
// as UNILINK-FRONTEND's services/api.js (Bearer token in Authorization header).
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('unilink_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401, clear the stored token. Screens are responsible for
// redirecting to /auth/login when they detect no valid session —
// kept simple here rather than guessing a global redirect strategy.
//
// On timeout/network error (classic Render cold-start symptom), retry
// the SAME request exactly once with a 60s timeout before giving up.
// This is a one-shot retry per request, not a loop — if the retry also
// fails, that's a real error and the caller should see it.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await SecureStore.deleteItemAsync('unilink_token');
      return Promise.reject(error);
    }

    const isTimeoutOrNetworkError =
      error.code === 'ECONNABORTED' || error.message === 'Network Error' || !error.response;

    const config = error.config;
    if (isTimeoutOrNetworkError && config && !config._coldStartRetry) {
      config._coldStartRetry = true;
      config.timeout = COLD_START_TIMEOUT_MS;
      return api(config);
    }

    return Promise.reject(error);
  }
);
