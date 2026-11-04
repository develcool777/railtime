import eslint from '@eslint/js';
import vitest from '@vitest/eslint-plugin';
import { defineConfig } from 'eslint/config';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import checkFile from 'eslint-plugin-check-file';
import importX from 'eslint-plugin-import-x';
import jsdoc from 'eslint-plugin-jsdoc';
import sonarjs from 'eslint-plugin-sonarjs';
import unicorn from 'eslint-plugin-unicorn';
import vuePlugin from 'eslint-plugin-vue';
import vueAccessibility from 'eslint-plugin-vuejs-accessibility';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { vueConfig } from './eslint.vue.config.js';
import { ID_RULES } from './packages/tooling/src/lint/idRules.utils.ts';

/**
 * The code conventions (CLAUDE.md), as rules, so they hold without anyone remembering them; each
 * convention there names the rule that checks it. Nothing is on `warn`: a rule is `error`, or `off`
 * with a line saying why, so a slip fails `pnpm eslint-check` instead of scrolling past.
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

/**
 * The house's own rules. Conventions that reuse a generic rule, each under a name of its own: a flat
 * config keeps one setting per rule per file, the last block's, so a second `no-restricted-imports`
 * would silently replace the package fences; named apart, each holds alone, and its name says which
 * convention a report is about (as in dataroom-ui). And the rules about ids, which read types
 * (`packages/tooling/src/lint/`, tested there).
 */
const house = {
  rules: { 'pure-utils': tseslint.plugin.rules['no-restricted-imports'], 'test-helpers': tseslint.plugin.rules['no-restricted-imports'], ...ID_RULES },
};

/** A test's helpers trust what they are given (`stationId('a')`, `asNetwork`), as a test may: source checks instead. */
const TEST_HELPERS = {
  group: ['@railtime/*/testing/*'],
  message:
    "Source never takes a test's helpers, which trust what they are given: a string becomes an id by `isStationIn`/`isLineIn`/`isPlanIn` (`@railtime/schema/ids.utils`), a file a network by `parseNetwork`.",
};

/** Outside a `*.service.ts`, a class is in the wrong file. */
const NO_CLASS_OUTSIDE_SERVICE = { selector: 'ClassDeclaration', message: 'Classes live in a `*.service.ts` file.' };

/** Short names allowed because everyone reads them the same way. */
const SHORT_NAMES = ['id', 'x', 'y', 'km', 'on', 'to', '_'];

/** What a source file may be called: `<camelName>.<role>.ts`, or `<camelName>.<role>.types.ts` for the types of one file. */
const SOURCE_FILE = '+([a-z])*([a-zA-Z0-9])?(.@(service|utils|composable|store)).@(service|utils|constants|types|schema|composable|store)';
/**
 * What a test file may be called: `<camelName>.test.ts`, run in node, `.spec.ts`, in happy-dom
 * (`vitest.shared.ts`), `.bench.ts`, timed (`pnpm test-bench`), or a support file's
 * `.utils.ts`/`.types.ts`/`.constants.ts`.
 */
const TEST_FILE = '+([a-z])*([a-zA-Z0-9]).@(test|spec|bench|utils|types|constants)';

/** Each package's tests, beside its code: `test/unit/` mirrors `src/`, `test/support/` is what they share. */
const TEST_FILES = ['packages/*/test/**/*.ts', 'web/test/**/*.ts'];

/** Tests run the real code, as in dataroom-ui: a test that mocks our own module ends up testing the mock. */
const TEST_SYNTAX = [
  {
    selector: "CallExpression[callee.object.name='vi'][callee.property.name=/^(mock|doMock)$/]",
    message: 'Tests run the real code: no vi.mock. Build the input with a factory in test/support/.',
  },
];
/** A command's file name. */
const SCRIPT_FILE = 'cli?(.+([a-zA-Z0-9]))';
/**
 * Commands run with node: `src/cli.<name>.ts`, or a feature's own, `src/<feature>/cli.ts`
 * (`pnpm data:boundary`), which only hands its arguments to the feature's service.
 */
const CLI_FILES = ['packages/*/src/cli.*.ts', 'packages/*/src/*/cli.ts'];

/** Config files at a package root follow their tool's naming, not ours, and sit in no tsconfig. */
const TOOL_CONFIGS = ['**/*.config.{js,ts,mjs}', '**/nuxt.config.ts', '**/app.config.ts', 'vitest.*.ts'];

/** The code a JSDoc mirrors the signature of: every function but an arrow in an array (a table, documented as one). */
const JSDOC_FUNCTIONS = ['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression:not(ArrayExpression > ArrowFunctionExpression)'];

export default defineConfig(
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  unicorn.configs.recommended,
  importX.flatConfigs.recommended,
  importX.flatConfigs.typescript,
  ...vuePlugin.configs['flat/recommended'],
  // What a screen reader or a keyboard needs of a template: labels, roles, keys for what is clicked.
  ...vueAccessibility.configs['flat/recommended'],
  sonarjs.configs.recommended,

  { ignores: ['**/dist/', '**/node_modules/', '**/.nuxt/', '**/.output/', '**/test-reports/', 'web/public/'] },

  // ---- Everything -----------------------------------------------------------
  {
    files: ['**/*.{js,ts,vue}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      // Types for every rule that needs them (a promise left floating, a condition that is always true):
      // each file is read with its own package's tsconfig, web's from `.nuxt/` (`nuxt prepare`, on install).
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname, extraFileExtensions: ['.vue'] },
    },
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
      // `const { plans: _plans, ...rest } = network` leaves a key out: `_plans` is never read.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', ignoreRestSiblings: true }],
      // The same check as typescript-eslint's, without its options.
      'sonarjs/no-unused-vars': 'off',
      'no-unused-vars': 'off',
      'sonarjs/cognitive-complexity': ['error', 15],
      'sonarjs/pseudo-random': 'off',
      // `IsoDate` and friends are aliases on purpose: they say what a string holds.
      'sonarjs/redundant-type-aliases': 'off',
      'func-style': ['error', 'expression'],
      'prefer-arrow-callback': 'error',
      'no-restricted-syntax': ['error', ...SHARED_SYNTAX],
      'id-length': ['error', { min: 3, exceptions: SHORT_NAMES, properties: 'never' }],
      // Guard clauses: after an `if` that returns, the rest is not an `else`.
      'no-else-return': ['error', { allowElseIf: false }],

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

      // TypeScript's stricter checks, tuned to the house style.
      // A condition is a boolean, or a value whose truth cannot mislead: an object, a string, or one that
      // may be missing (an id, a date, a name, a flag: never `''`). A number is compared, never taken
      // for true: `0` is a count, a timestamp (1 January 1970), an option.
      '@typescript-eslint/strict-boolean-expressions': [
        'error',
        { allowNumber: false, allowNullableNumber: false, allowNullableString: true, allowNullableBoolean: true },
      ],
      // A `switch` over a union names every member, or says `default`: a new kind of step or overlay
      // cannot slip past one.
      '@typescript-eslint/switch-exhaustiveness-check': ['error', { considerDefaultExhaustiveForUnions: true }],
      // The `as` left are the language's own gaps, each said where it is made: `Object.keys` typed by
      // its object, a page's own globals (`window as RecordedWindow`), JSON our own commands wrote.
      // (It found one hole, MapLibre's GeoJSON types unread, `any` unseen: the renderer loads them now.)
      '@typescript-eslint/no-unsafe-type-assertion': 'off',
      // A number in a message or a URL is how one is written.
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      // `() => map.play()` and `(next) => (time.value = next)` are how actions and handlers are written.
      '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],
      // A test may read a private member, as `animation['context']`, which TypeScript allows only so.
      '@typescript-eslint/dot-notation': ['error', { allowPrivateClassPropertyAccess: true }],
      // A callback that does nothing is `() => {}`.
      '@typescript-eslint/no-empty-function': ['error', { allow: ['arrowFunctions'] }],
      // Every shape is a `type`, so one reads like the next.
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      // `!` is allowed where a loop's bounds guarantee the element, with a comment saying so (CLAUDE.md,
      // strict indexing); an id the network supplied goes through `required()`.
      '@typescript-eslint/no-non-null-assertion': 'off',

      // Unicorn's modern JavaScript, but where it argues with the house style:
      // `null` is how "nothing here" is said, by us and by Vue and MapLibre alike.
      'unicorn/no-null': 'off',
      // File names are `check-file`'s (`collection.utils.ts`, camelCase), and names `id-length`'s.
      'unicorn/filename-case': 'off',
      'unicorn/name-replacements': 'off',
      // A boolean says what holds (`playing`, `inPlan`), not `is…`.
      'unicorn/consistent-boolean-name': 'off',
      // A one-line JSDoc is `/** … */`, and a longer one has its column of asterisks.
      'unicorn/single-line-block-comment-style': 'off',
      'unicorn/no-asterisk-prefix-in-documentation-comments': 'off',
      // A class keeps a private helper near the method it serves; this rule would put every private
      // member first, ahead of what the class offers.
      'unicorn/consistent-class-member-order': 'off',
      // `required(reach[0], …)` inside a call is the strict-indexing convention, not a tangle.
      'unicorn/max-nested-calls': 'off',
      // A typed array's cell (`inside[cell]`) is not an object's key.
      'unicorn/no-computed-property-existence-check': 'off',
      // `flatMap(item => (keep ? [item] : []))` filters and maps in one pass.
      'unicorn/no-unnecessary-array-flat-map': 'off',
      // `.some(inRing)`: TypeScript checks a callback's parameters.
      'unicorn/no-array-callback-reference': 'off',
      // Named imports (`import { join } from 'node:path'`), as everywhere else.
      'unicorn/import-style': 'off',
      // Iterator helpers (`map.values().toArray()`) are newer than some browsers the site serves (Safari before 18.4).
      'unicorn/prefer-iterator-to-array': 'off',
      // The renderer's `EventEmitter` is typed; an `EventTarget`'s events are not.
      'unicorn/prefer-event-target': 'off',
      // What runs in a page (a component, a recorder's `page.evaluate`) says `window`, typed as one.
      'unicorn/prefer-global-this': 'off',
      // Guard clauses read one at a time: never merged into one condition, or into a ternary.
      'unicorn/prefer-ternary': 'off',
      'unicorn/prefer-combined-guards': 'off',
      // A loop's head says what it loops over (`for (const [place, stop] of run.entries())`).
      'unicorn/no-unreadable-for-of-expression': 'off',
      // Prettier writes number literals (`0x0b`).
      'unicorn/number-literal-case': 'off',
      // `Number.parseFloat('12px')` is 12, where `Number('12px')` is NaN.
      'unicorn/prefer-number-coercion': 'off',
      // `void promise` is how a promise left to run on its own is written (`no-floating-promises`).
      'sonarjs/void-use': 'off',
      // A `shift` or `unshift` copies the whole array: a queue built on them is O(n²). Read a queue from
      // its head; build backwards, then `toReversed()`.
      'unicorn/no-array-front-mutation': 'error',
      // Promises that need not wait on one another run together (`Promise.all`).
      'no-await-in-loop': 'error',
      // A suggestion to weigh, never a defect: which condition reads first is the author's call.
      'unicorn/prefer-simple-condition-first': 'off',
    },
  },
  // The data and video commands drive one browser page, or a service that asks for a pause between
  // requests, and a recorder steps its page a frame at a time: their awaits wait in turn on purpose.
  { files: ['packages/{data,video}/src/**/*.ts'], rules: { 'no-await-in-loop': 'off' } },
  // Tool configs and plain JavaScript sit in no tsconfig: no rule that needs types.
  { files: ['**/*.js', ...TOOL_CONFIGS], extends: [tseslint.configs.disableTypeChecked] },
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

  // ---- Tests --------------------------------------------------------------------
  // One way to write a test, so they read alike; none left focused or skipped; each matcher the one
  // that says what it checks, so a failure says what went wrong.
  {
    files: TEST_FILES,
    plugins: { vitest },
    rules: {
      ...vitest.configs.recommended.rules,
      'no-restricted-syntax': ['error', ...SHARED_SYNTAX, NO_CLASS_OUTSIDE_SERVICE, ...TEST_SYNTAX],
      'vitest/consistent-test-it': ['error', { fn: 'test', withinDescribe: 'test' }],
      'vitest/no-focused-tests': 'error',
      'vitest/no-disabled-tests': 'error',
      'vitest/prefer-to-be': 'error',
      'vitest/prefer-to-have-length': 'error',
      'vitest/prefer-to-contain': 'error',
      'vitest/prefer-comparison-matcher': 'error',
      'vitest/prefer-equality-matcher': 'error',
      'vitest/prefer-to-have-been-called-times': 'error',
      'vitest/prefer-hooks-on-top': 'error',
      // Vitest takes a message beside the value: `expect(existsSync(path), path)`.
      'vitest/valid-expect': ['error', { maxArgs: 2 }],
      // An asymmetric matcher (`expect.closeTo(…)`) is typed `any`, and a test reads JSON files: what it
      // checks of them is checked at run time.
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      // A stand-in's queue holds a frame or two: what ships is held to O(n) queues.
      'unicorn/no-array-front-mutation': 'off',
      // A stand-in for an async API (a browser, a page) is `async` without waiting for anything.
      '@typescript-eslint/require-await': 'off',
      // A test's helper sits in the `describe` that uses it, beside its tests.
      'unicorn/consistent-function-scoping': 'off',
      // A test's checks may sit in a helper of `test/support/` (`expectPlays`, `checkHistory`).
      'vitest/expect-expect': ['error', { assertFunctionNames: ['expect', 'expect*', 'check*'] }],
    },
  },
  // A lint rule's tests are its tester's cases: `tester.run` makes each a test.
  { files: ['packages/tooling/test/unit/lint/**/*.test.ts'], rules: { 'sonarjs/no-empty-test-file': 'off' } },

  // ---- JSDoc on every class, member, module-level constant and type --------------------
  {
    files: ['packages/*/src/**/*.ts', '**/test/support/**/*.ts', 'web/src/**/*.ts'],
    plugins: { jsdoc },
    rules: {
      'jsdoc/require-jsdoc': [
        'error',
        {
          publicOnly: false,
          require: { ClassDeclaration: true, MethodDefinition: true, FunctionDeclaration: true },
          contexts: [
            'PropertyDefinition',
            'Program > VariableDeclaration',
            'ExportNamedDeclaration:has(> VariableDeclaration)',
            'Program > TSTypeAliasDeclaration',
            'ExportNamedDeclaration:has(> TSTypeAliasDeclaration)',
          ],
          checkConstructors: false,
          checkGetters: true,
          // `--fix` would write an empty `/** */`: a doc is written, never stamped.
          enableFixer: false,
        },
      ],
    },
  },
  // ---- …and every JSDoc, a component's too, mirroring its signature ------------------------
  {
    files: ['packages/*/src/**/*.ts', '**/test/support/**/*.ts', 'web/src/**/*.{ts,vue}'],
    plugins: { jsdoc },
    rules: {
      // A `@param <name> - <what>` for each parameter and none for one gone; a `@returns` for a value,
      // none for `void`. No `{type}`, no `[optional]`, no default: TypeScript says those.
      'jsdoc/require-param': ['error', { checkDestructured: false, contexts: JSDOC_FUNCTIONS, enableFixer: false }],
      'jsdoc/check-param-names': ['error', { checkDestructured: false }],
      'jsdoc/require-param-description': 'error',
      'jsdoc/require-hyphen-before-param-description': 'error',
      // A getter's doc says what it is: no `@returns` beside it.
      'jsdoc/require-returns': [
        'error',
        { checkGetters: false, contexts: JSDOC_FUNCTIONS.map(node => `${node}:not([returnType.typeAnnotation.type='TSVoidKeyword'])`) },
      ],
      'jsdoc/require-returns-check': 'error',
      'jsdoc/require-returns-description': 'error',
      'jsdoc/check-tag-names': 'error',
      'jsdoc/no-types': 'error',
      'jsdoc/no-defaults': 'error',
      'jsdoc/no-restricted-syntax': [
        'error',
        {
          contexts: [
            {
              comment: String.raw`JsdocBlock:has(JsdocTag[tag="param"][name=/^\[/])`,
              context: 'any',
              message: 'No [optional] brackets on a @param: TypeScript says what is optional.',
            },
          ],
        },
      ],
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
  // Pure first: a `*.utils.ts` takes what it needs as arguments, so it runs and is tested anywhere.
  {
    files: ['packages/*/src/**/*.utils.ts', 'web/src/**/*.utils.ts'],
    plugins: { house },
    rules: { 'house/pure-utils': ['error', { patterns: [IMPURE] }] },
  },

  // ---- Ids: a string becomes one only where it is checked (CLAUDE.md) -------------------
  {
    files: ['**/*.{ts,vue}'],
    ignores: TOOL_CONFIGS,
    plugins: { house },
    rules: { 'house/checked-ids': 'error', 'house/branded-spread-key': 'error', 'house/branded-record-keys': 'error' },
  },
  // The doors: Zod reading a city's file, and the ids a test names.
  { files: ['packages/schema/src/validation/shape.schema.ts', 'packages/schema/test/support/ids.utils.ts'], rules: { 'house/checked-ids': 'off' } },
  {
    files: ['packages/*/src/**/*.ts', 'web/src/**/*.{ts,vue}'],
    plugins: { house },
    rules: { 'house/test-helpers': ['error', { patterns: [TEST_HELPERS] }] },
  },

  // ---- File names ------------------------------------------------------------
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

  // ---- Vue ---------------------------------------------------------------------
  vueConfig,

  // Tool configs export what their tool expects.
  {
    files: TOOL_CONFIGS,
    rules: { '@typescript-eslint/naming-convention': 'off', 'id-length': 'off' },
  },
);
