/**
 * Adds a value to the list stored under a key.
 *
 * @param map - Lists by key.
 * @param key - Where to add.
 * @param value - What to add.
 */
export const pushTo = <Key, Value>(map: Map<Key, Value[]>, key: Key, value: Value): void => {
  const list = map.get(key) ?? [];
  list.push(value);
  map.set(key, list);
};

/**
 * A sort's comparisons, in order of weight: the first that tells two apart decides, as `a - b || …`
 * would, but with each a number compared, never one taken for true or false.
 *
 * @param comparisons - Each comparison, the weightiest first.
 * @returns The first that is not zero; zero when none tells them apart.
 */
export const firstDifference = (...comparisons: number[]): number => comparisons.find(comparison => comparison !== 0) ?? 0;

/**
 * A record's keys, typed as its keys: `Object.keys` types every key `string`, losing a brand.
 *
 * @param record - The record.
 * @returns Its own keys.
 */
export const keysOf = <Key extends string, Value>(record: Partial<Record<Key, Value>>): Key[] => Object.keys(record) as Key[];

/**
 * A record's entries, each key typed as its keys: `Object.entries` types every key `string`, losing a brand.
 *
 * @param record - The record.
 * @returns Its own keys, each with its value.
 */
export const entriesOf = <Key extends string, Value>(record: Partial<Record<Key, Value>>): [Key, Value][] => Object.entries(record) as [Key, Value][];

/**
 * A record from its entries, keyed as they are: `Object.fromEntries` keys every one `string`, losing a brand.
 *
 * @param entries - Each key with its value.
 * @returns The record.
 */
export const fromEntriesOf = <Key extends string, Value>(entries: Iterable<readonly [Key, Value]>): Record<Key, Value> =>
  Object.fromEntries(entries) as Record<Key, Value>;
