import Constants from 'expo-constants';
import { io, Socket } from 'socket.io-client';
import { socketOrigin } from '../utils/realtimeEvents';

// ONE shared live connection for the whole app (notifications and new-message signals). The chat screen keeps its own
// short-lived connection for typing indicators; this one is only for events addressed to the signed-in person.

// The same address rule as src/api/client.ts, kept here so that file stays untouched.
const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL?.trim() ||
  Constants.expoConfig?.extra?.apiUrl ||
  'https://unilink-backend-1.onrender.com/api'
).replace(/\/+$/, '');

let socket: Socket | null = null;

export function connectRealtime(token: string): Socket {
  disconnectRealtime();
  socket = io(socketOrigin(API_BASE_URL), {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 30000,
  });
  return socket;
}

export function disconnectRealtime(): void {
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
}

export function isRealtimeConnected(): boolean {
  return !!socket?.connected;
}
