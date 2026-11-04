import vitest from '@vitest/eslint-plugin';
import { NO_CLASS_OUTSIDE_SERVICE, SHARED_SYNTAX, TEST_FILES } from './shared.js';

/** Tests run the real code, as in dataroom-ui: a test that mocks our own module ends up testing the mock. */
const TEST_SYNTAX = [
  {
    selector: "CallExpression[callee.object.name='vi'][callee.property.name=/^(mock|doMock)$/]",
    message: 'Tests run the real code: no vi.mock. Build the input with a factory in test/support/.',
  },
];

/**
 * One way to write a test, so they read alike; none left focused or skipped; each matcher the one
 * that says what it checks, so a failure says what went wrong. And what a test may do that source may
 * not, so it comes after every other subject.
 */
export const testsConfig = [
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
      // A test runs every time, as written: never one only some runs make, nor one left unwritten (as a
      // `.skip`), nor returning what it checks; its hooks once each, at its top, in the order they run.
      'vitest/no-conditional-tests': 'error',
      'vitest/warn-todo': 'error',
      'vitest/no-test-return-statement': 'error',
      'vitest/no-test-prefixes': 'error',
      'vitest/no-duplicate-hooks': 'error',
      'vitest/prefer-hooks-in-order': 'error',
      'vitest/hoisted-apis-on-top': 'error',
      'vitest/max-nested-describe': ['error', { max: 3 }],
      // A matcher said one way (`toHaveBeenCalled`, never its alias), and a throw checked for what it says:
      // `toThrow()` alone passes for any error, the wrong one too.
      'vitest/no-alias-methods': 'error',
      'vitest/require-to-throw-message': 'error',
      'vitest/prefer-spy-on': 'error',
      'vitest/prefer-expect-resolves': 'error',
      'vitest/prefer-mock-promise-shorthand': 'error',
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
      // A test checks what a command prints (`expect(console.log).toHaveBeenCalledWith(…)`).
      'no-console': 'off',
      // A test's own nesting (`describe`, `describe`, `test`) takes three of the levels source has.
      'max-nested-callbacks': ['error', 6],
      // A test's helper sits in the `describe` that uses it, beside its tests.
      'unicorn/consistent-function-scoping': 'off',
      // A test's checks may sit in a helper of `test/support/` (`expectPlays`, `checkHistory`).
      'vitest/expect-expect': ['error', { assertFunctionNames: ['expect', 'expect*', 'check*'] }],
    },
  },
  // A lint rule's tests are its tester's cases: `tester.run` makes each a test.
  { files: ['packages/tooling/test/unit/lint/**/*.test.ts'], rules: { 'sonarjs/no-empty-test-file': 'off' } },
];
