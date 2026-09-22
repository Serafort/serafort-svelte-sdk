import { redirect, error, type Handle, type RequestEvent } from '@sveltejs/kit';
import { SerafortClient, type UserContext } from '@serafort/core';
import type { SerafortSvelteConfig, ProtectOptions, ServerSession } from '../types.js';

export function createSerafortHandle(config: SerafortSvelteConfig): Handle {
  const cookieName = config.cookieName || '__serafort_token';
  const client =
    config.client ||
    new SerafortClient({
      endpoint: config.endpoint,
    });

  return async ({ event, resolve }) => {
    let token: string | null = null;

    // 1. Check Authorization header
    const authHeader = event.request.headers.get('Authorization') || event.request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    }

    // 2. Check Cookie
    if (!token) {
      token = event.cookies.get(cookieName) || null;
    }

    let session: ServerSession = {
      user: null,
      token: null,
      isAuthenticated: false,
    };

    if (token) {
      try {
        const user = await client.b2b.validateToken(token);
        session = {
          user,
          token,
          isAuthenticated: true,
        };
      } catch {
        session = {
          user: null,
          token: null,
          isAuthenticated: false,
        };
      }
    }

    (event.locals as any).serafort = session;

    return resolve(event);
  };
}

/**
 * Validates that the active request in SvelteKit is authenticated and meets all RBAC requirements.
 */
export function requireAuth(
  event: RequestEvent,
  options: ProtectOptions = {},
  clientInstance?: SerafortClient
): UserContext {
  const session = (event.locals as any).serafort as ServerSession | undefined;

  if (!session || !session.isAuthenticated || !session.user) {
    if (options.throwHttpError) {
      throw error(401, 'Authentication required');
    }
    const loginUrl = options.redirectTo || '/login';
    const returnUrl = encodeURIComponent(event.url.pathname + event.url.search);
    throw redirect(302, `${loginUrl}?returnUrl=${returnUrl}`);
  }

  const user = session.user;
  const client = clientInstance || new SerafortClient({ endpoint: 'https://api.serafort.com' });

  // Tenant check
  if (options.tenantId && user.tenantId !== options.tenantId) {
    if (options.throwHttpError) {
      throw error(403, 'Tenant access denied');
    }
    throw error(403, 'Tenant access denied');
  }

  // Roles check
  if (options.roles && options.roles.length > 0) {
    const hasRole = options.roles.some((r) => user.roles.includes(r));
    if (!hasRole) {
      throw error(403, `User lacks required role: ${options.roles.join(', ')}`);
    }
  }

  // Permissions check with wildcards
  if (options.permissions && options.permissions.length > 0) {
    for (const perm of options.permissions) {
      if (!client.b2b.hasPermission(user, perm)) {
        throw error(403, `User lacks required permission: ${perm}`);
      }
    }
  }

  return user;
}
