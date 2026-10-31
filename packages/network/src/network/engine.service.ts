import type { Network } from '@railtime/schema/network.types';
import { buildPlan } from '@railtime/schema/plan.utils';
import { NetworkIndex } from './index.service';
import { Timeline } from './timeline.service';

/**
 * The raw network through time, as the renderer plays and draws it: its track and stations indexed
 * (`index`), its history as steps (`timeline`, each opening's growth with them), and the dates it
 * runs between. `NetworkFacts` makes one and answers every question from it; the app never touches
 * it (ESLint).
 */
export class NetworkEngine {
  /** The network, indexed: its plan built on it, if one was asked for. */
  public readonly index: NetworkIndex;
  /** Its history as steps, planned ones last. */
  public readonly timeline: Timeline;
  /** The timeline's first date, its end (today, or a dated step after it) and today, as timestamps. A plan's future plays at `end`. */
  public readonly range: { start: number; end: number; today: number };

  public constructor(network: Network, plan: string | null, today: number) {
    const built = plan ? buildPlan(network, plan) : null;
    this.index = new NetworkIndex(built?.network ?? network, built?.sections);
    this.timeline = new Timeline(this.index);
    this.range = { start: this.timeline.start, end: Math.max(today, this.timeline.lastDate), today };
  }
}
