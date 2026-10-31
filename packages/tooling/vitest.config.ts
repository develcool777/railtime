import { fileURLToPath } from 'node:url';
import { defineProject } from 'vitest/config';
import { SHARED_TEST_OPTIONS, assertTestsMirrorSource } from '../../vitest.shared.ts';

const ROOT = fileURLToPath(new URL('.', import.meta.url));

assertTestsMirrorSource(ROOT, 'test/unit', 'src');

/** The repo's own tools (`test/unit/` mirrors `src/`): what `pnpm test-mutation` runs, and how it keeps score. */
export default defineProject({
  test: {
    ...SHARED_TEST_OPTIONS,
    name: 'tooling',
    include: ['test/unit/**/*.test.ts'],
  },
});
