import { fileURLToPath } from 'node:url';
import { defineProject } from 'vitest/config';
import { SHARED_TEST_OPTIONS, assertTestsMirrorSource } from '../../vitest.shared.ts';

const ROOT = fileURLToPath(new URL('.', import.meta.url));

assertTestsMirrorSource(ROOT, 'test/unit', 'src');

/** Helpers about nothing in rail: dates, geometry, `required`, a priority queue (`test/unit/` mirrors `src/`). */
export default defineProject({
  test: {
    ...SHARED_TEST_OPTIONS,
    name: 'core',
    include: ['test/unit/**/*.test.ts'],
  },
});
