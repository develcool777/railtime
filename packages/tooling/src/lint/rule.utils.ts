import { AST_NODE_TYPES, ESLintUtils } from '@typescript-eslint/utils';
import type { TSESLint, TSESTree } from '@typescript-eslint/utils';

/** Makes a house rule, whose docs are the convention it checks, in CLAUDE.md. */
export const createRule = ESLintUtils.RuleCreator(name => `https://github.com/develcool777/railtime/blob/main/CLAUDE.md#${name}`);

/** What `vue-eslint-parser` adds to its parser's services, to visit a template's expressions. */
type VueServices = { defineTemplateBodyVisitor?: (template: TSESLint.RuleListener, script: TSESLint.RuleListener) => TSESLint.RuleListener };

/**
 * A rule's visitors, with those for a component's template: in a `.vue` file the program knows only the
 * script, so a template's expressions have no types to read, and a rule says of them what it can from
 * what is written.
 *
 * @param context - The rule's context.
 * @param template - What it visits in a template.
 * @param script - What it visits in code.
 * @returns The visitors, for a `.vue` file or any other.
 */
export const withTemplate = (
  context: Readonly<TSESLint.RuleContext<string, readonly unknown[]>>,
  template: TSESLint.RuleListener,
  script: TSESLint.RuleListener,
): TSESLint.RuleListener => (context.sourceCode.parserServices as VueServices).defineTemplateBodyVisitor?.(template, script) ?? script;

/**
 * Whether a value of a node's is a node.
 *
 * @param value - The value.
 * @returns True for one.
 */
const isNode = (value: unknown): value is TSESTree.Node => typeof value === 'object' && value !== null && 'type' in value;

/**
 * The names under a node: what it reads, binds or types.
 *
 * @param node - The node.
 * @returns The names.
 */
export const namesIn = (node: TSESTree.Node): Set<string> => {
  const names = new Set<string>();
  const stack: TSESTree.Node[] = [node];
  for (let next = stack.pop(); next; next = stack.pop()) {
    if (next.type === AST_NODE_TYPES.Identifier) names.add(next.name);
    for (const [key, value] of Object.entries(next)) {
      if (key !== 'parent') stack.push(...[value as unknown].flat().filter(isNode));
    }
  }
  return names;
};
