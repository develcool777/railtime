import { RuleTester } from '@typescript-eslint/rule-tester';
import { afterAll, describe, test } from 'vitest';
import { storeReturnsState, storeShape } from '../../../src/lint/storeRules.utils';

// The rule tester runs its cases as Vitest's tests.
RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = test;

/** The rule reads only the code: no types. */
const tester = new RuleTester();

/** What a store file imports, as every one does. */
const IMPORTS = `
declare const defineStore: (id: string, setup: () => object) => unknown;
declare const ref: <Value>(value: Value) => { value: Value };
declare const shallowRef: <Value>(value: Value) => { value: Value };
declare const reactive: <Value extends object>(value: Value) => Value;
declare const computed: <Value>(getter: () => Value) => { readonly value: Value };
`;

tester.run('store-returns-state', storeReturnsState, {
  valid: [
    {
      name: 'every state returned, shorthand or by another name',
      code: `${IMPORTS}
        export const useClock = defineStore('clock', () => {
          const now = ref(0);
          const map = shallowRef<object | null>(null);
          const later = computed(() => now.value + 1);
          const TICK = (next: number) => { now.value = next; };
          return { now, held: map, later, TICK };
        });`,
    },
    {
      name: 'a getter or a helper need not be returned',
      code: `${IMPORTS}
        export const useClock = defineStore('clock', () => {
          const now = ref(0);
          const doubled = computed(() => now.value * 2);
          const format = (value: number) => String(value);
          return { now, label: computed(() => format(doubled.value)) };
        });`,
    },
    {
      name: 'a ref outside a store, or in a function inside one',
      code: `${IMPORTS}
        const loose = ref(0);
        export const useClock = defineStore('clock', () => {
          const now = ref(0);
          const RESET = () => { const scratch = ref(0); now.value = scratch.value; };
          return { now, RESET };
        });`,
    },
  ],
  invalid: [
    {
      name: 'a ref, a shallow ref and a reactive left out',
      code: `${IMPORTS}
        export const useVideo = defineStore('video', () => {
          const scene = ref('loading');
          const size = ref({ width: 0, height: 0 });
          const map = shallowRef<object | null>(null);
          const seen = reactive({ title: false });
          return { scene };
        });`,
      errors: [
        { messageId: 'unreturned', data: { name: 'size' } },
        { messageId: 'unreturned', data: { name: 'map' } },
        { messageId: 'unreturned', data: { name: 'seen' } },
      ],
    },
  ],
});

/**
 * A store with this body.
 *
 * @param body - What its setup holds.
 * @returns The file.
 */
const storeOf = (body: string): string => `${IMPORTS}\nexport const useClock = defineStore('clock', () => {\n${body}\n});`;

tester.run('store-shape', storeShape, {
  valid: [
    {
      name: 'every part under its heading, in order, and returned so',
      code: storeOf(`
        const other = useOther();
        // ---- State
        const now = ref(0);
        // ---- Getters
        const later = computed(() => now.value + 1);
        // ---- Actions
        const helper = () => now.value;
        const SET_TIME = (next: number) => { now.value = next + helper(); };
        return { now, later, SET_TIME };`),
    },
    {
      name: 'a store of getters only',
      code: storeOf(`
        // ---- Getters
        const later = computed(() => 1);
        return { later };`),
    },
    {
      name: 'a helper it keeps to itself is no action',
      code: storeOf(`
        // ---- Getters
        const nameOf = (id: string) => id;
        const later = computed(() => nameOf('a'));
        return { later };`),
    },
    { name: 'not a setup store', code: `${IMPORTS}\nexport const useClock = defineStore('clock', { state: () => ({}) } as never);` },
  ],
  invalid: [
    {
      name: 'a function returned in lower case',
      code: storeOf(`
        // ---- Actions
        const setTime = () => {};
        return { setTime };`),
      errors: [{ messageId: 'action', data: { name: 'setTime' } }],
    },
    {
      name: 'headings out of order',
      code: storeOf(`
        // ---- Getters
        const later = computed(() => 1);
        // ---- State
        const now = ref(0);
        return { now, later };`),
      errors: [{ messageId: 'headings', data: { section: 'State' } }],
    },
    {
      name: 'a heading twice',
      code: storeOf(`
        // ---- State
        const now = ref(0);
        // ---- State
        const then = ref(0);
        return { now, then };`),
      errors: [{ messageId: 'headings', data: { section: 'State' } }],
    },
    {
      name: 'state without its heading',
      code: storeOf(`
        const now = ref(0);
        return { now };`),
      errors: [{ messageId: 'misplaced', data: { name: 'now', section: 'State' } }],
    },
    {
      name: 'a getter under the actions',
      code: storeOf(`
        // ---- Actions
        const later = computed(() => 1);
        return { later };`),
      errors: [{ messageId: 'misplaced', data: { name: 'later', section: 'Getters' } }],
    },
    {
      name: 'an action among the getters',
      code: storeOf(`
        // ---- Getters
        const SET_TIME = () => {};
        return { SET_TIME };`),
      errors: [{ messageId: 'misplaced', data: { name: 'SET_TIME', section: 'Actions' } }],
    },
    {
      name: 'returned out of order',
      code: storeOf(`
        // ---- State
        const now = ref(0);
        // ---- Actions
        const SET_TIME = () => {};
        return { SET_TIME, now };`),
      errors: [{ messageId: 'returned', data: { name: 'now' } }],
    },
  ],
});
