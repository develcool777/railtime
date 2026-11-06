import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { assertTestsMirrorCities, assertTestsMirrorSource, projectsOf } from '../../vitest.shared.ts';

const ROOT = fileURLToPath(new URL('.', import.meta.url));

for (const feature of ['summary', 'boundary', 'preview']) assertTestsMirrorSource(ROOT, `test/unit/${feature}`, `src/${feature}`);
assertTestsMirrorCities(ROOT);

/**
 * The cities and their tools: `test/unit/<feature>/` mirrors `src/<feature>/`, and `test/unit/cities/`
 * plays each city in `cities/` through the renderer.
 */
export default defineConfig({
  test: {
    projects: projectsOf('data', {
      test: {
        // `pnpm test-bench`: the work a visitor waits on, timed on the largest city. Vite's module runner
        // reads each export through a getter, which a hot loop pays for: every run pays it alike, so a run
        // set beside the last is fair, though each time reads a little high. (Node's own `import` cannot
        // run the renderer, whose imports leave off `.ts`.)
        benchmark: { include: ['test/bench/**/*.bench.ts'], suppressExportGetterWarnings: true },
      },
    }),
  },
});
