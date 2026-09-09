import * as SecureStore from 'expo-secure-store';
import type { SessionStore } from './session-store.js';

const SESSION_KEY = 'movo.session_token';

/** Adapter device (64): token de sessão em armazenamento seguro do SO. */
export class SecureSessionStore implements SessionStore {
  async saveSession(token: string): Promise<void> {
    await SecureStore.setItemAsync(SESSION_KEY, token);
  }

  async readSession(): Promise<string | null> {
    return SecureStore.getItemAsync(SESSION_KEY);
  }

  async clearSession(): Promise<void> {
    await SecureStore.deleteItemAsync(SESSION_KEY);
  }
}
