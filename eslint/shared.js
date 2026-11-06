import { dirname } from 'node:path';
import tseslint from 'typescript-eslint';
import { ASSERTION_RULES } from '../packages/tooling/src/lint/assertionRules.utils.ts';
import { ID_RULES } from '../packages/tooling/src/lint/idRules.utils.ts';
import { STORE_RULES } from '../packages/tooling/src/lint/storeRules.utils.ts';

/** The repository's root, where each file's tsconfig is found from. */
export const ROOT = dirname(import.meta.dirname);

/** Loop and function shapes banned everywhere. */
export const SHARED_SYNTAX = [
  { selector: 'ForStatement[test=null]', message: 'No `for (;;)`: loop over something (`while (queue.length > 0)`, `for (const item of items)`).' },
  { selector: "WhileStatement[test.type='Literal']", message: 'No `while (true)`: put the real condition in the loop head.' },
  { selector: 'FunctionDeclaration', message: 'Use an arrow function: `const name = (…) => …`.' },
  { selector: 'FunctionExpression:not(MethodDefinition > FunctionExpression)', message: 'Use an arrow function.' },
];

/** Outside a `*.service.ts`, a class is in the wrong file. */
export const NO_CLASS_OUTSIDE_SERVICE = { selector: 'ClassDeclaration', message: 'Classes live in a `*.service.ts` file.' };

/** Each package's tests, beside its code: `test/unit/` mirrors `src/`, `test/support/` is what they share. */
export const TEST_FILES = ['packages/*/test/**/*.ts', 'web/test/**/*.ts'];

/**
 * Commands run with node: `src/cli.<name>.ts`, or a feature's own, `src/<feature>/cli.ts`
 * (`pnpm data:boundary`), which only hands its arguments to the feature's service.
 */
export const CLI_FILES = ['packages/*/src/cli.*.ts', 'packages/*/src/*/cli.ts'];

/** Config files at a package root follow their tool's naming, not ours, and sit in no tsconfig. */
export const TOOL_CONFIGS = ['**/*.config.{js,ts,mjs}', '**/nuxt.config.ts', '**/app.config.ts', 'vitest.*.ts'];

/**
 * The house's own rules. Conventions that reuse a generic rule, each under a name of its own: a flat
 * config keeps one setting per rule per file, the last block's, so a second `no-restricted-imports`
 * would silently replace the package fences; named apart, each holds alone, and its name says which
 * convention a report is about (as in dataroom-ui). And the rules about assertions and ids, which
 * read types, and about stores (`packages/tooling/src/lint/`, tested there).
 */
export const house = {
  rules: {
    'pure-utils': tseslint.plugin.rules['no-restricted-imports'],
    'test-helpers': tseslint.plugin.rules['no-restricted-imports'],
    ...ASSERTION_RULES,
    ...ID_RULES,
    ...STORE_RULES,
  },
};
