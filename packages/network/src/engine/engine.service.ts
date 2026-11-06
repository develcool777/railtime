import type { LineId, Network, PlanId } from '@railtime/schema/network.types';
import { buildPlan } from '@railtime/schema/plan.utils';
import type { LineGap } from './engine.types';
import { statsAt } from './history.utils.ts';
import { NetworkIndex } from './index.service.ts';
import { Playheads } from './playheads.service.ts';
import { Timeline } from './timeline.service.ts';
import type { NetworkStats } from '../facts/facts.types';
import { trainRunsAt } from '../trains/routes.utils.ts';
import { TrainService } from '../trains/trains.service.ts';

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
  /** The timeline's first date, its end (today, or a dated step after it) and today, as timestamps. A plan's changes play at `end`. */
  public readonly range: { start: number; end: number; today: number };
  /** Where in its history the map can be, and the rules of it: what the player seeks and runs its clock to. */
  public readonly playheads: Playheads;

  /**
   * @param network - The network: with its lines hidden left out (`withLinesHidden`).
   * @param plan - One of its plans to build on it, or none.
   * @param today - Today, as a timestamp.
   * @param gaps - The stretches of time each line is left out: the years it was drawn as a line hidden.
   */
  public constructor(network: Network, plan: PlanId | null, today: number, gaps: ReadonlyMap<LineId, readonly LineGap[]> = new Map()) {
    const built = plan ? buildPlan(network, plan) : null;
    this.index = new NetworkIndex(built?.network ?? network, built?.sections, gaps);
    this.timeline = new Timeline(this.index);
    this.range = { start: this.timeline.start, end: Math.max(today, this.timeline.lastDate), today };
    this.playheads = new Playheads(this.timeline, this.range);
  }

  /**
   * The network's size at a cursor: what the renderer counts a change towards as it draws it.
   *
   * @param cursor - The cursor.
   * @returns Its stations, km of track and lines.
   */
  public statsAt(cursor: number): NetworkStats {
    return statsAt(this.index, this.timeline, cursor);
  }

  /**
   * The trains the network runs at a moment.
   *
   * @param cursor - The cursor: the track open then.
   * @returns Its trains.
   */
  public trainService(cursor: number): TrainService {
    return new TrainService(trainRunsAt(this.index, this.timeline, cursor));
  }
}
