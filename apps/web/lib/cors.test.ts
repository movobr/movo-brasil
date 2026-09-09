import { describe, expect, it } from 'vitest';
import { corsHeadersFor, isOriginAllowed } from './cors.js';

describe('cors allowlist (33)', () => {
  it('denies by default and allows listed origins only', () => {
    expect(isOriginAllowed(null, ['https://app.exemplo.com'])).toBe(false);
    expect(isOriginAllowed('https://evil.example', ['https://app.exemplo.com'])).toBe(false);
    expect(isOriginAllowed('https://app.exemplo.com', ['https://app.exemplo.com'])).toBe(true);
  });

  it('emits idempotency-aware headers for allowed origins', () => {
    const headers = corsHeadersFor('https://app.exemplo.com', ['https://app.exemplo.com']);
    expect(headers['Access-Control-Allow-Origin']).toBe('https://app.exemplo.com');
    expect(headers['Access-Control-Allow-Headers']).toContain('X-Idempotency-Key');
    expect(corsHeadersFor('https://evil.example', ['https://app.exemplo.com'])).toEqual({});
  });
});
