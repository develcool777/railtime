import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import { house } from './shared.js';

/** A package is reached through its door (`exports`), never by a path into its folders. */
const ACROSS_PACKAGES = {
  regex: '(^|/)(core|schema|network|renderer|data|tooling|video)/(src|test)/',
  message: "Import another package by its exports (`@railtime/<package>/…`, its tests' helpers from `@railtime/<package>/testing/…`).",
};

/** What `@railtime/network/engine.*` is for: the renderer's, never the app's or the data commands'. */
const NETWORK_ENGINE = {
  group: ['@railtime/network/engine.*'],
  message: "Ask NetworkFacts (@railtime/network/facts.service): NetworkEngine is the renderer's.",
};

/** The data commands run under Node's type stripping, which finds a file only by its whole name. */
const NAMED_FILE = {
  regex: String.raw`^\.{1,2}/.*(?<!\.ts)$`,
  allowTypeImports: true,
  message: 'A runtime import names its file, `.ts` included: the data commands run this code under Node.',
};

/** What a `*.utils.ts` may not take at run time: a store, a composable, Vue, the map. Its types are erased, so they may. */
const IMPURE = {
  regex: String.raw`^(vue|pinia|#imports|maplibre-gl|@vueuse/.*)$|\.(store|composable)(\.ts)?$`,
  allowTypeImports: true,
  message: 'A utils file is pure: no store, composable, Vue or map. Take what it needs as arguments, or move this into a store or composable.',
};

/** How imports are written, in one sorted block with no circles, and what each package may import. */
export const importsConfig = [
  {
    files: ['**/*.{js,ts,vue}'],
    settings: {
      // Nuxt's generated `#imports` re-exports every composable: read through, every file importing it
      // would look like a circle.
      'import-x/ignore': [String.raw`[/\\]\.nuxt[/\\]`],
      'import-x/resolver-next': [
        createTypeScriptImportResolver({
          project: ['packages/*/tsconfig.json', 'web/.nuxt/tsconfig.app.json', 'web/.nuxt/tsconfig.node.json'],
          noWarnOnMultipleProjects: true,
        }),
      ],
    },
    rules: {
      // Imports: packages (`node:` among them), then the app's own (`~/`, `@test/`), then relative,
      // one run with no blank lines (as in dataroom-ui), each group in order; `eslint --fix` sorts them.
      'import-x/order': [
        'error',
        {
          groups: [['builtin', 'external'], 'internal', ['parent', 'sibling', 'index']],
          pathGroups: [{ pattern: '{~,@test}/**', group: 'internal' }],
          pathGroupsExcludedImportTypes: ['builtin'],
          'newlines-between': 'never',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      'import-x/first': 'error',
      'import-x/newline-after-import': 'error',
      'import-x/no-duplicates': 'error',
      // Stores, packages and modules read one another one way: never in a circle.
      'import-x/no-cycle': 'error',
      // TypeScript checks every import already, what it finds and what it takes (`#imports` and `~/` too).
      'import-x/no-unresolved': 'off',
      'import-x/named': 'off',
      'import-x/default': 'off',
      'import-x/namespace': 'off',
      'import-x/no-named-as-default': 'off',
      'import-x/no-named-as-default-member': 'off',
    },
  },

  // Another package only through its exports; the network's engine only in the renderer
  // (`NetworkEngine` is the raw network it plays and draws, and every fact comes from `NetworkFacts`);
  // and in the code the data commands run, each file by its whole name.
  {
    files: ['packages/**/*.ts', 'web/**/*.{ts,vue}'],
    rules: { 'no-restricted-imports': ['error', { patterns: [ACROSS_PACKAGES] }] },
  },
  {
    files: ['packages/{core,schema,network}/src/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: [ACROSS_PACKAGES, NAMED_FILE] }] },
  },
  {
    files: ['web/src/**/*.{ts,vue}'],
    rules: { 'no-restricted-imports': ['error', { patterns: [ACROSS_PACKAGES, NETWORK_ENGINE] }] },
  },
  {
    files: ['packages/{data,video}/src/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: [ACROSS_PACKAGES, NETWORK_ENGINE, NAMED_FILE] }] },
  },
  // Pure first: a `*.utils.ts` takes what it needs as arguments, so it runs and is tested anywhere.
  {
    files: ['packages/*/src/**/*.utils.ts', 'web/src/**/*.utils.ts'],
    plugins: { house },
    rules: { 'house/pure-utils': ['error', { patterns: [IMPURE] }] },
  },
];
