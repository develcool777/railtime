import { fileURLToPath } from 'node:url';
import { defineProject } from 'vitest/config';
import { SHARED_TEST_OPTIONS, assertTestsMirrorDatasets, assertTestsMirrorSource } from '../../vitest.shared.ts';

const ROOT = fileURLToPath(new URL('.', import.meta.url));

assertTestsMirrorSource(ROOT, 'test/unit/dataset', 'src/dataset');
assertTestsMirrorSource(ROOT, 'test/unit/preview', 'src/preview');
assertTestsMirrorDatasets(ROOT);

/**
 * The datasets and their tools: `test/unit/dataset/` and `test/unit/preview/` mirror `src/`'s, and `test/unit/cities/`
 * plays each city in `cities/` through the renderer.
 */
export default defineProject({
  test: {
    ...SHARED_TEST_OPTIONS,
    name: 'data',
    include: ['test/unit/**/*.test.ts'],
  },
});
