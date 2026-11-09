import { defineConfig } from 'vitest/config';
import { projectsOf } from '../../vitest.shared.ts';

/** The network format's validator and helpers (`test/unit/` mirrors `src/`). */
export default defineConfig({ test: { projects: projectsOf('schema') } });
