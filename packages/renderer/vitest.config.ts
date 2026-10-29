import { fileURLToPath } from 'node:url';
import { defineProject } from 'vitest/config';
import { SHARED_TEST_OPTIONS, assertTestsMirrorSource } from '../../vitest.shared.ts';

const ROOT = fileURLToPath(new URL('.', import.meta.url));

assertTestsMirrorSource(ROOT, 'test/unit', 'src');

/** The renderer's pure logic (`test/unit/` mirrors `src/`), in node: nothing here needs a map. */
export default defineProject({
  test: {
    ...SHARED_TEST_OPTIONS,
    name: 'renderer',
    include: ['test/unit/**/*.test.ts'],
  },
});
