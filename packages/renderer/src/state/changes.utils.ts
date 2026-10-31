import type { MapState } from '../transitMap.types';

/**
 * Whether two values of the map's state say the same: alike in every part, whatever the order of an
 * object's keys. An array's order counts.
 *
 * @param first - One value.
 * @param second - The other.
 * @returns True if they do.
 */
const sameValue = (first: unknown, second: unknown): boolean => {
  if (first === second) return true;
  if (typeof first !== 'object' || typeof second !== 'object' || first === null || second === null) return false;
  if (Array.isArray(first) !== Array.isArray(second)) return false;
  const firstEntries = Object.entries(first);
  const secondRecord = second as Record<string, unknown>;
  return firstEntries.length === Object.keys(second).length && firstEntries.every(([key, value]) => key in secondRecord && sameValue(value, secondRecord[key]));
};

/**
 * What a new state changes of the one the map has: only the parts it gives that differ, so the map acts
 * on those alone however often it is given the same.
 *
 * @param current - The state the map has.
 * @param next - The state it is given, whole or in part.
 * @returns The parts that change.
 */
export const stateChanges = (current: MapState, next: Partial<MapState>): Partial<MapState> =>
  Object.fromEntries(Object.entries(next).filter(([key, value]) => value !== undefined && !sameValue(current[key as keyof MapState], value)));
