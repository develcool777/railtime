import jsdoc from 'eslint-plugin-jsdoc';

/** The code a JSDoc mirrors the signature of: every function but an arrow in an array (a table, documented as one). */
const JSDOC_FUNCTIONS = ['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression:not(ArrayExpression > ArrowFunctionExpression)'];

/** A JSDoc on every class, member, module-level constant and type, each mirroring its signature. */
export const jsdocConfig = [
  {
    files: ['packages/*/src/**/*.ts', '**/test/support/**/*.ts', 'web/src/**/*.ts'],
    plugins: { jsdoc },
    rules: {
      'jsdoc/require-jsdoc': [
        'error',
        {
          publicOnly: false,
          require: { ClassDeclaration: true, MethodDefinition: true, FunctionDeclaration: true },
          contexts: [
            'PropertyDefinition',
            'Program > VariableDeclaration',
            'ExportNamedDeclaration:has(> VariableDeclaration)',
            'Program > TSTypeAliasDeclaration',
            'ExportNamedDeclaration:has(> TSTypeAliasDeclaration)',
          ],
          checkConstructors: false,
          checkGetters: true,
          // `--fix` would write an empty `/** */`: a doc is written, never stamped.
          enableFixer: false,
        },
      ],
    },
  },
  // …and every JSDoc, a component's too, mirroring its signature.
  {
    files: ['packages/*/src/**/*.ts', '**/test/support/**/*.ts', 'web/src/**/*.{ts,vue}'],
    plugins: { jsdoc },
    rules: {
      // A `@param <name> - <what>` for each parameter and none for one gone; a `@returns` for a value,
      // none for `void`. No `{type}`, no `[optional]`, no default: TypeScript says those.
      'jsdoc/require-param': ['error', { checkDestructured: false, contexts: JSDOC_FUNCTIONS, enableFixer: false }],
      'jsdoc/check-param-names': ['error', { checkDestructured: false }],
      'jsdoc/require-param-description': 'error',
      'jsdoc/require-hyphen-before-param-description': 'error',
      // A getter's doc says what it is: no `@returns` beside it.
      'jsdoc/require-returns': [
        'error',
        { checkGetters: false, contexts: JSDOC_FUNCTIONS.map(node => `${node}:not([returnType.typeAnnotation.type='TSVoidKeyword'])`) },
      ],
      'jsdoc/require-returns-check': 'error',
      'jsdoc/require-returns-description': 'error',
      'jsdoc/check-tag-names': 'error',
      'jsdoc/no-types': 'error',
      'jsdoc/no-defaults': 'error',
      // A doc that parses, and says what is there: no tag left empty or blank block, no type it cannot
      // find, a name on every `@param`, one asterisk a line, an `@` meant as text escaped.
      'jsdoc/check-syntax': 'error',
      'jsdoc/valid-types': 'error',
      'jsdoc/no-undefined-types': 'error',
      'jsdoc/empty-tags': 'error',
      'jsdoc/no-blank-blocks': 'error',
      'jsdoc/no-multi-asterisks': 'error',
      'jsdoc/multiline-blocks': 'error',
      'jsdoc/require-param-name': 'error',
      'jsdoc/check-property-names': 'error',
      'jsdoc/check-values': 'error',
      'jsdoc/check-access': 'error',
      'jsdoc/implements-on-classes': 'error',
      'jsdoc/escape-inline-tags': 'error',
      'jsdoc/no-restricted-syntax': [
        'error',
        {
          contexts: [
            {
              comment: String.raw`JsdocBlock:has(JsdocTag[tag="param"][name=/^\[/])`,
              context: 'any',
              message: 'No [optional] brackets on a @param: TypeScript says what is optional.',
            },
          ],
        },
      ],
    },
  },
];
