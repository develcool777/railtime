import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { assertTestsMirrorSource, projectsOf } from '../vitest.shared.ts';

const ROOT = fileURLToPath(new URL('.', import.meta.url));

assertTestsMirrorSource(ROOT, 'test/unit', 'src');

/** The app's plain helpers and stores (`test/unit/` mirrors `src/`), which import it as Nuxt does, from `~/`, and their factories from `@test/`. */
export default defineConfig({ test: { projects: projectsOf('web', { resolve: { alias: { '~': `${ROOT}src`, '@test': `${ROOT}test` } } }) } });
