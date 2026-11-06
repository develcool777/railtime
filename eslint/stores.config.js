import { house } from './shared.js';

/** A store, the one source of truth for what it holds: Pinia keeps it whole only when it is returned. */
export const storesConfig = [
  {
    files: ['web/src/**/*.store.ts'],
    plugins: { house },
    rules: { 'house/store-returns-state': 'error', 'house/store-shape': 'error' },
  },
];
