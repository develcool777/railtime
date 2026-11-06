import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { assertTestsMirrorSource, projectsOf } from '../../vitest.shared.ts';

const ROOT = fileURLToPath(new URL('.', import.meta.url));

assertTestsMirrorSource(ROOT, 'test/unit', 'src');

/** The repo's own tools (`test/unit/` mirrors `src/`): what `pnpm test-mutation` runs, and how it keeps score. */
export default defineConfig({ test: { projects: projectsOf('tooling') } });
