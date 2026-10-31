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
