/**
 * Guarda de sessão — 64 (armazenamento seguro). Porta com fallback em
 * memória (testes) e adapter expo-secure-store (device).
 */
export interface SessionStore {
  saveSession(token: string): Promise<void>;
  readSession(): Promise<string | null>;
  clearSession(): Promise<void>;
}

export class InMemorySessionStore implements SessionStore {
  private token: string | null = null;

  async saveSession(token: string): Promise<void> {
    this.token = token;
  }

  async readSession(): Promise<string | null> {
    return this.token;
  }

  async clearSession(): Promise<void> {
    this.token = null;
  }
}
