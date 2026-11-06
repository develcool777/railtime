import { AST_NODE_TYPES, ESLintUtils } from '@typescript-eslint/utils';
import type { TSESTree } from '@typescript-eslint/utils';
import typescript from 'typescript';
import type { Type } from 'typescript';
import { holdsBrand, isKeyedByBrand } from './brand.utils.ts';
import { createRule, namesIn, withTemplate } from './rule.utils.ts';

/** The `Object` functions that type a record's keys `string`, and the helpers that keep their kind. */
const OBJECT_KEYS = new Map([
  ['keys', 'keysOf'],
  ['entries', 'entriesOf'],
  ['fromEntries', 'fromEntriesOf'],
]);

/** The types of a city's files, by name. */
const FILE_TYPES = new Set(['Network', 'CityBoundary']);

/** What fetches a file and is told its type. */
const FETCHES = new Set(['useFetch', '$fetch']);

/** The flags that say what a symbol is. */
const { SymbolFlags } = typescript;

/**
 * No id made by asserting it: a string becomes an id only where it is checked. Asserting one where it
 * is already an id (`id as StationId` of a `StationId | undefined`) narrows, and passes. A template's
 * expressions have no types to read: there an assertion that names an id's type is refused, whatever
 * it asserts from, and a handler in the script takes the id as it is.
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
    /**
     * Whether a name in a template is the name of a type holding an id, as the script sees it.
     *
     * @param name - The name.
     * @returns True if it is.
     */
    const namesId = (name: string): boolean => {
      const file = services.program.getSourceFile(context.filename);
      const symbol = file && checker.resolveName(name, file, SymbolFlags.Type | SymbolFlags.Alias, false);
      if (!symbol) return false;
      const declared = (symbol.flags & SymbolFlags.Alias) === 0 ? symbol : checker.getAliasedSymbol(symbol);
      return holdsBrand(checker, checker.getDeclaredTypeOfSymbol(declared));
    };
    /**
     * Reports an assertion in a template that names an id's type.
     *
     * @param node - The assertion.
     */
    const checkTemplate = (node: TSESTree.TSAsExpression | TSESTree.TSTypeAssertion): void => {
      if ([...namesIn(node.typeAnnotation)].some(namesId)) context.report({ node, messageId: 'asserted' });
    };
    return withTemplate(context, { TSAsExpression: checkTemplate, TSTypeAssertion: checkTemplate }, { TSAsExpression: check, TSTypeAssertion: check });
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

/**
 * A city's files become their types at two doors only: `parseNetwork` and `parseBoundary`, which check
 * them, and `servedNetwork` and `servedBoundary`, which trust what CI checked. No assertion anywhere
 * else says a value is one, nor a fetch's type argument, which is an assertion by another name.
 */
export const servedFiles = createRule({
  name: 'served-files',
  meta: {
    type: 'problem',
    docs: { description: "A city's files are typed at their doors, never by an assertion." },
    schema: [],
    messages: {
      asserted:
        "A city's file is typed at its door: `parseNetwork`/`parseBoundary` (`@railtime/schema/*.schema`) where it is read to be checked, `servedNetwork`/`servedBoundary` (`@railtime/schema/served.utils`) where the browser reads what CI checked; in a test, `asNetwork` (`@railtime/schema/testing/ids`).",
    },
    defaultOptions: [],
  },
  create: context => {
    const services = ESLintUtils.getParserServices(context);
    /**
     * Whether a type is a city's file, or may be: `Network`, `CityBoundary | null`.
     *
     * @param type - The type.
     * @returns True for one.
     */
    const isFile = (type: Type): boolean => (type.isUnion() ? type.types.some(isFile) : FILE_TYPES.has(type.aliasSymbol?.name ?? ''));
    /**
     * Reports an assertion to a city's file.
     *
     * @param node - The assertion.
     */
    const check = (node: TSESTree.TSAsExpression | TSESTree.TSTypeAssertion): void => {
      if (isFile(services.getTypeAtLocation(node))) context.report({ node, messageId: 'asserted' });
    };
    /**
     * Reports an assertion in a template that names a city's file, as one has no types to read.
     *
     * @param node - The assertion.
     */
    const checkTemplate = (node: TSESTree.TSAsExpression | TSESTree.TSTypeAssertion): void => {
      if (!FILE_TYPES.isDisjointFrom(namesIn(node.typeAnnotation))) context.report({ node, messageId: 'asserted' });
    };
    return withTemplate(
      context,
      { TSAsExpression: checkTemplate, TSTypeAssertion: checkTemplate },
      {
        TSAsExpression: check,
        TSTypeAssertion: check,
        CallExpression: node => {
          const { callee, typeArguments } = node;
          if (callee.type !== AST_NODE_TYPES.Identifier || !FETCHES.has(callee.name)) return;
          for (const argument of typeArguments?.params ?? []) if (isFile(services.getTypeAtLocation(argument))) context.report({ node, messageId: 'asserted' });
        },
      },
    );
  },
});

/** The rules about ids, by name: what the house plugin (`eslint/shared.js`) adds to its own. */
export const ID_RULES = {
  'checked-ids': checkedIds,
  'branded-spread-key': brandedSpreadKey,
  'branded-record-keys': brandedRecordKeys,
  'served-files': servedFiles,
};
