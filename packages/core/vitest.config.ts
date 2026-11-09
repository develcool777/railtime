import { defineConfig } from 'vitest/config';
import { projectsOf } from '../../vitest.shared.ts';

/** Helpers about nothing in rail: dates, geometry, `required`, a priority queue (`test/unit/` mirrors `src/`). */
export default defineConfig({ test: { projects: projectsOf('core') } });
