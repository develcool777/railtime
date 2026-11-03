import { fileURLToPath } from 'node:url';
import { defineProject } from 'vitest/config';
import { SHARED_TEST_OPTIONS, assertTestsMirrorSource } from '../../vitest.shared.ts';

const ROOT = fileURLToPath(new URL('.', import.meta.url));

assertTestsMirrorSource(ROOT, 'test/unit', 'src');

/** The videos made of the app (`test/unit/` mirrors `src/`): recording a page of it frame by frame. */
export default defineProject({
  test: {
    ...SHARED_TEST_OPTIONS,
    name: 'video',
    include: ['test/unit/**/*.test.ts'],
  },
});
