import globals from 'globals';
import { NO_CLASS_OUTSIDE_SERVICE, SHARED_SYNTAX, TOOL_CONFIGS } from './shared.js';

/** What a composable may not make: a value of its own, which belongs in a store. */
const NO_STATE_IN_COMPOSABLE = {
  selector: 'CallExpression[callee.name=/^(ref|shallowRef|reactive|shallowReactive|computed)$/]',
  message: 'A composable holds no state and works nothing out: the value goes in a store (its state or a getter), and the composable reads it.',
};

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
      // Each thing said one way: `===`, `Boolean(x)` for `!!x`, a template literal for `'a' + b`, `{ bounds }`.
      eqeqeq: 'error',
      'no-implicit-coercion': 'error',
      'prefer-template': 'error',
      'no-useless-concat': 'error',
      'object-shorthand': 'error',
      // What the site and the packages say goes on the page or in a thrown error, never to the console.
      'no-console': 'error',
      // Slips the language lets through, each a bug when it happens: a `map` callback that returns
      // nothing, `x === x`, a loop whose condition nothing in it changes or that never loops twice, a
      // `${}` in a plain string, a parameter written over, an assignment inside a `return`, a comma
      // operator, a `new` for its side effects alone, `parseInt` without its radix.
      'array-callback-return': 'error',
      'no-self-compare': 'error',
      'no-unmodified-loop-condition': 'error',
      'no-unreachable-loop': 'error',
      'no-template-curly-in-string': 'error',
      'no-param-reassign': 'error',
      'no-return-assign': 'error',
      'no-sequences': 'error',
      'no-new': 'error',
      'no-constructor-return': 'error',
      'no-multi-assign': 'error',
      radix: 'error',
      'symbol-description': 'error',
      'guard-for-in': 'error',
      'default-case-last': 'error',
      'default-param-last': 'error',
      'grouped-accessor-pairs': 'error',
      'accessor-pairs': 'error',
      // What no code here needs, and a page that ran it would regret: `eval` and its kin, `alert`, a
      // `javascript:` address, a built-in's prototype changed, `__proto__`, `arguments.callee`.
      'no-eval': 'error',
      'no-new-func': 'error',
      'no-alert': 'error',
      'no-script-url': 'error',
      'no-extend-native': 'error',
      'no-proto': 'error',
      'no-iterator': 'error',
      'no-caller': 'error',
      'no-new-wrappers': 'error',
      'no-object-constructor': 'error',
      'no-octal-escape': 'error',
      'no-labels': 'error',
      // Each thing said one way, the shorter: `x += 1`, `2 ** n`, `Object.hasOwn`, `{ ...a }`, `/re/`,
      // `x < 1` (never `1 > x`), no `else { if }`, no `cond ? true : false`, no call or rename that does
      // nothing, no block or `= undefined` that says nothing.
      'operator-assignment': 'error',
      'prefer-exponentiation-operator': 'error',
      'prefer-numeric-literals': 'error',
      'prefer-object-has-own': 'error',
      'prefer-object-spread': 'error',
      'prefer-regex-literals': 'error',
      yoda: 'error',
      'no-lonely-if': 'error',
      'no-unneeded-ternary': 'error',
      'no-useless-call': 'error',
      'no-useless-computed-key': 'error',
      'no-useless-rename': 'error',
      'no-extra-bind': 'error',
      'no-lone-blocks': 'error',
      'no-undef-init': 'error',
      'no-multi-str': 'error',
      'unicorn/no-unnecessary-default-arguments': 'error',
      // A function a reader takes in at once has few levels (`sonarjs/cognitive-complexity` weighs the rest).
      'max-depth': ['error', 4],
      'max-nested-callbacks': ['error', 4],

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
  // A command says what it did on the console, and the test setup watches it, failing a test that warns.
  { files: ['packages/{data,video,tooling}/src/**/*.ts', 'vitest.setup.ts'], rules: { 'no-console': 'off' } },
  // A class outside a service file is in the wrong place.
  {
    files: ['**/*.ts'],
    ignores: ['**/*.service.ts', ...TOOL_CONFIGS],
    rules: { 'no-restricted-syntax': ['error', ...SHARED_SYNTAX, NO_CLASS_OUTSIDE_SERVICE] },
  },
  // A composable is an effect: it ties something outside Vue to the stores, which hold every value.
  {
    files: ['web/src/**/*.composable.ts'],
    rules: { 'no-restricted-syntax': ['error', ...SHARED_SYNTAX, NO_CLASS_OUTSIDE_SERVICE, NO_STATE_IN_COMPOSABLE] },
  },
];
