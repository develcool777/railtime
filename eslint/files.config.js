import checkFile from 'eslint-plugin-check-file';
import { CLI_FILES, house, TEST_FILES, TOOL_CONFIGS } from './shared.js';

/**
 * What a source file may be called: `<camelName>.<role>.ts`, or `<camelName>.<role>.types.ts` for the
 * types of one file. A `.entry.ts` is a page's script, which esbuild bundles for the browser.
 */
const SOURCE_FILE = '+([a-z])*([a-zA-Z0-9])?(.@(service|utils|composable|store)).@(service|utils|constants|types|schema|composable|store|entry)';
/**
 * What a test file may be called: the source file it tests, `<camelName>.<role>`, then `.test.ts`, run
 * in node, or `.spec.ts`, in happy-dom (`vitest.shared.ts`); a benchmark's `<camelName>.bench.ts`,
 * timed (`pnpm test-bench`); the site's in a browser, `<camelName>.e2e.ts` (`web/playwright.config.ts`),
 * named for the surface it opens; or a support file's `.utils.ts`/`.types.ts`/`.constants.ts`.
 */
const TEST_FILE = '+([a-z])*([a-zA-Z0-9])?(.@(service|utils|constants|schema|composable|store|entry)).@(test|spec|bench|e2e|utils|types|constants)';
/** A command's file name. */
const SCRIPT_FILE = 'cli?(.+([a-zA-Z0-9]))';
/** What files and folders are called, and where each kind lives. */
export const filesConfig = [
  // No file passes 500 lines: a subject that big splits by job. Every line counts, comments too, as the
  // convention says: a file's doc comments are what a reader has to get through. A test is exempt: it
  // lists cases, one after another, and a long list of them reads no harder than a short one.
  {
    files: ['packages/*/src/**/*.ts', 'web/src/**/*.{ts,vue}'],
    rules: { 'max-lines': ['error', { max: 500, skipBlankLines: false, skipComments: false }] },
  },
  {
    files: ['packages/*/src/**/*.ts', 'web/src/**/*.ts'],
    ignores: [...TOOL_CONFIGS, ...CLI_FILES],
    plugins: { 'check-file': checkFile },
    rules: {
      'check-file/filename-naming-convention': ['error', { '**/*.ts': SOURCE_FILE }],
      'check-file/folder-naming-convention': ['error', { '**/': 'CAMEL_CASE' }],
      // No barrels, no `types/` folders: a file's types sit beside it, as `<name>.types.ts`.
      'check-file/filename-blocklist': ['error', { '**/index.ts': '*.utils.ts', '**/types/**/*.ts': '*.types.ts' }],
    },
  },
  {
    files: TEST_FILES,
    plugins: { 'check-file': checkFile },
    rules: {
      'check-file/filename-naming-convention': ['error', { '**/*.ts': TEST_FILE }],
      'check-file/folder-naming-convention': ['error', { '**/': 'CAMEL_CASE' }],
      // A test is in `test/unit/` (beside the code it mirrors), a benchmark in `test/bench/`, the site's
      // in a browser in `test/e2e/`, and what they share in `test/support/`.
      'check-file/folder-match-with-fex': [
        'error',
        {
          '*.test.ts': '**/test/unit/**',
          '*.spec.ts': '**/test/unit/**',
          '*.bench.ts': '**/test/bench/**',
          '*.e2e.ts': '**/test/e2e/**',
          '*.utils.ts': '**/test/support/**',
        },
      ],
    },
  },
  // A test and the file it tests are named for each other, suffix and all, as in dataroom-ui
  // (`house/mirrored-tests`): every test names a source file that is there, and each service, utils
  // and store, where the logic is, has its test. A rename or a delete that leaves either behind fails.
  {
    files: ['packages/*/src/**/*.{service,utils,store}.ts', 'web/src/**/*.{service,utils,store}.ts', 'packages/*/test/unit/**/*.ts', 'web/test/unit/**/*.ts'],
    ignores: [
      ...CLI_FILES,
      // A city's test checks the city's network, not code: the data package's Vitest config finds each
      // one's city (`assertTestsMirrorCities`).
      'packages/data/test/unit/cities/**',
    ],
    plugins: { house },
    rules: { 'house/mirrored-tests': 'error' },
  },
  {
    files: CLI_FILES,
    plugins: { 'check-file': checkFile },
    rules: { 'check-file/filename-naming-convention': ['error', { '**/*.ts': SCRIPT_FILE }] },
  },
  {
    files: ['web/src/**/components/**/*.vue'],
    plugins: { 'check-file': checkFile },
    rules: { 'check-file/filename-naming-convention': ['error', { '**/*.vue': 'PASCAL_CASE' }] },
  },
  // Tool configs export what their tool expects.
  {
    files: TOOL_CONFIGS,
    rules: { '@typescript-eslint/naming-convention': 'off', 'id-length': 'off' },
  },
];
