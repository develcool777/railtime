import globals from 'globals';
import { NO_CLASS_OUTSIDE_SERVICE, SHARED_SYNTAX, TOOL_CONFIGS } from './shared.js';

/** Short names allowed because everyone reads them the same way. */
const SHORT_NAMES = ['id', 'x', 'y', 'km', 'on', 'to', '_'];

/**
 * The language itself: arrow functions and loops that say what they loop over, names, guard clauses,
 * a function a reader takes in at once (sonarjs), and modern JavaScript (unicorn), where it agrees
 * with the house style.
 */
export const javascriptConfig = [
  {
    files: ['**/*.{js,ts,vue}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
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
  // A class outside a service file is in the wrong place.
  {
    files: ['**/*.ts'],
    ignores: ['**/*.service.ts', ...TOOL_CONFIGS],
    rules: { 'no-restricted-syntax': ['error', ...SHARED_SYNTAX, NO_CLASS_OUTSIDE_SERVICE] },
  },
];
