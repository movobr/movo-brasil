import { describe, expect, it } from 'vitest';
import { DomainError } from '../../src/domain/errors.js';
import { Session } from '../../src/domain/session.js';
import { SessionService } from '../../src/application/session-service.js';
import { User } from '../../src/domain/user.js';
import { InMemoryUserRepository } from '../../src/infrastructure/memory/repositories.js';
import type { AuthProvider, VerifiedSession } from '../../src/application/auth-ports.js';

const NOW = new Date('2026-09-09T12:00:00.000Z');
const FUTURE = new Date('2026-09-09T13:00:00.000Z');

function fakeProvider(verified: VerifiedSession): AuthProvider {
  return {
    signInWithEmail: async () => verified,
    sendPhoneOtp: async () => {},
    verifyPhoneOtp: async () => verified,
    signOut: async () => {},
  };
}

function verifiedAdmin(): VerifiedSession {
  return {
    providerSessionId: 'ps-1',
    providerUserId: 'auth-1',
    email: 'admin-a@movo.demo',
    phone: null,
    mfaVerified: true,
    expiresAt: FUTURE,
  };
}

async function setup() {
  const users = new InMemoryUserRepository();
  const admin = User.create({
    id: 'u-admin-a',
    tenantId: 'tenant-a',
    roleScope: 'TENANT',
    role: 'TENANT_ADMIN',
    email: 'admin-a@movo.demo',
    phone: null,
    name: 'Tenant A Admin',
    status: 'ACTIVE',
    now: NOW,
  });
  await users.save(admin);
  const service = new SessionService(users, { now: () => NOW });
  return { service, admin };
}

describe('session policy (02/33)', () => {
  it('rejects expired sessions deterministically', () => {
    expect(() =>
      Session.establish(
        {
          sessionId: 's-1',
          userId: 'u-1',
          tenantId: 'tenant-a',
          role: 'OPERATOR',
          permissions: [],
          mfaVerified: false,
          expiresAt: NOW,
          correlationId: 'c-1',
        },
        NOW,
      ),
    ).toThrowError(DomainError);
  });

  it('requires MFA for privileged roles', async () => {
    const { service } = await setup();
    const provider = fakeProvider({ ...verifiedAdmin(), mfaVerified: false });
    await expect(service.establishFromEmail(provider, { email: 'admin-a@movo.demo', password: 'x' }, [])).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('establishes actor context from the local registry, never the client', async () => {
    const { service, admin } = await setup();
    const provider = fakeProvider(verifiedAdmin());
    const { actor, session } = await service.establishFromEmail(
      provider,
      { email: 'admin-a@movo.demo', password: 'x' },
      ['tenant.read'],
    );
    expect(actor.userId).toBe(admin.id);
    expect(actor.tenantId).toBe('tenant-a');
    expect(actor.permissions).toEqual(['tenant.read']);
    expect(session.correlationId).toBe(actor.correlationId);
  });

  it('rejects verified identities with no local user', async () => {
    const { service } = await setup();
    const provider = fakeProvider({ ...verifiedAdmin(), email: 'ghost@movo.demo' });
    await expect(
      service.establishFromEmail(provider, { email: 'ghost@movo.demo', password: 'x' }, []),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('resolves empty permissions from the production role table (Fase 27)', async () => {
    const { service } = await setup();
    const provider = fakeProvider(verifiedAdmin());
    const { actor } = await service.establishFromEmail(
      provider,
      { email: 'admin-a@movo.demo', password: 'x' },
      [],
    );
    expect(actor.permissions).toContain('branding.manage');
    expect(actor.permissions).toContain('tenant.read');
    expect(actor.permissions).not.toContain('ride.accept');
  });

  it('establishes driver sessions from phone OTP without MFA', async () => {
    const users = new InMemoryUserRepository();
    await users.save(
      User.create({
        id: 'u-driver-1',
        tenantId: 'tenant-a',
        roleScope: 'TENANT',
        role: 'DRIVER',
        email: null,
        phone: '+5511999990001',
        name: 'Driver One',
        status: 'ACTIVE',
        now: NOW,
      }),
    );
    const service = new SessionService(users, { now: () => NOW });
    const provider = fakeProvider({
      providerSessionId: 'ps-2',
      providerUserId: 'auth-2',
      email: null,
      phone: '+5511999990001',
      mfaVerified: false,
      expiresAt: FUTURE,
    });
    const { actor } = await service.establishFromPhoneOtp(provider, '+5511999990001', '123456', []);
    expect(actor.userId).toBe('u-driver-1');
    expect(actor.tenantId).toBe('tenant-a');
  });
});
