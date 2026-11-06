import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { assertTestsMirrorSource, projectsOf } from '../../vitest.shared.ts';

const ROOT = fileURLToPath(new URL('.', import.meta.url));

assertTestsMirrorSource(ROOT, 'test/unit', 'src');

/** The network through time and every fact about it (`test/unit/` mirrors `src/`). */
export default defineConfig({ test: { projects: projectsOf('network') } });
