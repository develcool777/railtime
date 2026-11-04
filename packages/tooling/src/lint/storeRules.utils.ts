import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import type { TSESTree } from '@typescript-eslint/utils';
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

/** The rules about stores, by name: what the house plugin (`eslint/shared.js`) adds to its own. */
export const STORE_RULES = { 'store-returns-state': storeReturnsState };
