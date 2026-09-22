import type { UserContext, SerafortClient } from '@serafort/core';

export type TokenStorageType = 'localStorage' | 'sessionStorage' | 'memory';

export interface SerafortSvelteConfig {
  /** Serafort IAM backend endpoint */
  endpoint: string;
  /** Client ID for B2B or M2M client applications */
  clientId?: string;
  /** Storage key for the access token in browser storage. Default: '__serafort_token' */
  tokenStorageKey?: string;
  /** Cookie name for SvelteKit server-side auth. Default: '__serafort_token' */
  cookieName?: string;
  /** Storage mechanism for browser. Default: 'localStorage' */
  storageType?: TokenStorageType;
  /** Default redirect URL when unauthenticated. Default: '/login' */
  loginUrl?: string;
  /** Optional pre-configured SerafortClient instance */
  client?: SerafortClient;
  /** Automatically validate token on store creation. Default: true */
  autoInitialize?: boolean;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: UserContext | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
}

export interface ProtectOptions {
  /** Required permissions with wildcard support (e.g. 'org:*') */
  permissions?: string[];
  /** Required roles */
  roles?: string[];
  /** Required tenant ID */
  tenantId?: string;
  /** Optional custom redirect URL */
  redirectTo?: string;
  /** Throw SvelteKit HTTP error (401/403) instead of 302 redirect */
  throwHttpError?: boolean;
}

export interface ServerSession {
  user: UserContext | null;
  token: string | null;
  isAuthenticated: boolean;
}
