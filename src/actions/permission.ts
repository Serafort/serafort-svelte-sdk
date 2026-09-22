import type { SerafortStore } from '../client/store.js';

export interface PermissionActionParams {
  permission: string;
  store: SerafortStore;
}

/**
 * Svelte action to conditionally display or hide an element based on user permissions.
 *
 * Usage:
 * ```svelte
 * <button use:permission={{ permission: 'org:delete', store: serafort }}>
 *   Delete Organization
 * </button>
 * ```
 */
export function permission(node: HTMLElement, params: PermissionActionParams) {
  let unsubscribe: (() => void) | null = null;
  const originalDisplay = node.style.display;

  function update(newParams: PermissionActionParams) {
    if (unsubscribe) {
      unsubscribe();
    }

    unsubscribe = newParams.store.permissions.subscribe(() => {
      const hasAccess = newParams.store.hasPermission(newParams.permission);
      node.style.display = hasAccess ? originalDisplay : 'none';
    });
  }

  update(params);

  return {
    update(newParams: PermissionActionParams) {
      update(newParams);
    },
    destroy() {
      if (unsubscribe) {
        unsubscribe();
      }
    },
  };
}
