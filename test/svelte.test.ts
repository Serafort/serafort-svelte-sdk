import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSerafortStore } from '../src/client/store.js';
import { createSerafortHandle, requireAuth } from '../src/server/handle.js';
import { SerafortClient, type UserContext } from '@serafort/core';
import { get } from 'svelte/store';

describe('@serafort/svelte store & SvelteKit server handlers', () => {
  const mockUser: UserContext = {
    userId: 'usr_svelte_789',
    tenantId: 'tenant_sveltekit',
    roles: ['admin', 'maintainer'],
    permissions: ['org:*', 'analytics:read'],
  };

  let mockClient: SerafortClient;

  beforeEach(() => {
    mockClient = new SerafortClient({ endpoint: 'https://api.test.serafort.com' });
    vi.spyOn(mockClient.b2b, 'validateToken').mockImplementation(async (token: string) => {
      if (token === 'valid_svelte_token') {
        return mockUser;
      }
      throw new Error('Invalid token');
    });
  });

  it('initializes store with unauthenticated values', () => {
    const store = createSerafortStore({
      endpoint: 'https://api.test.serafort.com',
      storageType: 'memory',
      autoInitialize: false,
      client: mockClient,
    });

    expect(get(store.isAuthenticated)).toBe(false);
    expect(get(store.user)).toBeNull();
    expect(get(store.token)).toBeNull();
    expect(get(store.roles)).toEqual([]);
    expect(get(store.permissions)).toEqual([]);
  });

  it('updates store reactively upon setToken', async () => {
    const store = createSerafortStore({
      endpoint: 'https://api.test.serafort.com',
      storageType: 'memory',
      autoInitialize: false,
      client: mockClient,
    });

    const user = await store.setToken('valid_svelte_token');

    expect(user.userId).toBe('usr_svelte_789');
    expect(get(store.isAuthenticated)).toBe(true);
    expect(get(store.user)?.userId).toBe('usr_svelte_789');
    expect(get(store.token)).toBe('valid_svelte_token');
    expect(get(store.tenantId)).toBe('tenant_sveltekit');
    expect(get(store.roles)).toContain('maintainer');
  });

  it('supports wildcard permissions and role verification', async () => {
    const store = createSerafortStore({
      endpoint: 'https://api.test.serafort.com',
      storageType: 'memory',
      autoInitialize: false,
      client: mockClient,
    });

    await store.setToken('valid_svelte_token');

    expect(store.hasPermission('org:settings:update')).toBe(true);
    expect(store.hasPermission('analytics:read')).toBe(true);
    expect(store.hasPermission('analytics:write')).toBe(false);

    expect(store.hasRole('admin')).toBe(true);
    expect(store.hasRole('guest')).toBe(false);

    expect(store.hasTenant('tenant_sveltekit')).toBe(true);
    expect(store.hasTenant('other_tenant')).toBe(false);
  });

  it('resets store values on logout', async () => {
    const store = createSerafortStore({
      endpoint: 'https://api.test.serafort.com',
      storageType: 'memory',
      autoInitialize: false,
      client: mockClient,
    });

    await store.setToken('valid_svelte_token');
    expect(get(store.isAuthenticated)).toBe(true);

    store.logout();
    expect(get(store.isAuthenticated)).toBe(false);
    expect(get(store.user)).toBeNull();
    expect(get(store.token)).toBeNull();
  });

  it('SvelteKit createSerafortHandle populates event.locals.serafort from header', async () => {
    const handle = createSerafortHandle({
      endpoint: 'https://api.test.serafort.com',
      client: mockClient,
    });

    const mockEvent = {
      request: new Request('https://app.example.com/api/test', {
        headers: { Authorization: 'Bearer valid_svelte_token' },
      }),
      cookies: { get: () => undefined },
      locals: {},
    } as any;

    const resolve = vi.fn().mockResolvedValue(new Response('OK'));
    await handle({ event: mockEvent, resolve });

    expect(resolve).toHaveBeenCalled();
    expect(mockEvent.locals.serafort.isAuthenticated).toBe(true);
    expect(mockEvent.locals.serafort.user?.userId).toBe('usr_svelte_789');
  });

  it('SvelteKit requireAuth enforces authentication and wildcard RBAC', () => {
    const authedEvent = {
      url: new URL('https://app.example.com/admin'),
      locals: {
        serafort: {
          isAuthenticated: true,
          user: mockUser,
          token: 'valid_svelte_token',
        },
      },
    } as any;

    // Allowed case
    const user = requireAuth(
      authedEvent,
      {
        tenantId: 'tenant_sveltekit',
        roles: ['admin'],
        permissions: ['org:billing'],
      },
      mockClient
    );
    expect(user.userId).toBe('usr_svelte_789');

    // Missing role throws 403
    expect(() =>
      requireAuth(authedEvent, { roles: ['superadmin'] }, mockClient)
    ).toThrow();

    // Unauthenticated throws redirect or error
    const unauthedEvent = {
      url: new URL('https://app.example.com/protected'),
      locals: { serafort: { isAuthenticated: false } },
    } as any;

    expect(() => requireAuth(unauthedEvent, {}, mockClient)).toThrow();
  });
});
