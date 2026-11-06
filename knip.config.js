/** What a package's tests are entered by. */
const TESTS = 'test/**/*.@(test|spec).ts';

/** A package's own files: its source and its tests. */
const PROJECT = ['src/**/*.ts', 'test/**/*.ts'];

/**
 * What `pnpm code-quality:dead-code` reads: each workspace's entries, and the files nothing may leave unused.
 * @type {import('knip').KnipConfig}
 */
export default {
  workspaces: {
    '.': { entry: ['vitest.shared.ts'], project: ['vitest.*.ts', 'eslint/*.js'] },
    'packages/data': { entry: ['src/*/cli.ts', 'src/*/*.entry.ts', 'test/**/*.@(test|spec|bench).ts'], project: PROJECT },
    'packages/core': { entry: [TESTS], project: PROJECT },
    'packages/schema': { entry: [TESTS], project: PROJECT },
    'packages/network': { entry: [TESTS], project: PROJECT },
    'packages/renderer': { entry: [TESTS], project: PROJECT },
    web: {
      entry: ['src/pages/**/*.vue', TESTS],
      project: ['src/**/*.{ts,vue,css}', 'test/**/*.ts'],
      // Neither is imported: Nuxt Icon finds the icons by their package, and `nuxt typecheck` runs vue-tsc.
      ignoreDependencies: ['@iconify-json/lucide', 'vue-tsc'],
    },
    'packages/video': { entry: ['src/*/cli.ts', TESTS], project: PROJECT },
    'packages/tooling': { entry: ['src/cli.*.ts', TESTS], project: PROJECT },
  },
};
