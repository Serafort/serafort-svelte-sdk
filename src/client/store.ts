import { writable, derived, type Readable } from 'svelte/store';
import { SerafortClient, type UserContext } from '@serafort/core';
import type { SerafortSvelteConfig, AuthState, TokenStorageType } from '../types.js';

export interface SerafortStore extends Readable<AuthState> {
  user: Readable<UserContext | null>;
  token: Readable<string | null>;
  isAuthenticated: Readable<boolean>;
  tenantId: Readable<string | null>;
  roles: Readable<string[]>;
  permissions: Readable<string[]>;
  isLoading: Readable<boolean>;
  error: Readable<string | null>;
  client: SerafortClient;

  initialize(): Promise<void>;
  setToken(token: string): Promise<UserContext>;
  logout(): void;
  hasRole(role: string): boolean;
  hasPermission(permission: string): boolean;
  hasTenant(tenantId: string): boolean;
  getLoginUrl(): string;
}

export function createSerafortStore(config: SerafortSvelteConfig): SerafortStore {
  const options = {
    tokenStorageKey: '__serafort_token',
    storageType: 'localStorage' as TokenStorageType,
    loginUrl: '/login',
    autoInitialize: true,
    ...config,
  };

  const client =
    options.client ||
    new SerafortClient({
      endpoint: options.endpoint,
    });

  let memoryToken: string | null = null;

  const state = writable<AuthState>({
    isAuthenticated: false,
    user: null,
    token: null,
    isLoading: true,
    error: null,
  });

  let currentState: AuthState = {
    isAuthenticated: false,
    user: null,
    token: null,
    isLoading: true,
    error: null,
  };

  state.subscribe((val) => {
    currentState = val;
  });

  const isAuthenticated = derived(state, ($s) => $s.isAuthenticated);
  const user = derived(state, ($s) => $s.user);
  const token = derived(state, ($s) => $s.token);
  const tenantId = derived(state, ($s) => $s.user?.tenantId ?? null);
  const roles = derived(state, ($s) => $s.user?.roles ?? []);
  const permissions = derived(state, ($s) => $s.user?.permissions ?? []);
  const isLoading = derived(state, ($s) => $s.isLoading);
  const error = derived(state, ($s) => $s.error);

  function readStoredToken(): string | null {
    if (typeof window === 'undefined') return null;
    const key = options.tokenStorageKey;
    const type = options.storageType;

    if (type === 'localStorage') {
      return window.localStorage.getItem(key);
    } else if (type === 'sessionStorage') {
      return window.sessionStorage.getItem(key);
    } else {
      return memoryToken;
    }
  }

  function writeStoredToken(tok: string): void {
    const key = options.tokenStorageKey;
    const type = options.storageType;

    if (typeof window !== 'undefined') {
      if (type === 'localStorage') {
        window.localStorage.setItem(key, tok);
      } else if (type === 'sessionStorage') {
        window.sessionStorage.setItem(key, tok);
      }
    }
    memoryToken = tok;
  }

  function clearStoredToken(): void {
    const key = options.tokenStorageKey;
    const type = options.storageType;

    if (typeof window !== 'undefined') {
      if (type === 'localStorage') {
        window.localStorage.removeItem(key);
      } else if (type === 'sessionStorage') {
        window.sessionStorage.removeItem(key);
      }
    }
    memoryToken = null;
  }

  async function initialize(): Promise<void> {
    state.update((s) => ({ ...s, isLoading: true, error: null }));
    const stored = readStoredToken();

    if (!stored) {
      state.set({
        isAuthenticated: false,
        user: null,
        token: null,
        isLoading: false,
        error: null,
      });
      return;
    }

    try {
      const u = await client.b2b.validateToken(stored);
      state.set({
        isAuthenticated: true,
        user: u,
        token: stored,
        isLoading: false,
        error: null,
      });
    } catch (err: any) {
      clearStoredToken();
      state.set({
        isAuthenticated: false,
        user: null,
        token: null,
        isLoading: false,
        error: err?.message || 'Token validation failed',
      });
    }
  }

  async function setToken(tok: string): Promise<UserContext> {
    state.update((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const u = await client.b2b.validateToken(tok);
      writeStoredToken(tok);
      state.set({
        isAuthenticated: true,
        user: u,
        token: tok,
        isLoading: false,
        error: null,
      });
      return u;
    } catch (err: any) {
      state.update((s) => ({
        ...s,
        isLoading: false,
        error: err?.message || 'Invalid token',
      }));
      throw err;
    }
  }

  function logout(): void {
    clearStoredToken();
    state.set({
      isAuthenticated: false,
      user: null,
      token: null,
      isLoading: false,
      error: null,
    });
  }

  function hasRole(role: string): boolean {
    return currentState.user?.roles.includes(role) ?? false;
  }

  function hasPermission(permission: string): boolean {
    const u = currentState.user;
    if (!u) return false;
    return client.b2b.hasPermission(u, permission);
  }

  function hasTenant(tId: string): boolean {
    return currentState.user?.tenantId === tId;
  }

  function getLoginUrl(): string {
    return options.loginUrl;
  }

  if (options.autoInitialize) {
    void initialize();
  }

  return {
    subscribe: state.subscribe,
    user,
    token,
    isAuthenticated,
    tenantId,
    roles,
    permissions,
    isLoading,
    error,
    client,
    initialize,
    setToken,
    logout,
    hasRole,
    hasPermission,
    hasTenant,
    getLoginUrl,
  };
}
