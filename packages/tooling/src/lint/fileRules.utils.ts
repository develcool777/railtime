import { existsSync } from 'node:fs';
import { createRule } from './rule.utils.ts';

/** Where a package's tests sit, beside its code: `test/unit/` mirrors `src/`. */
const TESTS = '/test/unit/';

/** Where a package's code sits. */
const SOURCES = '/src/';

/** What a test is called after the name of the file it tests: run in node, or in happy-dom. */
const TEST_ENDINGS = ['.test.ts', '.spec.ts'];

/** What a source file a test is named for may be: code, or a component. */
const SOURCE_ENDINGS = ['.ts', '.vue'];

/**
 * A file's place in its package: the package's folder, and the file's path past the folder named.
 *
 * @param filename - The file, its whole path.
 * @param folder - The folder its package keeps it in.
 * @returns The package's folder and the rest; `null` for a file not in such a folder.
 */
const placeIn = (filename: string, folder: string): { root: string; path: string } | null => {
  const whole = filename.replaceAll('\\', '/');
  const start = whole.lastIndexOf(folder);
  if (start === -1) return null;
  return { root: whole.slice(0, start), path: whole.slice(start + folder.length) };
};

/**
 * A file's name without how it ends.
 *
 * @param path - The file.
 * @param endings - What it may end with.
 * @returns The rest.
 */
const withoutEnding = (path: string, endings: readonly string[]): string => {
  const ending = endings.find(each => path.endsWith(each));
  return ending ? path.slice(0, -ending.length) : path;
};

/**
 * The file a test is named for: `test/unit/<path>.<role>.test.ts` tests `src/<path>.<role>.ts`, its
 * name whole, suffix and all (`trains.service.test.ts` tests `trains.service.ts`, and
 * `trains.utils.test.ts` its utils), as dataroom-ui's tests are named.
 *
 * @param path - The test, past `test/unit/`.
 * @returns The source files it may be named for, from the package's folder.
 */
const sourcesFor = (path: string): string[] => SOURCE_ENDINGS.map(ending => `${SOURCES.slice(1)}${withoutEnding(path, TEST_ENDINGS)}${ending}`);

/**
 * The tests a source file may have: `src/<path>.ts` is tested in `test/unit/<path>.test.ts`, or in
 * `.spec.ts` where it makes elements of its own.
 *
 * @param path - The source file, past `src/`.
 * @returns The tests it may have, from the package's folder.
 */
const testsFor = (path: string): string[] => TEST_ENDINGS.map(ending => `${TESTS.slice(1)}${withoutEnding(path, SOURCE_ENDINGS)}${ending}`);

/**
 * A test and the file it tests are named for each other, so each is found from the other: a test in
 * `test/unit/` is named for a source file that is there, and a source file this rule is turned on for
 * (each service, utils and store) has its test. A rename or a delete that leaves either behind is caught.
 */
export const mirroredTests = createRule({
  name: 'mirrored-tests',
  meta: {
    type: 'problem',
    docs: { description: 'A test is named for the source file it tests, and a source file has its test.' },
    messages: {
      noSource: 'A test is named for the file it tests, suffix and all: there is no {{source}}.',
      noTest: 'Each service, utils and store file has its test, named for it: there is no {{test}}.',
    },
    schema: [],
    defaultOptions: [],
  },
  create: context => ({
    Program: node => {
      const test = placeIn(context.filename, TESTS);
      if (test) {
        const sources = sourcesFor(test.path);
        if (sources.every(source => !existsSync(`${test.root}/${source}`)))
          context.report({ node, messageId: 'noSource', data: { source: sources.join(' or ') } });
        return;
      }
      const source = placeIn(context.filename, SOURCES);
      if (!source) return;
      const tests = testsFor(source.path);
      if (tests.every(each => !existsSync(`${source.root}/${each}`))) context.report({ node, messageId: 'noTest', data: { test: tests.join(' or ') } });
    },
  }),
});

/** The rules about files: a test and its source named for each other. */
export const FILE_RULES = { 'mirrored-tests': mirroredTests };
