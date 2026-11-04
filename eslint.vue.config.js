import tseslint from 'typescript-eslint';
import vueParser from 'vue-eslint-parser';

/**
 * How a component is written: its blocks, its macros, what its template says and how. Apart from
 * `eslint.config.js`, which takes it, as the one subject it is.
 */
export const vueConfig = {
  files: ['**/*.vue'],
  languageOptions: {
    parser: vueParser,
    parserOptions: { parser: tseslint.parser, projectService: true, tsconfigRootDir: import.meta.dirname, extraFileExtensions: ['.vue'] },
  },
  rules: {
    'vue/multi-word-component-names': 'off',
    'vue/block-lang': ['error', { script: { lang: 'ts' } }],
    'vue/block-order': ['error', { order: ['template', 'script[setup]', 'style'] }],
    'vue/padding-line-between-blocks': ['error', 'always'],
    'vue/component-api-style': ['error', ['script-setup', 'composition']],
    'vue/define-macros-order': ['error', { order: ['defineProps', 'defineEmits'] }],
    'vue/require-macro-variable-name': ['error', { defineProps: 'props', defineEmits: 'emit', defineSlots: 'slots', useSlots: 'slots', useAttrs: 'attrs' }],
    'vue/attribute-hyphenation': ['error', 'never'],
    'vue/v-on-event-hyphenation': ['error', 'never', { autofix: true }],
    'vue/prop-name-casing': ['error', 'camelCase'],
    'vue/v-bind-style': ['error', 'shorthand', { sameNameShorthand: 'always' }],
    'vue/v-on-style': ['error', 'shorthand'],
    'vue/no-v-html': 'error',
    // A component's `<script setup>` runs once for each: its top level is the component's own.
    'unicorn/no-top-level-assignment-in-function': 'off',
    // A template says each thing one way: `class` apart from `:class`, `disabled` for `:disabled="true"`.
    'vue/no-useless-v-bind': 'error',
    'vue/prefer-separate-static-class': 'error',
    'vue/prefer-true-attribute-shorthand': ['error', 'always'],
    // An element's ref is `useTemplateRef`, typed by what it holds.
    'vue/prefer-use-template-ref': 'error',
    // Nothing declared and never used: a prop, an event, a ref.
    'vue/no-unused-properties': 'error',
    'vue/no-unused-emit-declarations': 'error',
    'vue/no-unused-refs': 'error',
    // The recommended set's other rules, which it only warns of: what a template means, never how it is laid out.
    'vue/attributes-order': 'error',
    'vue/component-definition-name-casing': 'error',
    'vue/html-end-tags': 'error',
    'vue/no-lone-template': 'error',
    'vue/no-multiple-slot-args': 'error',
    'vue/no-required-prop-with-default': 'error',
    'vue/no-template-shadow': 'error',
    'vue/one-component-per-file': 'error',
    'vue/order-in-components': 'error',
    'vue/require-default-prop': 'error',
    'vue/require-explicit-emits': 'error',
    'vue/require-prop-types': 'error',
    'vue/this-in-template': 'error',
    // Prettier lays templates out (`pnpm format-check`): the recommended set's layout rules would argue with it.
    'vue/first-attribute-linebreak': 'off',
    'vue/html-closing-bracket-newline': 'off',
    'vue/html-closing-bracket-spacing': 'off',
    'vue/html-indent': 'off',
    'vue/html-quotes': 'off',
    'vue/html-self-closing': 'off',
    'vue/max-attributes-per-line': 'off',
    'vue/multiline-html-element-content-newline': 'off',
    'vue/mustache-interpolation-spacing': 'off',
    'vue/no-multi-spaces': 'off',
    'vue/no-spaces-around-equal-signs-in-attribute': 'off',
    'vue/singleline-html-element-content-newline': 'off',
  },
};
