import { house, TOOL_CONFIGS } from './shared.js';

/** A test's helpers trust what they are given (`stationId('a')`, `asNetwork`), as a test may: source checks instead. */
const TEST_HELPERS = {
  group: ['@railtime/*/testing/*'],
  message:
    "Source never takes a test's helpers, which trust what they are given: a string becomes an id by `isStationIn`/`isLineIn`/`isPlanIn` (`@railtime/schema/ids.utils`), a file a network by `parseNetwork`.",
};

/** Ids: a string becomes one only where it is checked (CLAUDE.md), and keeps its kind once it is one. */
export const idsConfig = [
  {
    files: ['**/*.{ts,vue}'],
    ignores: TOOL_CONFIGS,
    plugins: { house },
    rules: { 'house/checked-ids': 'error', 'house/branded-spread-key': 'error', 'house/branded-record-keys': 'error', 'house/served-files': 'error' },
  },
  // The doors: Zod reading a city's file, and the ids a test names.
  { files: ['packages/schema/src/validation/shape.schema.ts', 'packages/schema/test/support/ids.utils.ts'], rules: { 'house/checked-ids': 'off' } },
  // A city's file typed at a door: Zod's, which checks it; the browser's, which trusts what CI checked; a test's own network.
  {
    files: ['packages/schema/src/validation/*.schema.ts', 'packages/schema/src/validation/served.utils.ts', 'packages/schema/test/support/ids.utils.ts'],
    rules: { 'house/served-files': 'off' },
  },
  {
    files: ['packages/*/src/**/*.ts', 'web/src/**/*.{ts,vue}'],
    plugins: { house },
    rules: { 'house/test-helpers': ['error', { patterns: [TEST_HELPERS] }] },
  },
];
