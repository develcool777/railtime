import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import type { TSESLint, TSESTree } from '@typescript-eslint/utils';
import { createRule } from './rule.utils.ts';

/** What makes a store's state: a value of its own, which Pinia keeps. */
const STATE_MAKERS = new Set(['ref', 'shallowRef', 'reactive', 'shallowReactive']);

/**
 * The state a setup store's body declares at its top: each `const name = ref(…)` and its kin.
 *
 * @param body - The setup function's body.
 * @returns Each state's declaration, by its name.
 */
const stateOf = (body: TSESTree.BlockStatement): Map<string, TSESTree.VariableDeclarator> => {
  const state = new Map<string, TSESTree.VariableDeclarator>();
  for (const statement of body.body) {
    if (statement.type !== AST_NODE_TYPES.VariableDeclaration) continue;
    for (const declarator of statement.declarations) {
      const { id, init } = declarator;
      if (id.type !== AST_NODE_TYPES.Identifier || init?.type !== AST_NODE_TYPES.CallExpression) continue;
      if (init.callee.type === AST_NODE_TYPES.Identifier && STATE_MAKERS.has(init.callee.name)) state.set(id.name, declarator);
    }
  }
  return state;
};

/**
 * The names a setup store returns: its `return { … }`'s keys, shorthand or not, by the value given.
 *
 * @param body - The setup function's body.
 * @returns The names returned, or `null` for no object returned (nothing to hold it to).
 */
const returnedOf = (body: TSESTree.BlockStatement): Set<string> | null => {
  const statement = body.body.find(each => each.type === AST_NODE_TYPES.ReturnStatement);
  if (statement?.argument?.type !== AST_NODE_TYPES.ObjectExpression) return null;
  const returned = new Set<string>();
  for (const property of statement.argument.properties) {
    if (property.type === AST_NODE_TYPES.Property && property.value.type === AST_NODE_TYPES.Identifier) returned.add(property.value.name);
  }
  return returned;
};

/**
 * A setup store returns all its state: Pinia keeps only what it returns, so a ref left out is
 * invisible to its devtools and plugins, and is lost in server rendering.
 */
export const storeReturnsState = createRule({
  name: 'store-returns-state',
  meta: {
    type: 'problem',
    docs: { description: 'A setup store returns all its state.' },
    schema: [],
    messages: {
      unreturned:
        '`{{name}}` is state the store does not return: Pinia keeps only what a setup store returns (its devtools, plugins and server rendering see nothing else). Return it, under `// State`.',
    },
    defaultOptions: [],
  },
  create: context => ({
    CallExpression: node => {
      if (node.callee.type !== AST_NODE_TYPES.Identifier || node.callee.name !== 'defineStore') return;
      const setup = node.arguments[1];
      if (setup?.type !== AST_NODE_TYPES.ArrowFunctionExpression || setup.body.type !== AST_NODE_TYPES.BlockStatement) return;
      const returned = returnedOf(setup.body);
      if (!returned) return;
      for (const [name, declarator] of stateOf(setup.body)) {
        if (!returned.has(name)) context.report({ node: declarator, messageId: 'unreturned', data: { name } });
      }
    },
  }),
});

/** The parts of a setup store, in the order it has them. */
const SECTIONS = ['State', 'Getters', 'Actions'] as const;

/** A part of a setup store. */
type Section = (typeof SECTIONS)[number];

/** What a part's heading says. */
const HEADING = /^ ---- (State|Getters|Actions)$/;

/** How an action is named: in capitals, so a call reads as one wherever it is made. */
const ACTION_NAME = /^[A-Z][A-Z0-9_]*$/;

/**
 * Which part of a store a declaration belongs to, by what it makes: a ref is state, a computed a
 * getter, a function in capitals an action. Anything else (a store read, a helper) is no part's.
 *
 * @param declarator - The declaration.
 * @returns The part, or `null` for none.
 */
const sectionOf = ({ id, init }: TSESTree.VariableDeclarator): Section | null => {
  if (init?.type === AST_NODE_TYPES.ArrowFunctionExpression) return id.type === AST_NODE_TYPES.Identifier && ACTION_NAME.test(id.name) ? 'Actions' : null;
  if (init?.type !== AST_NODE_TYPES.CallExpression || init.callee.type !== AST_NODE_TYPES.Identifier) return null;
  if (STATE_MAKERS.has(init.callee.name)) return 'State';
  return init.callee.name === 'computed' ? 'Getters' : null;
};

/**
 * Each heading in a store's body, in order.
 *
 * @param source - The source.
 * @param body - The setup function's body.
 * @returns Each heading's comment and part.
 */
const headingsIn = (source: Readonly<TSESLint.SourceCode>, body: TSESTree.BlockStatement): { comment: TSESTree.Comment; section: Section }[] =>
  source.getAllComments().flatMap(comment => {
    const said = HEADING.exec(comment.value)?.[1] as Section | undefined;
    const inside = comment.range[0] > body.range[0] && comment.range[1] < body.range[1];
    return said && inside ? [{ comment, section: said }] : [];
  });

/**
 * The top-level declarations of a store's body, each with the part it belongs to.
 *
 * @param body - The setup function's body.
 * @returns Those that belong to one.
 */
const partsOf = (body: TSESTree.BlockStatement): { declarator: TSESTree.VariableDeclarator; section: Section }[] =>
  body.body.flatMap(statement =>
    statement.type === AST_NODE_TYPES.VariableDeclaration
      ? statement.declarations.flatMap(declarator => {
          const section = sectionOf(declarator);
          return section ? [{ declarator, section }] : [];
        })
      : [],
  );

/**
 * What can be read of a setup store's layout (CLAUDE.md, `A store is a setup store`): its headings in
 * order, what it makes under the heading for it, what it returns in the same order, and each function
 * it returns named in capitals, an action. That its state changes only by its actions is not here:
 * a store's refs are written from outside through Pinia's own proxy, which no syntax tells apart.
 */
export const storeShape = createRule({
  name: 'store-shape',
  meta: {
    type: 'problem',
    docs: { description: "A setup store's headings in order, each part under its own, and its actions in capitals." },
    schema: [],
    messages: {
      headings: 'A store goes `// ---- State`, `// ---- Getters`, `// ---- Actions`, each once and in that order: `{{section}}` is not in its place.',
      misplaced: '`{{name}}` belongs under `// ---- {{section}}`.',
      returned: 'A store returns its state, then its getters, then its actions, in the order it has them: `{{name}}` comes too late.',
      action: '`{{name}}` is a function the store returns, so an action: named in capitals, as a call reads as one wherever it is made.',
    },
    defaultOptions: [],
  },
  create: context => {
    /**
     * Holds the headings to their order, and each part to its own.
     *
     * @param body - The setup function's body.
     */
    const checkParts = (body: TSESTree.BlockStatement): void => {
      const headings = headingsIn(context.sourceCode, body);
      const places = headings.map(({ section }) => SECTIONS.indexOf(section));
      for (const [position, { comment, section }] of headings.entries()) {
        const before = places[position - 1];
        if (before !== undefined && SECTIONS.indexOf(section) <= before) context.report({ loc: comment.loc, messageId: 'headings', data: { section } });
      }
      for (const { declarator, section } of partsOf(body)) {
        const heading = headings.findLast(({ comment }) => comment.range[1] <= declarator.range[0]);
        const name = declarator.id.type === AST_NODE_TYPES.Identifier ? declarator.id.name : '';
        if (heading?.section !== section) context.report({ node: declarator, messageId: 'misplaced', data: { name, section } });
      }
    };
    /**
     * Holds what a store returns to its parts' order, and its functions to an action's name.
     *
     * @param body - The setup function's body.
     */
    const checkReturned = (body: TSESTree.BlockStatement): void => {
      const statement = body.body.find(each => each.type === AST_NODE_TYPES.ReturnStatement);
      if (statement?.argument?.type !== AST_NODE_TYPES.ObjectExpression) return;
      const sections = new Map(
        partsOf(body).flatMap(({ declarator, section }) => (declarator.id.type === AST_NODE_TYPES.Identifier ? [[declarator.id.name, section]] : [])),
      );
      const functions = new Set(
        body.body.flatMap(each =>
          each.type === AST_NODE_TYPES.VariableDeclaration
            ? each.declarations
                .filter(({ init }) => init?.type === AST_NODE_TYPES.ArrowFunctionExpression)
                .flatMap(({ id }) => (id.type === AST_NODE_TYPES.Identifier ? [id.name] : []))
            : [],
        ),
      );
      let furthest = 0;
      for (const property of statement.argument.properties) {
        if (property.type !== AST_NODE_TYPES.Property || property.value.type !== AST_NODE_TYPES.Identifier) continue;
        const { name } = property.value;
        if (functions.has(name) && !ACTION_NAME.test(name)) context.report({ node: property, messageId: 'action', data: { name } });
        const place = SECTIONS.indexOf(sections.get(name) ?? 'State');
        if (sections.has(name) && place < furthest) context.report({ node: property, messageId: 'returned', data: { name } });
        furthest = Math.max(furthest, sections.has(name) ? place : 0);
      }
    };
    return {
      CallExpression: node => {
        if (node.callee.type !== AST_NODE_TYPES.Identifier || node.callee.name !== 'defineStore') return;
        const setup = node.arguments[1];
        if (setup?.type !== AST_NODE_TYPES.ArrowFunctionExpression || setup.body.type !== AST_NODE_TYPES.BlockStatement) return;
        checkParts(setup.body);
        checkReturned(setup.body);
      },
    };
  },
});

/** The rules about stores, by name: what the house plugin (`eslint/shared.js`) adds to its own. */
export const STORE_RULES = { 'store-returns-state': storeReturnsState, 'store-shape': storeShape };
