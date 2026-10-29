import { fileURLToPath } from 'node:url';
import { defineProject } from 'vitest/config';
import { SHARED_TEST_OPTIONS, assertTestsMirrorSource } from '../../vitest.shared.ts';

const ROOT = fileURLToPath(new URL('.', import.meta.url));

assertTestsMirrorSource(ROOT, 'test/unit', 'src');

/** The network format's validator and helpers (`test/unit/` mirrors `src/`). */
export default defineProject({
  test: {
    ...SHARED_TEST_OPTIONS,
    name: 'schema',
    include: ['test/unit/**/*.test.ts'],
  },
});
