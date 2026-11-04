import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import importX from 'eslint-plugin-import-x';
import sonarjs from 'eslint-plugin-sonarjs';
import unicorn from 'eslint-plugin-unicorn';
import vuePlugin from 'eslint-plugin-vue';
import vueAccessibility from 'eslint-plugin-vuejs-accessibility';
import tseslint from 'typescript-eslint';
import { filesConfig } from './eslint/files.config.js';
import { idsConfig } from './eslint/ids.config.js';
import { importsConfig } from './eslint/imports.config.js';
import { javascriptConfig } from './eslint/javascript.config.js';
import { jsdocConfig } from './eslint/jsdoc.config.js';
import { storesConfig } from './eslint/stores.config.js';
import { testsConfig } from './eslint/tests.config.js';
import { typescriptConfig } from './eslint/typescript.config.js';
import { vueConfig } from './eslint/vue.config.js';

/**
 * The code conventions (CLAUDE.md), as rules, so they hold without anyone remembering them; each
 * convention there names the rule that checks it. Nothing is on `warn`: a rule is `error`, or `off`
 * with a line saying why, so a slip fails `pnpm eslint-check` instead of scrolling past.
 *
 * A subject a file in `eslint/`; here only the order they go in, which matters: where two blocks set
 * one rule for a file, the later wins. The plugins' recommended sets first, so the house's blocks tune
 * them; the tests last, as they relax what source is held to.
 */
export default defineConfig(
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  unicorn.configs.recommended,
  importX.flatConfigs.recommended,
  importX.flatConfigs.typescript,
  ...vuePlugin.configs['flat/recommended'],
  // What a screen reader or a keyboard needs of a template: labels, roles, keys for what is clicked.
  ...vueAccessibility.configs['flat/recommended'],
  sonarjs.configs.recommended,

  { ignores: ['**/dist/', '**/node_modules/', '**/.nuxt/', '**/.output/', '**/test-reports/', 'web/public/'] },
  // A rule is turned off here, with its reason, never by a comment in the code: one is not read, and
  // says so (a warning, which `pnpm eslint-check`, `--max-warnings 0`, fails as any other).
  { linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: 'error' } },

  javascriptConfig,
  typescriptConfig,
  importsConfig,
  jsdocConfig,
  idsConfig,
  storesConfig,
  filesConfig,
  vueConfig,
  testsConfig,
);
