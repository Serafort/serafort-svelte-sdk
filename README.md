# @serafort/svelte

Enterprise IAM & B2B Authentication adapter for Svelte and SvelteKit applications.

## Features

- ⚡ **Svelte Reactive Stores**: `createSerafortStore` with reactive `user`, `token`, `isAuthenticated`, `tenantId`, `roles`, and `permissions` stores.
- 🛠️ **SvelteKit Server Hooks**: `createSerafortHandle` parses cookies and `Authorization` headers, exposing `event.locals.serafort`.
- 🛡️ **Load & Page Protection**: `requireAuth(event, { permissions: ['org:*'] })` with automatic 302 redirects or 401/403 errors.
- 🎯 **Svelte Actions**: `use:permission={{ permission: 'org:*', store }}` for declarative DOM visibility control.
- 🏢 **Multi-Tenant Isolation**: Built-in verification for tenant boundaries and wildcard permissions.

## Installation

```bash
npm install @serafort/svelte @serafort/core
```

## Quick Start

### 1. SvelteKit Server Hook

```typescript
// src/hooks.server.ts
import { createSerafortHandle } from '@serafort/svelte';

export const handle = createSerafortHandle({
  endpoint: 'https://api.serafort.com',
  cookieName: '__serafort_token',
});
```

### 2. Protect Server Load Functions

```typescript
// src/routes/dashboard/+page.server.ts
import { requireAuth } from '@serafort/svelte';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
  const user = requireAuth(event, {
    roles: ['admin'],
    permissions: ['org:*'],
  });

  return { user };
};
```

### 3. Client Components & Actions

```svelte
<!-- src/routes/+page.svelte -->
<script lang="ts">
  import { createSerafortStore, permission } from '@serafort/svelte';

  const serafort = createSerafortStore({
    endpoint: 'https://api.serafort.com',
  });

  const { isAuthenticated, user, logout } = serafort;
</script>

{#if $isAuthenticated}
  <h2>Hello, {$user?.userId}</h2>

  <!-- Action-based permission check -->
  <button use:permission={{ permission: 'org:delete', store: serafort }}>
    Delete Organization
  </button>

  <button on:click={logout}>Sign Out</button>
{/if}
```
