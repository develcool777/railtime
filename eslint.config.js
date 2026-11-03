import checkFile from 'eslint-plugin-check-file';
import jsdoc from 'eslint-plugin-jsdoc';
import sonarjs from 'eslint-plugin-sonarjs';
import vuePlugin from 'eslint-plugin-vue';
import vueAccessibility from 'eslint-plugin-vuejs-accessibility';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import vueParser from 'vue-eslint-parser';
import eslint from '@eslint/js';

/**
 * The code conventions (CLAUDE.md), as rules, so they hold without anyone remembering them:
 *
 *   - arrow functions only, never `function`
 *   - no `for (;;)` / `while (true)`: loops say what they loop over
 *   - classes only in `*.service.ts` (several of one subject may share one); helpers in `*.utils.ts`,
 *     constants in `*.constants.ts`, types in `*.types.ts`
 *   - every class member has an access modifier; every class, member and export has JSDoc
 *   - names say what they hold: no one- or two-letter names but a few well-known ones
 */

/** Loop and function shapes banned everywhere. */
const SHARED_SYNTAX = [
  { selector: 'ForStatement[test=null]', message: 'No `for (;;)`: loop over something (`while (queue.length > 0)`, `for (const item of items)`).' },
  { selector: "WhileStatement[test.type='Literal']", message: 'No `while (true)`: put the real condition in the loop head.' },
  { selector: 'FunctionDeclaration', message: 'Use an arrow function: `const name = (…) => …`.' },
  { selector: 'FunctionExpression:not(MethodDefinition > FunctionExpression)', message: 'Use an arrow function.' },
];

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
  regex: '^\\.{1,2}/.*(?<!\\.ts)$',
  allowTypeImports: true,
  message: 'A runtime import names its file, `.ts` included: the data commands run this code under Node.',
};

/** Outside a `*.service.ts`, a class is in the wrong file. */
const NO_CLASS_OUTSIDE_SERVICE = { selector: 'ClassDeclaration', message: 'Classes live in a `*.service.ts` file.' };

/** Short names allowed because everyone reads them the same way. */
const SHORT_NAMES = ['id', 'x', 'y', 'km', 'on', 'to', '_'];

/** What a source file may be called: `<camelName>.<role>.ts`, or `<camelName>.<role>.types.ts` for the types of one file. */
const SOURCE_FILE = '+([a-z])*([a-zA-Z0-9])?(.@(service|utils|composable|store)).@(service|utils|constants|types|schema|composable|store)';
/** What a test file may be called: `<camelName>.test.ts`, run in node, `.spec.ts`, in happy-dom (`vitest.shared.ts`), or a support file's `.utils.ts`/`.types.ts`/`.constants.ts`. */
const TEST_FILE = '+([a-z])*([a-zA-Z0-9]).@(test|spec|utils|types|constants)';

/** Each package's tests, beside its code: `test/unit/` mirrors `src/`, `test/support/` is what they share. */
const TEST_FILES = ['packages/*/test/**/*.ts', 'web/test/**/*.ts'];

/**
 * Tests run the real code, as in dataroom-ui: a test that mocks our own module ends up testing the
 * mock. One way to write a test, so they read alike.
 */
const TEST_SYNTAX = [
  {
    selector: "CallExpression[callee.object.name='vi'][callee.property.name=/^(mock|doMock)$/]",
    message: 'Tests run the real code: no vi.mock. Build the input with a factory in test/support/.',
  },
  { selector: "CallExpression[callee.name='it']", message: 'Write `test(…)`, not `it(…)`.' },
];
const SCRIPT_FILE = 'cli?(.+([a-zA-Z0-9]))';
/**
 * Commands run with node: `src/cli.<name>.ts`, or a feature's own, `src/<feature>/cli.ts`
 * (`pnpm data:boundary`), which only hands its arguments to the feature's service.
 */
const CLI_FILES = ['packages/*/src/cli.*.ts', 'packages/*/src/*/cli.ts'];

/** Config files at a package root follow their tool's naming, not ours. */
const TOOL_CONFIGS = ['**/*.config.{js,ts,mjs}', '**/nuxt.config.ts', '**/app.config.ts'];

export default defineConfig(
  eslint.configs.recommended,
  tseslint.configs.recommended,
  ...vuePlugin.configs['flat/recommended'],
  // What a screen reader or a keyboard needs of a template: labels, roles, keys for what is clicked.
  ...vueAccessibility.configs['flat/recommended'],
  sonarjs.configs.recommended,

  { ignores: ['**/dist/', '**/node_modules/', '**/.nuxt/', '**/.output/', '**/test-reports/', 'web/public/'] },

  // ---- Everything -----------------------------------------------------------
  {
    files: ['**/*.{js,ts,vue}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-unused-vars': 'off',
      // Geometry and timeline code is index-heavy by nature.
      'sonarjs/cognitive-complexity': ['error', 25],
      'sonarjs/pseudo-random': 'off',
      // `IsoDate` and friends are aliases on purpose: they say what a string holds.
      'sonarjs/redundant-type-aliases': 'off',
      'func-style': ['error', 'expression'],
      'prefer-arrow-callback': 'error',
      'no-restricted-syntax': ['error', ...SHARED_SYNTAX],
      'id-length': ['error', { min: 3, exceptions: SHORT_NAMES, properties: 'never' }],
    },
  },
  {
    files: ['**/*.vue'],
    rules: {
      // Tailwind takes a list's bullets away, and with them Safari's VoiceOver stops calling it a list: `role="list"` gives it back.
      'vuejs-accessibility/no-redundant-roles': ['error', { ul: ['list'], ol: ['list'] }],
      // Beyond the recommended: what is hidden from a screen reader, or said to be nothing, is never what a keyboard lands on.
      'vuejs-accessibility/no-aria-hidden-on-focusable': 'error',
      'vuejs-accessibility/no-role-presentation-on-focusable': 'error',
    },
  },

  // ---- TypeScript -------------------------------------------------------------
  {
    files: ['**/*.{ts,vue}'],
    rules: {
      '@typescript-eslint/explicit-member-accessibility': ['error', { accessibility: 'explicit' }],
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/naming-convention': [
        'error',
        { selector: 'default', format: ['camelCase'], leadingUnderscore: 'allow' },
        { selector: 'variable', format: ['camelCase', 'UPPER_CASE', 'PascalCase'], leadingUnderscore: 'allow' },
        { selector: 'typeLike', format: ['PascalCase'] },
        // Keys of GeoJSON, MapLibre styles and HTTP headers are not ours to name.
        { selector: ['objectLiteralProperty', 'typeProperty', 'objectLiteralMethod'], format: null },
        { selector: 'import', format: null },
      ],
    },
  },

  // A class outside a service file is in the wrong place.
  {
    files: ['**/*.ts'],
    ignores: ['**/*.service.ts', ...TOOL_CONFIGS],
    rules: { 'no-restricted-syntax': ['error', ...SHARED_SYNTAX, NO_CLASS_OUTSIDE_SERVICE] },
  },
  {
    files: TEST_FILES,
    rules: { 'no-restricted-syntax': ['error', ...SHARED_SYNTAX, NO_CLASS_OUTSIDE_SERVICE, ...TEST_SYNTAX] },
  },

  // ---- JSDoc on every class, member and export ---------------------------------
  {
    files: ['packages/*/src/**/*.ts', '**/test/support/**/*.ts', 'web/src/**/*.ts'],
    ignores: ['**/*.test.ts', '**/*.spec.ts'],
    plugins: { jsdoc },
    rules: {
      'jsdoc/require-jsdoc': [
        'error',
        {
          publicOnly: false,
          require: { ClassDeclaration: true, MethodDefinition: true, FunctionDeclaration: true },
          contexts: ['PropertyDefinition', 'ExportNamedDeclaration:has(> VariableDeclaration)', 'ExportNamedDeclaration:has(> TSTypeAliasDeclaration)'],
          checkConstructors: false,
          checkGetters: true,
        },
      ],
      'jsdoc/check-param-names': 'error',
      'jsdoc/check-tag-names': 'error',
      'jsdoc/no-types': 'error',
      'jsdoc/require-param-description': 'error',
      'jsdoc/require-returns-description': 'error',
    },
  },

  // ---- What a package may import -------------------------------------------------
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

  // ---- File names ------------------------------------------------------------
  {
    files: ['packages/*/src/**/*.ts', 'web/src/**/*.ts'],
    ignores: [...TOOL_CONFIGS, ...CLI_FILES],
    plugins: { 'check-file': checkFile },
    rules: {
      'check-file/filename-naming-convention': ['error', { '**/*.ts': SOURCE_FILE }],
      'check-file/folder-naming-convention': ['error', { '**/': 'CAMEL_CASE' }],
    },
  },
  {
    files: TEST_FILES,
    plugins: { 'check-file': checkFile },
    rules: {
      'check-file/filename-naming-convention': ['error', { '**/*.ts': TEST_FILE }],
      'check-file/folder-naming-convention': ['error', { '**/': 'CAMEL_CASE' }],
      // A test is in `test/unit/` (beside the code it mirrors) or helps them from `test/support/`.
      'check-file/folder-match-with-fex': ['error', { '*.test.ts': '**/test/unit/**', '*.spec.ts': '**/test/unit/**', '*.utils.ts': '**/test/support/**' }],
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

  // ---- Vue ---------------------------------------------------------------------
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: { parser: tseslint.parser, extraFileExtensions: ['.vue'] },
    },
    rules: {
      'vue/multi-word-component-names': 'off',
      'vue/block-lang': ['error', { script: { lang: 'ts' } }],
      'vue/block-order': ['error', { order: ['template', 'script[setup]', 'style'] }],
      'vue/component-api-style': ['error', ['script-setup', 'composition']],
      'vue/require-macro-variable-name': ['error', { defineProps: 'props', defineEmits: 'emit' }],
      'vue/attribute-hyphenation': ['error', 'never'],
      'vue/v-on-event-hyphenation': ['error', 'never', { autofix: true }],
      'vue/prop-name-casing': ['error', 'camelCase'],
      'vue/v-bind-style': ['error', 'shorthand', { sameNameShorthand: 'always' }],
      'vue/v-on-style': ['error', 'shorthand'],
      'vue/no-v-html': 'error',
      // The recommended set's other rules, which it only warns of: what a template means, never how it is laid out.
      'vue/attributes-order': 'error',
      'vue/component-definition-name-casing': 'error',
      'vue/html-end-tags': 'error',
      'vue/no-lone-template': 'error',
      'vue/no-multiple-slot-args': 'error',
      'vue/no-required-prop-with-default': 'error',
      'vue/no-template-shadow': 'error',
      'vue/one-component-per-file': 'error',
      'vue/order-in-components': 'error',
      'vue/require-default-prop': 'error',
      'vue/require-explicit-emits': 'error',
      'vue/require-prop-types': 'error',
      'vue/this-in-template': 'error',
      // Prettier lays templates out (`pnpm format-check`): the recommended set's layout rules would argue with it.
      'vue/first-attribute-linebreak': 'off',
      'vue/html-closing-bracket-newline': 'off',
      'vue/html-closing-bracket-spacing': 'off',
      'vue/html-indent': 'off',
      'vue/html-quotes': 'off',
      'vue/html-self-closing': 'off',
      'vue/max-attributes-per-line': 'off',
      'vue/multiline-html-element-content-newline': 'off',
      'vue/mustache-interpolation-spacing': 'off',
      'vue/no-multi-spaces': 'off',
      'vue/no-spaces-around-equal-signs-in-attribute': 'off',
      'vue/singleline-html-element-content-newline': 'off',
    },
  },

  // Tool configs export what their tool expects.
  {
    files: TOOL_CONFIGS,
    rules: { '@typescript-eslint/naming-convention': 'off', 'id-length': 'off' },
  },
);
