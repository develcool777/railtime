import { RuleTester } from '@typescript-eslint/rule-tester';
import { fileURLToPath } from 'node:url';
import tseslint from 'typescript-eslint';
import { afterAll, describe, test } from 'vitest';
import vueParser from 'vue-eslint-parser';
import { boundedAssertion } from '../../../src/lint/assertionRules.utils';

// The rule tester runs its cases as Vitest's tests.
RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = test;

/** Each case's code is a file of its own, read with this package's options: the rule needs its types. */
const tester = new RuleTester({
  languageOptions: {
    parserOptions: {
      projectService: { allowDefaultProject: ['*.ts', '*.vue'], defaultProject: 'tsconfig.json' },
      tsconfigRootDir: fileURLToPath(new URL('../../..', import.meta.url)),
      extraFileExtensions: ['.vue'],
    },
  },
});

/** What the cases try it on. */
const GIVEN = `
declare const list: number[];
declare const other: number[];
declare const byName: Record<string, number>;
declare const map: Map<string, number>;
declare const name: string;
declare const maybe: number | undefined;
declare const typed: Float64Array;
`;

/**
 * A case's code: what it is given, then what it tries.
 *
 * @param code - What it tries.
 * @returns The file.
 */
const given = (code: string): string => `${GIVEN}\n${code}`;

/** A case in a component's template, read as ESLint reads one. */
const vueTester = new RuleTester({
  languageOptions: {
    parser: vueParser,
    parserOptions: {
      parser: tseslint.parser,
      projectService: { allowDefaultProject: ['*.ts', '*.vue'], defaultProject: 'tsconfig.json' },
      tsconfigRootDir: fileURLToPath(new URL('../../..', import.meta.url)),
      extraFileExtensions: ['.vue'],
    },
  },
});

describe('AssertionRules', () => {
  vueTester.run('bounded-assertion in a template', boundedAssertion, {
    valid: [
      {
        name: 'none',
        filename: 'file.vue',
        code: '<template><p>{{ list[0] }}</p></template>\n<script setup lang="ts">\ndeclare const list: number[];\n</script>',
      },
    ],
    invalid: [
      {
        name: 'one, which no loop bounds',
        filename: 'file.vue',
        code: '<template><p>{{ list[0]! }}</p></template>\n<script setup lang="ts">\ndeclare const list: number[];\n</script>',
        errors: [{ messageId: 'unbounded' }],
      },
    ],
  });

  tester.run('bounded-assertion', boundedAssertion, {
    valid: [
      {
        name: 'the index a `for` declares, with its comment over the statement',
        code: given(`
          for (let index = 0; index < list.length; index++) {
            // Within bounds: the loop's.
            const item = list[index]!;
          }`),
      },
      {
        name: 'one comment over the loop speaks for all inside it',
        code: given(`
          // Within bounds: \`other\` is as long as \`list\`.
          for (let index = 1; index < list.length; index++) {
            const item = list[index]!;
            const before = other[index - 1]!;
          }`),
      },
      {
        name: 'the index a `for…of` binds',
        code: given(`
          for (const [place, value] of list.entries()) {
            // Within bounds: as long as the list.
            const pair = other[place + 1]! + value;
          }`),
      },
      {
        name: 'the index a `while` tests',
        code: given(`
          let head = 0;
          while (head < list.length) {
            // Within bounds: the loop's.
            const item = list[head]!;
            head++;
          }`),
      },
      {
        name: 'an index worked out from what the loop tests',
        code: given(`
          let low = 0;
          let high = list.length;
          while (low < high) {
            const middle = (low + high) >> 1;
            // Within bounds: low <= middle < high.
            if (list[middle]! > 0) low = middle + 1;
            else high = middle;
          }`),
      },
      {
        name: "a typed array's cell",
        code: given(`
          for (let cell = 0; cell < typed.length; cell++) {
            // Within bounds: the loop's.
            const value = typed[cell]!;
          }`),
      },
      {
        name: 'a comment at the end of the line',
        code: given(`
          for (let index = 0; index < list.length; index++) {
            const item = list[index]!; // Within bounds: the loop's.
          }`),
      },
    ],
    invalid: [
      { name: 'outside a loop', code: given('const item = list[0]!;'), errors: [{ messageId: 'unbounded' }] },
      { name: 'not an index', code: given('const item = maybe!;'), errors: [{ messageId: 'unbounded' }] },
      { name: "a map's lookup", code: given('const item = map.get(name)!;'), errors: [{ messageId: 'unbounded' }] },
      {
        name: 'a lookup by id, in a loop',
        code: given(`
          for (const key of [name]) {
            // Within bounds: no.
            const item = byName[key]!;
          }`),
        errors: [{ messageId: 'unbounded' }],
      },
      {
        name: 'a fixed index, which no loop bounds',
        code: given(`
          for (const value of list) {
            // Within bounds: no.
            const item = other[0]! + value;
          }`),
        errors: [{ messageId: 'unbounded' }],
      },
      {
        name: 'inside a callback, which no loop outside it bounds',
        code: given(`
          for (const value of list) {
            // Within bounds: no.
            other.map((_, position) => list[position]! + value);
          }`),
        errors: [{ messageId: 'unbounded' }],
      },
      {
        name: 'no comment',
        code: given(`
          for (let index = 0; index < list.length; index++) {
            const item = list[index]!;
          }`),
        errors: [{ messageId: 'unsaid' }],
      },
      {
        name: 'a comment that does not say so',
        code: given(`
          for (let index = 0; index < list.length; index++) {
            // The item.
            const item = list[index]!;
          }`),
        errors: [{ messageId: 'unsaid' }],
      },
    ],
  });
});
