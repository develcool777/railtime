import tseslint from 'typescript-eslint';
import vueParser from 'vue-eslint-parser';
import { ROOT } from './shared.js';

/** How a component is written: its blocks, its macros, what its template says and how, and what a screen reader needs of it. */
export const vueConfig = [
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: { parser: tseslint.parser, projectService: true, tsconfigRootDir: ROOT, extraFileExtensions: ['.vue'] },
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
      // A component's parts declared and typed, as a function's are: its props each with a JSDoc, read as
      // `props.name` (never destructured), declared by a type; its events and slots too.
      'vue/require-prop-comment': 'error',
      'vue/define-props-destructuring': ['error', { destructure: 'never' }],
      'vue/define-props-declaration': ['error', 'type-based'],
      'vue/define-emits-declaration': ['error', 'type-literal'],
      'vue/require-explicit-slots': 'error',
      'vue/require-typed-ref': 'error',
      'vue/no-props-shadow': 'error',
      'vue/no-import-compiler-macros': 'error',
      'vue/prefer-define-options': 'error',
      'vue/prefer-prop-type-boolean-first': 'error',
      // A boolean prop is `false` unless given; a model's value is its parent's, never a default of its own.
      'vue/no-boolean-default': 'error',
      'vue/no-define-model-default': 'error',
      // A prop or a ref read once, at setup, keeps the value it had: what follows it is a `computed`, or
      // reads it where it is used.
      'vue/no-setup-props-reactivity-loss': 'error',
      'vue/no-ref-object-reactivity-loss': 'error',
      // Names a reader cannot take for something else: no event called as the browser's (`select`,
      // `change`), components in PascalCase, events and slots in camelCase.
      'vue/no-shadow-native-events': 'error',
      'vue/component-name-in-template-casing': ['error', 'PascalCase', { registeredComponentsOnly: false }],
      'vue/custom-event-name-casing': ['error', 'camelCase'],
      'vue/slot-name-casing': ['error', 'camelCase'],
      // What a template means is what it says: the same component in `v-if` and `v-else` keyed apart, so
      // one never takes the other's state; a `<button>` with its `type`; no property it does not have.
      'vue/v-if-else-key': 'error',
      'vue/html-button-has-type': 'error',
      'vue/no-undef-properties': 'error',
      'vue/no-use-v-else-with-v-for': 'error',
      'vue/no-duplicate-attr-inheritance': 'error',
      'vue/no-empty-component-block': 'error',
      'vue/no-useless-mustaches': 'error',
      'vue/no-duplicate-class-names': 'error',
      'vue/no-multiple-objects-in-class': 'error',
      'vue/no-static-inline-styles': 'error',
      'vue/next-tick-style': 'error',
      'vue/v-slot-style': 'error',
      // A template's expressions held to what a script's are (`javascript.config.js`).
      'vue/eqeqeq': 'error',
      'vue/no-implicit-coercion': 'error',
      'vue/no-negated-condition': 'error',
      // A template's guard clauses: the empty state first (`v-if="!from"`), what it shows in `v-else`, as
      // a function returns early; this rule would put the content first and the empty state last.
      'vue/no-negated-v-if-condition': 'off',
      'vue/no-constant-condition': 'error',
      'vue/dot-notation': 'error',
      'vue/prefer-template': 'error',
      'vue/no-useless-concat': 'error',
      'vue/object-shorthand': 'error',
      'vue/no-console': 'error',
      'vue/no-sparse-arrays': 'error',
      'vue/no-loss-of-precision': 'error',
      'vue/no-empty-pattern': 'error',
      'vue/no-irregular-whitespace': 'error',
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
      // Tailwind takes a list's bullets away, and with them Safari's VoiceOver stops calling it a list: `role="list"` gives it back.
      'vuejs-accessibility/no-redundant-roles': ['error', { ul: ['list'], ol: ['list'] }],
      // Beyond the recommended: what is hidden from a screen reader, or said to be nothing, is never what a keyboard lands on.
      'vuejs-accessibility/no-aria-hidden-on-focusable': 'error',
      'vuejs-accessibility/no-role-presentation-on-focusable': 'error',
    },
  },
];
