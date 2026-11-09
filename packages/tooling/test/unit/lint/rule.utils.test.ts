import { RuleTester } from '@typescript-eslint/rule-tester';
import type { TSESLint } from '@typescript-eslint/utils';
import { afterAll, describe, expect, test } from 'vitest';
import { createRule, namesIn, withTemplate } from '../../../src/lint/rule.utils';

// The rule tester runs its cases as Vitest's tests.
RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = test;

/** The rule reads only the code: no types. */
const tester = new RuleTester();

/** A rule made with the helpers: it reports the names each `return` reads. */
const namesReturned = createRule({
  name: 'names-returned',
  meta: {
    type: 'suggestion',
    docs: { description: 'Reports the names a return reads.' },
    messages: { names: '{{names}}' },
    schema: [],
    defaultOptions: [],
  },
  create: context =>
    withTemplate(
      context,
      {},
      {
        ReturnStatement: node =>
          context.report({ node, messageId: 'names', data: { names: [...namesIn(node)].toSorted((first, second) => first.localeCompare(second)).join(' ') } }),
      },
    ),
});

tester.run('names-returned', namesReturned, {
  valid: [{ name: 'nothing returned', code: 'const value = 1;' }],
  invalid: [
    {
      name: 'every name under a return: what it reads, its properties and its types',
      code: 'const read = (first: number) => { return first + other.inner as Count; };',
      errors: [{ messageId: 'names', data: { names: 'Count first inner other' } }],
    },
  ],
});

describe('RuleUtils', () => {
  describe('createRule', () => {
    test('points a rule at the convention it checks, in CLAUDE.md', () => {
      expect(namesReturned.meta.docs?.url).toBe('https://github.com/develcool777/railtime/blob/main/CLAUDE.md#names-returned');
    });
  });

  describe('withTemplate', () => {
    test("visits a component's template too where the parser can, and the code alone where it cannot", () => {
      const script: TSESLint.RuleListener = {};
      const both: TSESLint.RuleListener = {};
      const context = (services: object) => ({ sourceCode: { parserServices: services } }) as unknown as Parameters<typeof withTemplate>[0];
      expect(withTemplate(context({ defineTemplateBodyVisitor: () => both }), {}, script)).toBe(both);
      expect(withTemplate(context({}), {}, script)).toBe(script);
    });
  });
});
