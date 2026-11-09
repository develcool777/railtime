import { defineConfig } from 'vitest/config';
import { projectsOf } from '../../vitest.shared.ts';

/** The repo's own tools (`test/unit/` mirrors `src/`): what `pnpm test-mutation` runs, and how it keeps score. */
export default defineConfig({ test: { projects: projectsOf('tooling') } });
