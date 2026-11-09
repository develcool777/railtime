import { defineConfig } from 'vitest/config';
import { projectsOf } from '../../vitest.shared.ts';

/** The network through time and every fact about it (`test/unit/` mirrors `src/`). */
export default defineConfig({ test: { projects: projectsOf('network') } });
