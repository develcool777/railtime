import type { MapProps, MapPropsUpdate } from '../transitMap.types';

/**
 * Keeps the map's props and acts on them: one effect per prop, run when it changes. Before the map is
 * ready its props are only kept; once it is (`start`), every effect runs, so what came early is drawn
 * as what came late is. Its props are the app's: nothing but `update` changes them.
 */
export class PropsReconciler {
  /** The props as last given. */
  private props: MapProps;
  /** What each prop does once changed; each reads the props it needs from `current`. */
  private readonly effects: Record<keyof MapProps, () => void>;
  /** The map is ready: effects run as props change. */
  private live = false;

  public constructor(initial: MapProps, effects: Record<keyof MapProps, () => void>) {
    this.props = initial;
    this.effects = effects;
  }

  /** The props as last given. */
  public get current(): Readonly<MapProps> {
    return this.props;
  }

  /**
   * Takes the props, whole or in part, and runs the effect of each that changed, if the map is ready:
   * in the props' own order, whatever the order given.
   *
   * @param next - The props.
   */
  public update(next: MapPropsUpdate): void {
    const changes = stateChanges(this.props, next);
    this.props = { ...this.props, ...changes };
    if (!this.live) return;
    for (const key of Object.keys(this.props) as (keyof MapProps)[]) if (key in changes) this.effects[key]();
  }

  /** The map is ready: runs every effect once, in the props' order, and each again as its prop changes. */
  public start(): void {
    this.live = true;
    for (const key of Object.keys(this.props) as (keyof MapProps)[]) this.effects[key]();
  }
}

/**
 * Whether two values of the map's state say the same: alike in every part, whatever the order of an
 * object's keys. An array's order counts. An instance of a class (a network's facts) is the same only
 * as itself: it is never taken apart.
 *
 * @param first - One value.
 * @param second - The other.
 * @returns True if they do.
 */
const sameValue = (first: unknown, second: unknown): boolean => {
  if (first === second) return true;
  if (typeof first !== 'object' || typeof second !== 'object' || first === null || second === null) return false;
  if (Array.isArray(first) !== Array.isArray(second)) return false;
  if (!Array.isArray(first) && (Object.getPrototypeOf(first) !== Object.prototype || Object.getPrototypeOf(second) !== Object.prototype)) return false;
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
export const stateChanges = (current: MapProps, next: MapPropsUpdate): Partial<MapProps> =>
  // A prop given as `undefined` is one not given.
  Object.fromEntries((Object.entries(next) as [keyof MapProps, unknown][]).filter(([key, value]) => value !== undefined && !sameValue(current[key], value)));
