import { AST_NODE_TYPES, ESLintUtils } from '@typescript-eslint/utils';
import type { TSESTree } from '@typescript-eslint/utils';
import { holdsBrand, isKeyedByBrand } from './brand.utils.ts';

/** Makes a rule whose docs are the convention it checks, in CLAUDE.md. */
const createRule = ESLintUtils.RuleCreator(name => `https://github.com/develcool777/railtime/blob/main/CLAUDE.md#${name}`);

/** The `Object` functions that type a record's keys `string`, and the helpers that keep their kind. */
const OBJECT_KEYS = new Map([
  ['keys', 'keysOf'],
  ['entries', 'entriesOf'],
  ['fromEntries', 'fromEntriesOf'],
]);

/**
 * No id made by asserting it: a string becomes an id only where it is checked. Asserting one where it
 * is already an id (`id as StationId` of a `StationId | undefined`) narrows, and passes.
 */
export const checkedIds = createRule({
  name: 'checked-ids',
  meta: {
    type: 'problem',
    docs: { description: 'An id is given by a check, never asserted.' },
    schema: [],
    messages: {
      asserted:
        "An id is given by a check, never asserted: `parseNetwork` for a city's file; `isStationIn`, `isLineIn`, `isPlanIn` (`facts.findStation`, `findLine`, `planToOpen`) for a string from outside; in a test, `stationId('a')` (`@railtime/schema/testing/ids`).",
    },
    defaultOptions: [],
  },
  create: context => {
    const services = ESLintUtils.getParserServices(context);
    const checker = services.program.getTypeChecker();
    /**
     * Reports an assertion that makes an id of what was not one.
     *
     * @param node - The assertion.
     */
    const check = (node: TSESTree.TSAsExpression | TSESTree.TSTypeAssertion): void => {
      if (holdsBrand(checker, services.getTypeAtLocation(node)) && !holdsBrand(checker, services.getTypeAtLocation(node.expression)))
        context.report({ node, messageId: 'asserted' });
    };
    return { TSAsExpression: check, TSTypeAssertion: check };
  },
});

/**
 * No computed id key beside a spread: there TypeScript checks nothing of the value
 * (`{ ...plans, [planId]: { name: 1 } }` compiles).
 */
export const brandedSpreadKey = createRule({
  name: 'branded-spread-key',
  meta: {
    type: 'problem',
    docs: { description: 'No computed id key beside a spread, where TypeScript leaves its value unchecked.' },
    schema: [],
    messages: {
      unchecked:
        'TypeScript checks nothing of a value under an id key beside a spread: copy the record, then set it by key (`record[id] = value`), or build it with `fromEntriesOf`.',
    },
    defaultOptions: [],
  },
  create: context => {
    const services = ESLintUtils.getParserServices(context);
    const checker = services.program.getTypeChecker();
    return {
      ObjectExpression: node => {
        if (node.properties.every(property => property.type !== AST_NODE_TYPES.SpreadElement)) return;
        for (const property of node.properties)
          if (property.type === AST_NODE_TYPES.Property && property.computed && holdsBrand(checker, services.getTypeAtLocation(property.key)))
            context.report({ node: property, messageId: 'unchecked' });
      },
    };
  },
});

/** A record keyed by ids is walked and made by the helpers that keep its keys' kind, never `Object`'s. */
export const brandedRecordKeys = createRule({
  name: 'branded-record-keys',
  meta: {
    type: 'problem',
    docs: { description: "A record keyed by ids is walked with `keysOf`/`entriesOf` and made with `fromEntriesOf`, which keep the keys' kind." },
    schema: [],
    messages: {
      untyped: '`Object.{{ name }}` types every key `string`, losing what kind of id it is: `{{ helper }}` (`@railtime/core/collection.utils`) keeps it.',
    },
    defaultOptions: [],
  },
  create: context => {
    const services = ESLintUtils.getParserServices(context);
    const checker = services.program.getTypeChecker();
    return {
      CallExpression: node => {
        const { callee } = node;
        const [argument] = node.arguments;
        if (
          callee.type !== AST_NODE_TYPES.MemberExpression ||
          callee.computed ||
          callee.object.type !== AST_NODE_TYPES.Identifier ||
          callee.object.name !== 'Object'
        )
          return;
        if (callee.property.type !== AST_NODE_TYPES.Identifier || argument === undefined) return;
        const name = callee.property.name;
        const helper = OBJECT_KEYS.get(name);
        if (helper === undefined) return;
        const type = services.getTypeAtLocation(argument);
        // `fromEntries` takes its keys from its entries; `keys` and `entries` from the record's index.
        const branded = name === 'fromEntries' ? holdsBrand(checker, type) : isKeyedByBrand(checker, type);
        if (branded) context.report({ node, messageId: 'untyped', data: { name, helper } });
      },
    };
  },
});

/** The rules about ids, by name: what the house plugin (`eslint/shared.js`) adds to its own. */
export const ID_RULES = { 'checked-ids': checkedIds, 'branded-spread-key': brandedSpreadKey, 'branded-record-keys': brandedRecordKeys };
