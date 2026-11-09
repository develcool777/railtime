import { RuleTester } from '@typescript-eslint/rule-tester';
import { fileURLToPath } from 'node:url';
import tseslint from 'typescript-eslint';
import { afterAll, describe, test } from 'vitest';
import vueParser from 'vue-eslint-parser';
import { brandedRecordKeys, brandedSpreadKey, checkedIds, servedFiles } from '../../../src/lint/idRules.utils';

// The rule tester runs its cases as Vitest's tests.
RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = test;

/**
 * Each case's code is a file of its own, outside every tsconfig, read with this package's options
 * (strict, as all the code is): the rules need its types.
 */
const tester = new RuleTester({
  languageOptions: {
    parserOptions: {
      projectService: { allowDefaultProject: ['*.ts', '*.vue'], defaultProject: 'tsconfig.json' },
      tsconfigRootDir: fileURLToPath(new URL('../../..', import.meta.url)),
      extraFileExtensions: ['.vue'],
    },
  },
});

/** Two brands, as `@railtime/core/brand.types` makes them, and things to try them on. */
const BRANDS = `
declare const brand: unique symbol;
type Brand<Base, Name extends string> = Base & { readonly [brand]: Name };
type StationId = Brand<string, 'StationId'>;
type LineId = Brand<string, 'LineId'>;
declare const text: string;
declare const maybe: StationId | undefined;
declare const id: StationId;
declare const stations: Record<StationId, number>;
declare const names: Record<string, string>;
`;

/**
 * A case's code: the brands, then what it tries.
 *
 * @param code - What it tries.
 * @returns The file.
 */
const withBrands = (code: string): string => `${BRANDS}\n${code}`;

/** A city's files' types, and things to try them on. */
const FILES = `
type Network = { stations: Record<string, number> };
type CityBoundary = { name: string };
type Summary = { name: string };
declare const json: unknown;
declare const useFetch: <Data>(url: string) => Data;
declare const elsewhere: <Data>(url: string) => Data;
`;

/** Each case is a component of its own, read as ESLint reads one: its script's types, its template parsed apart. */
const vueTester = new RuleTester({
  languageOptions: {
    parser: vueParser,
    parserOptions: {
      parser: tseslint.parser,
      projectService: { allowDefaultProject: ['*.ts', '*.vue'], defaultProject: 'tsconfig.json' },
      tsconfigRootDir: fileURLToPath(new URL('../../..', import.meta.url)),
      extraFileExtensions: ['.vue'],
    },
  },
});

/**
 * A component whose template handles an event with an expression.
 *
 * @param expression - The expression.
 * @returns The component's case: its code, as a `.vue` file.
 */
const component = (expression: string) => ({
  filename: 'file.vue',
  name: expression,
  code: `<template><button @click="handle(${expression})">Go</button></template>
<script setup lang="ts">
${BRANDS}
type Network = { stations: Record<string, number> };
type Summary = { name: string };
declare const handle: (value: unknown) => void;
</script>`,
});

describe('IdRules', () => {
  describe('checkedIds in a template', () => {
    vueTester.run('checked-ids', checkedIds, {
      valid: [component('$event as string'), component('$event as Summary'), component('$event')],
      invalid: [
        { ...component('$event as StationId'), errors: [{ messageId: 'asserted' }] },
        { ...component('$event as LineId[]'), errors: [{ messageId: 'asserted' }] },
        { ...component('$event as Map<StationId, number>'), errors: [{ messageId: 'asserted' }] },
      ],
    });
  });

  describe('servedFiles in a template', () => {
    vueTester.run('served-files', servedFiles, {
      valid: [component('$event as Summary')],
      invalid: [{ ...component('$event as Network'), errors: [{ messageId: 'asserted' }] }],
    });
  });

  describe('servedFiles', () => {
    tester.run('served-files', servedFiles, {
      valid: [
        { name: 'another type', code: `${FILES}\nconst summary = json as Summary;` },
        { name: 'a fetch told another type', code: `${FILES}\nconst summary = useFetch<Summary>('/summary');` },
        { name: 'a type argument that is no fetch', code: `${FILES}\nconst network = elsewhere<Network>('/network');` },
        { name: 'its type written, not asserted', code: `${FILES}\ndeclare const network: Network;\nconst same: Network = network;` },
      ],
      invalid: [
        { name: 'a network asserted', code: `${FILES}\nconst network = json as Network;`, errors: [{ messageId: 'asserted' }] },
        { name: 'an outline asserted', code: `${FILES}\nconst outline = <CityBoundary>json;`, errors: [{ messageId: 'asserted' }] },
        { name: 'one or nothing, asserted', code: `${FILES}\nconst outline = json as CityBoundary | null;`, errors: [{ messageId: 'asserted' }] },
        { name: 'a fetch told a network', code: `${FILES}\nconst network = useFetch<Network>('/network');`, errors: [{ messageId: 'asserted' }] },
      ],
    });
  });

  describe('checkedIds', () => {
    tester.run('checked-ids', checkedIds, {
      valid: [
        // Already an id: the assertion only narrows.
        withBrands('const narrowed = maybe as StationId;'),
        withBrands('const plain = text as string;'),
        withBrands('const list = [text] as string[];'),
        withBrands('const fixed = { kind: "x" } as const;'),
      ],
      invalid: [
        { name: 'const made = text as StationId;', code: withBrands('const made = text as StationId;'), errors: [{ messageId: 'asserted' }] },
        { name: 'const made = <LineId>text;', code: withBrands('const made = <LineId>text;'), errors: [{ messageId: 'asserted' }] },
        { name: 'const made = text as StationId | null;', code: withBrands('const made = text as StationId | null;'), errors: [{ messageId: 'asserted' }] },
        { name: 'const made = [text] as StationId[];', code: withBrands('const made = [text] as StationId[];'), errors: [{ messageId: 'asserted' }] },
        {
          name: 'const made = new Map() as Map<StationId, number>;',
          code: withBrands('const made = new Map() as Map<StationId, number>;'),
          errors: [{ messageId: 'asserted' }],
        },
        {
          name: 'const made = names as Record<LineId, string>;',
          code: withBrands('const made = names as Record<LineId, string>;'),
          errors: [{ messageId: 'asserted' }],
        },
      ],
    });
  });

  describe('brandedSpreadKey', () => {
    tester.run('branded-spread-key', brandedSpreadKey, {
      valid: [
        withBrands('const copy = { ...stations };'),
        withBrands('const more = { ...names, other: "x" };'),
        // With no spread, TypeScript checks the value.
        withBrands('const one = { [id]: 1 };'),
        withBrands('const key = "a" as string; const more = { ...names, [key]: "x" };'),
      ],
      invalid: [
        { name: 'const more = { ...stations, [id]: 2 };', code: withBrands('const more = { ...stations, [id]: 2 };'), errors: [{ messageId: 'unchecked' }] },
      ],
    });
  });

  describe('brandedRecordKeys', () => {
    tester.run('branded-record-keys', brandedRecordKeys, {
      valid: [
        withBrands('const keys = Object.keys(names);'),
        withBrands('const entries = Object.entries({ a: 1 });'),
        withBrands('const made = Object.fromEntries([["a", 1]]);'),
        withBrands('const values = Object.values(stations);'),
      ],
      invalid: [
        {
          name: 'const keys = Object.keys(stations);',
          code: withBrands('const keys = Object.keys(stations);'),
          errors: [{ messageId: 'untyped', data: { name: 'keys', helper: 'keysOf' } }],
        },
        {
          name: 'const entries = Object.entries(infill ?? {});',
          code: withBrands('declare const infill: Record<LineId, string> | undefined;\nconst entries = Object.entries(infill ?? {});'),
          errors: [{ messageId: 'untyped', data: { name: 'entries', helper: 'entriesOf' } }],
        },
        {
          name: 'const made = Object.fromEntries(pairs);',
          code: withBrands('declare const pairs: [StationId, number][];\nconst made = Object.fromEntries(pairs);'),
          errors: [{ messageId: 'untyped', data: { name: 'fromEntries', helper: 'fromEntriesOf' } }],
        },
      ],
    });
  });
});
