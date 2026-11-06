import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { assertTestsMirrorSource, projectsOf } from '../../vitest.shared.ts';

const ROOT = fileURLToPath(new URL('.', import.meta.url));

assertTestsMirrorSource(ROOT, 'test/unit', 'src');

/** The videos made of the app (`test/unit/` mirrors `src/`): recording a page of it frame by frame. */
export default defineConfig({ test: { projects: projectsOf('video') } });
