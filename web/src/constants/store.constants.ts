/**
 * The `defineStore` id of every Pinia store, collected so two stores cannot share one: Pinia takes an
 * id for the store itself, and two `defineStore` calls with one return the same store, their state
 * merged. An entry is an object's property, which knip cannot see is unused: `store.test.ts` fails for
 * an id no store has, as for a store whose id is written in place.
 */
export const STORE_IDS = {
  EXPLORER: 'explorer',
  EXPLORER_NETWORK: 'explorerNetwork',
  EXPLORER_MAP: 'explorerMap',
  EXPLORER_LAYOUT: 'explorerLayout',
  EXPLORER_TIME: 'explorerTime',
  EXPLORER_TOOLS: 'explorerTools',
  EXPLORER_PANEL: 'explorerPanel',
  VIDEO: 'video',
} as const;
