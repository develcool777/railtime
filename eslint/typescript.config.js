import tseslint from 'typescript-eslint';
import { ROOT, TOOL_CONFIGS } from './shared.js';

/**
 * What the types say holds: every file read with its own package's types, and typescript-eslint's
 * strict checks tuned to the house style; then how a class and a name are written.
 */
export const typescriptConfig = [
  {
    files: ['**/*.{js,ts,vue}'],
    languageOptions: {
      // Types for every rule that needs them (a promise left floating, a condition that is always true):
      // each file is read with its own package's tsconfig, web's from `.nuxt/` (`nuxt prepare`, on install).
      parserOptions: { projectService: true, tsconfigRootDir: ROOT, extraFileExtensions: ['.vue'] },
    },
    rules: {
      // `const { plans: _plans, ...rest } = network` leaves a key out: `_plans` is never read.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', ignoreRestSiblings: true }],
      // The same check as typescript-eslint's, without its options.
      'sonarjs/no-unused-vars': 'off',
      'no-unused-vars': 'off',
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
    },
  },
  // Tool configs and plain JavaScript sit in no tsconfig: no rule that needs types.
  { files: ['**/*.js', ...TOOL_CONFIGS], extends: [tseslint.configs.disableTypeChecked] },
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
];
