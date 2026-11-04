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
