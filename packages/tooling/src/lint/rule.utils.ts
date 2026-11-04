import { ESLintUtils } from '@typescript-eslint/utils';

/** Makes a house rule, whose docs are the convention it checks, in CLAUDE.md. */
export const createRule = ESLintUtils.RuleCreator(name => `https://github.com/develcool777/railtime/blob/main/CLAUDE.md#${name}`);
