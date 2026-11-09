import { RuleTester } from '@typescript-eslint/rule-tester';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, test } from 'vitest';
import { mirroredTests } from '../../../src/lint/fileRules.utils';

// The rule tester runs its cases as Vitest's tests.
RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = test;

/** The rule reads only where a file is, and what is beside it: no types. */
const tester = new RuleTester();

/** The repository, whose own files the cases are named for. */
const ROOT = fileURLToPath(new URL('../../../../../', import.meta.url));

tester.run('mirrored-tests', mirroredTests, {
  valid: [
    { name: 'a test named for its source file, suffix and all', code: '', filename: `${ROOT}packages/core/test/unit/number.utils.test.ts` },
    { name: 'a source file with its test', code: '', filename: `${ROOT}packages/core/src/number.utils.ts` },
    { name: 'a file in no package folder the rule knows', code: '', filename: `${ROOT}vitest.shared.ts` },
  ],
  invalid: [
    {
      name: 'a test named for its source without its suffix',
      code: '',
      filename: `${ROOT}packages/core/test/unit/number.test.ts`,
      errors: [{ messageId: 'noSource', data: { source: 'src/number.ts or src/number.vue' } }],
    },
    {
      name: 'a source file without its test',
      code: '',
      filename: `${ROOT}packages/core/src/missing.utils.ts`,
      errors: [{ messageId: 'noTest', data: { test: 'test/unit/missing.utils.test.ts or test/unit/missing.utils.spec.ts' } }],
    },
  ],
});
