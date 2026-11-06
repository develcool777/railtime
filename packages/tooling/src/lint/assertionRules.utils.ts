import { AST_NODE_TYPES, ESLintUtils } from '@typescript-eslint/utils';
import type { TSESLint, TSESTree } from '@typescript-eslint/utils';
import typescript from 'typescript';
import { createRule, namesIn, withTemplate } from './rule.utils.ts';

/** What a comment beside a `!` says, so the guarantee is written where a reader looks for it. */
const BOUNDS_COMMENT = /within bounds/i;

/** The loops a `!` may stand in. */
const LOOPS = new Set<AST_NODE_TYPES>([
  AST_NODE_TYPES.ForStatement,
  AST_NODE_TYPES.ForOfStatement,
  AST_NODE_TYPES.WhileStatement,
  AST_NODE_TYPES.DoWhileStatement,
]);

/** What ends the search for a loop: a loop outside a callback says nothing of what the callback is given. */
const FUNCTIONS = new Set<AST_NODE_TYPES>([AST_NODE_TYPES.ArrowFunctionExpression, AST_NODE_TYPES.FunctionExpression, AST_NODE_TYPES.FunctionDeclaration]);

/** A loop statement. */
type Loop = TSESTree.ForStatement | TSESTree.ForOfStatement | TSESTree.WhileStatement | TSESTree.DoWhileStatement;

/**
 * Whether a node is a loop.
 *
 * @param node - The node.
 * @returns True for one.
 */
const isLoop = (node: TSESTree.Node): node is Loop => LOOPS.has(node.type);

/**
 * What a loop's own head bounds: what `for` declares and tests, what `for…of` binds, what `while` tests.
 *
 * @param loop - The loop.
 * @returns The names.
 */
const boundedBy = (loop: Loop): Set<string> => {
  if (loop.type === AST_NODE_TYPES.ForOfStatement) return namesIn(loop.left);
  const test = loop.test ? namesIn(loop.test) : new Set<string>();
  return loop.type === AST_NODE_TYPES.ForStatement && loop.init ? test.union(namesIn(loop.init)) : test;
};

/**
 * The names a loop's body works out from what its head bounds: `const middle = (low + high) >> 1`.
 *
 * @param loop - The loop.
 * @param bounded - What its head bounds.
 * @returns Those names, and the head's.
 */
const derivedFrom = (loop: Loop, bounded: Set<string>): Set<string> => {
  const known = new Set(bounded);
  if (loop.body.type !== AST_NODE_TYPES.BlockStatement) return known;
  for (const statement of loop.body.body) {
    if (statement.type !== AST_NODE_TYPES.VariableDeclaration) continue;
    for (const { id, init } of statement.declarations) {
      if (init && !namesIn(init).isDisjointFrom(known)) for (const name of namesIn(id)) known.add(name);
    }
  }
  return known;
};

/**
 * The loops round a node, nearest first, up to the function it is in.
 *
 * @param node - The node.
 * @returns The loops.
 */
const loopsRound = (node: TSESTree.Node): Loop[] => {
  const loops: Loop[] = [];
  for (let parent = node.parent; parent && !FUNCTIONS.has(parent.type); parent = parent.parent) if (isLoop(parent)) loops.push(parent);
  return loops;
};

/**
 * The loop round a node that bounds an index.
 *
 * @param node - The assertion.
 * @param index - The index.
 * @returns The loop, or `null` for none.
 */
const loopBounding = (node: TSESTree.Node, index: TSESTree.Node): Loop | null => {
  const read = namesIn(index);
  return loopsRound(node).find(loop => !read.isDisjointFrom(derivedFrom(loop, boundedBy(loop)))) ?? null;
};

/**
 * Whether a comment says the bounds hold, before the statement holding a node or any statement out to
 * the loop: one comment over a loop speaks for what is inside it.
 *
 * @param source - The source.
 * @param node - The node.
 * @param loop - The loop it stands in.
 * @returns True if one does.
 */
const saysBounds = (source: Readonly<TSESLint.SourceCode>, node: TSESTree.Node, loop: Loop): boolean => {
  const says = (comment: TSESTree.Comment) => BOUNDS_COMMENT.test(comment.value);
  if (source.getAllComments().some(comment => comment.loc.end.line === node.loc.start.line && says(comment))) return true;
  for (let current: TSESTree.Node | undefined = node; current; current = current.parent) {
    if (source.getCommentsBefore(current).some(says)) return true;
    if (current === loop) return false;
  }
  return false;
};

/**
 * `!` says a value is there where the types cannot: it is allowed where a loop's bounds guarantee it,
 * an element at a numeric index the loop bounds, with a comment saying so. Anything else fails loudly
 * instead (`required()`), or is restructured so the types see it.
 */
export const boundedAssertion = createRule({
  name: 'bounded-assertion',
  meta: {
    type: 'problem',
    docs: { description: '`!` only on a numeric index inside a loop whose bounds guarantee it, with a comment saying so.' },
    schema: [],
    messages: {
      unbounded:
        '`!` only on a numeric index inside a loop whose bounds guarantee it: a lookup by an id goes through `required()` (or `NetworkIndex.stationOf`/`lineOf`), which fails loudly; anything else is restructured so the types see it.',
      unsaid: 'Say why this element is there: a `// Within bounds: …` comment over it, or over the loop.',
    },
    defaultOptions: [],
  },
  create: context => {
    const services = ESLintUtils.getParserServices(context);
    const checker = services.program.getTypeChecker();
    const { sourceCode } = context;
    /**
     * Whether an expression is a number.
     *
     * @param node - The expression.
     * @returns True if its type is.
     */
    const isNumber = (node: TSESTree.Node): boolean => {
      const type = services.getTypeAtLocation(node);
      return ((checker.getBaseConstraintOfType(type) ?? type).flags & typescript.TypeFlags.NumberLike) !== 0;
    };
    return withTemplate(
      context,
      // A template has no loop to bound it.
      { TSNonNullExpression: node => context.report({ node, messageId: 'unbounded' }) },
      {
        TSNonNullExpression: node => {
          const { expression } = node;
          const indexed = expression.type === AST_NODE_TYPES.MemberExpression && expression.computed && isNumber(expression.property);
          const loop = indexed ? loopBounding(node, expression.property) : null;
          if (!loop) context.report({ node, messageId: 'unbounded' });
          else if (!saysBounds(sourceCode, node, loop)) context.report({ node, messageId: 'unsaid' });
        },
      },
    );
  },
});

/** The rules about assertions, by name: what the house plugin (`eslint/shared.js`) adds to its own. */
export const ASSERTION_RULES = { 'bounded-assertion': boundedAssertion };
