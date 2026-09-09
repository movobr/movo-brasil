import { describe, expect, it } from 'vitest';
import { sealSession, verifySession } from './session.js';
import { DemoAuthProvider, establishDemoActor } from './demo-auth.js';
import { InMemoryUserRepository } from '@movo/brasil/src/infrastructure/memory/repositories.js';
import { User } from '@movo/brasil/src/domain/user.js';

const NOW = new Date('2026-09-09T12:00:00.000Z').getTime();

function actor() {
  return { userId: 'u-1', tenantId: 'tenant-a', permissions: ['ride.read'], correlationId: 'c-1' };
}

describe('sealed web sessions', () => {
  it('round-trips through seal/verify', () => {
    process.env['SESSION_SECRET'] = 'test-secret';
    const sealed = sealSession(actor(), NOW);
    expect(verifySession(sealed, NOW)).toMatchObject({ userId: 'u-1', tenantId: 'tenant-a' });
  });

  it('rejects tampered and expired sessions', () => {
    process.env['SESSION_SECRET'] = 'test-secret';
    const sealed = sealSession(actor(), NOW);
    const [payload] = sealed.split('.');
    expect(() => verifySession(`${payload}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`, NOW)).toThrowError();
    expect(() => verifySession(sealed, NOW + 9 * 3600 * 1000)).toThrowError();
  });
});

describe('demo auth provider', () => {
  it('refuses when demo auth is not explicitly enabled', async () => {
    const users = new InMemoryUserRepository();
    const provider = new DemoAuthProvider(users);
    const previous = process.env['ALLOW_DEMO_AUTH'];
    delete process.env['ALLOW_DEMO_AUTH'];
    await expect(provider.verifyDemoCode('a@b.c', '123456')).rejects.toThrowError(/BLOCKED/);
    if (previous !== undefined) process.env['ALLOW_DEMO_AUTH'] = previous;
  });

  it('establishes tenant-bound actors through the real session policy', async () => {
    process.env['ALLOW_DEMO_AUTH'] = 'true';
    const users = new InMemoryUserRepository();
    await users.save(
      User.create({
        id: 'u-admin', tenantId: 'tenant-a', roleScope: 'TENANT', role: 'TENANT_ADMIN',
        email: 'admin@demo.example', phone: null, name: 'Admin', status: 'ACTIVE', now: new Date(NOW),
      }),
    );
    const established = await establishDemoActor(users, new DemoAuthProvider(users), 'admin@demo.example', '123456');
    expect(established.tenantId).toBe('tenant-a');
    expect(established.permissions).toContain('tenant.read');
    delete process.env['ALLOW_DEMO_AUTH'];
  });
});
