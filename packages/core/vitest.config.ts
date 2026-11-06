import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { assertTestsMirrorSource, projectsOf } from '../../vitest.shared.ts';

const ROOT = fileURLToPath(new URL('.', import.meta.url));

assertTestsMirrorSource(ROOT, 'test/unit', 'src');

/** Helpers about nothing in rail: dates, geometry, `required`, a priority queue (`test/unit/` mirrors `src/`). */
export default defineConfig({ test: { projects: projectsOf('core') } });
