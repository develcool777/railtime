import type { MapProps } from '../transitMap.types';
import { stateChanges } from './reconciler.utils';

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
   * Takes the props, whole or in part, and runs the effect of each that changed, if the map is ready.
   *
   * @param next - The props.
   */
  public update(next: Partial<MapProps>): void {
    const changes = stateChanges(this.props, next);
    this.props = { ...this.props, ...changes };
    if (this.live) for (const key of Object.keys(changes) as (keyof MapProps)[]) this.effects[key]();
  }

  /** The map is ready: runs every effect once, in the props' order, and each again as its prop changes. */
  public start(): void {
    this.live = true;
    for (const key of Object.keys(this.props) as (keyof MapProps)[]) this.effects[key]();
  }
}
