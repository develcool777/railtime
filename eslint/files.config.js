import checkFile from 'eslint-plugin-check-file';
import { CLI_FILES, TEST_FILES, TOOL_CONFIGS } from './shared.js';

/**
 * What a source file may be called: `<camelName>.<role>.ts`, or `<camelName>.<role>.types.ts` for the
 * types of one file. A `.entry.ts` is a page's script, which esbuild bundles for the browser.
 */
const SOURCE_FILE = '+([a-z])*([a-zA-Z0-9])?(.@(service|utils|composable|store)).@(service|utils|constants|types|schema|composable|store|entry)';
/**
 * What a test file may be called: `<camelName>.test.ts`, run in node, `.spec.ts`, in happy-dom
 * (`vitest.shared.ts`), `.bench.ts`, timed (`pnpm test-bench`), or a support file's
 * `.utils.ts`/`.types.ts`/`.constants.ts`.
 */
const TEST_FILE = '+([a-z])*([a-zA-Z0-9]).@(test|spec|bench|utils|types|constants)';
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
      // A test is in `test/unit/` (beside the code it mirrors), a benchmark in `test/bench/`, and what
      // they share in `test/support/`.
      'check-file/folder-match-with-fex': [
        'error',
        { '*.test.ts': '**/test/unit/**', '*.spec.ts': '**/test/unit/**', '*.bench.ts': '**/test/bench/**', '*.utils.ts': '**/test/support/**' },
      ],
    },
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
