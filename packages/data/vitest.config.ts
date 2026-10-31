import { fileURLToPath } from 'node:url';
import { defineProject } from 'vitest/config';
import { SHARED_TEST_OPTIONS, assertTestsMirrorCities, assertTestsMirrorSource } from '../../vitest.shared.ts';

const ROOT = fileURLToPath(new URL('.', import.meta.url));

for (const feature of ['summary', 'boundary', 'preview']) assertTestsMirrorSource(ROOT, `test/unit/${feature}`, `src/${feature}`);
assertTestsMirrorCities(ROOT);

/**
 * The cities and their tools: `test/unit/<feature>/` mirrors `src/<feature>/`, and `test/unit/cities/`
 * plays each city in `cities/` through the renderer.
 */
export default defineProject({
  test: {
    ...SHARED_TEST_OPTIONS,
    name: 'data',
    include: ['test/unit/**/*.test.ts'],
  },
});
