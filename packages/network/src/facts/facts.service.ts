import { entriesOf, keysOf } from '@railtime/core/collection.utils';
import { todayTimestamp, yearOf } from '@railtime/core/date.utils';
import { required } from '@railtime/core/required.utils';
import type { CityBoundary } from '@railtime/schema/boundary.types';
import { isLineIn, isPlanIn, isStationIn } from '@railtime/schema/ids.utils';
import type { LineId, Network, PlanId, StationId } from '@railtime/schema/network.types';
import { buildPlan } from '@railtime/schema/plan.utils';
import type {
  ChangeInfo,
  LineColor,
  LineInfo,
  LineSketch,
  NetworkFactsOptions,
  NetworkGrowth,
  Playhead,
  NetworkChoice,
  NetworkSummary,
  PlanInfo,
  Stop,
} from './facts.types';
import { lineInfoOf, planFacts, sketchOf } from './facts.utils.ts';
import { FactsAt } from './moment.service.ts';
import type { MomentSource } from './moment.types';
import type { ShownNetwork } from './networks.types';
import { firstPlanOf, isPlanOnly, linesHiddenAtFirst, linesNamed, networkChoicesOf, withLinesHidden } from './networks.utils.ts';
import { CoverageMeasure } from '../coverage/coverage.service.ts';
import { captionOf } from '../engine/caption.utils.ts';
import { ENGINE } from '../engine/engine.constants.ts';
import { NetworkEngine } from '../engine/engine.service.ts';
import type { NetworkHistory } from '../engine/history.types';
import { busiestDecade, networkAt, networkHistory, openingsByDecade } from '../engine/history.utils.ts';
import type { NetworkIndex } from '../engine/index.service';
import type { Timeline } from '../engine/timeline.service';
import { RouteFinder } from '../route/finder.service.ts';

/**
 * A city's network, its history and its plans, and every fact about them: what it is and was on any
 * date, what a plan would add, how it sums up. Pure: no map, no clock. Made once, from the network as
 * stored, and asked by the map, the app, the data commands and the tests; nothing else works a fact
 * out. A line's colour comes in both themes (`LineColor`): what shows it picks one.
 */
export class NetworkFacts {
  /** The plan built on the network, if one was asked for. */
  public readonly plan: PlanId | null;
  /** The lines hidden, in the network's order: as if they were not there. */
  public readonly hidden: LineId[];
  /** Whether the network was never built: it has only its plans. */
  public readonly planOnly: boolean;
  /** The raw network through time, which every answer comes from: what the renderer plays and draws, by the fenced `engineOf`. */
  public readonly [ENGINE]: NetworkEngine;
  /** The timeline's first date, its end (today, or a dated step after it) and today, as timestamps. A plan's changes play at `end`. */
  public readonly range: { start: number; end: number; today: number };
  /** Where in its history the map can be: on a day, after or before a change, today, at the end. */
  public readonly playheads: NetworkEngine['playheads'];
  /** The network, indexed. */
  private readonly index: NetworkIndex;
  /** Its history as steps. */
  private readonly timeline: Timeline;
  /** What the answers at a moment draw on. */
  private readonly moments: MomentSource;
  /** The year the history runs to. */
  private readonly thisYear: number;
  /** The network year by year, worked out the first time it is asked for: it does not change. */
  private history: NetworkHistory | null = null;
  /** Each outline's coverage, measured the first time it is asked for. */
  private readonly coverages = new WeakMap<CityBoundary, CoverageMeasure>();
  /** The network as shown, its plans unbuilt, and the years its lines are out. */
  private readonly shown: ShownNetwork;
  /** The network as stored, every line in it. */
  private readonly stored: Network;

  private constructor(stored: Network, hidden: LineId[], plan: PlanId | null, today: number) {
    this.stored = stored;
    this.hidden = hidden;
    this.shown = withLinesHidden(stored, hidden);
    // A plan building on a line hidden goes with it: the network is shown as built.
    this.plan = plan !== null && this.shown.network.plans?.[plan] ? plan : null;
    this.planOnly = isPlanOnly(this.shown.network);
    const engine = new NetworkEngine(this.shown.network, this.plan, today, this.shown.gaps);
    this[ENGINE] = engine;
    this.index = engine.index;
    this.timeline = engine.timeline;
    this.range = engine.range;
    this.playheads = engine.playheads;
    this.moments = {
      index: this.index,
      timeline: this.timeline,
      playheads: this.playheads,
      finder: new RouteFinder(this.index, this.timeline),
      statsAt: cursor => engine.statsAt(cursor),
      trains: cursor => engine.trainService(cursor),
      firstYears: () => this.networkHistory().firstYears,
    };
    this.thisYear = yearOf(today);
  }

  /**
   * A network's facts.
   *
   * @param network - The network, as stored.
   * @param options - A plan to build on it, its lines hidden, and today.
   * @returns Its facts.
   */
  public static create(network: Network, options: NetworkFactsOptions = {}): NetworkFacts {
    const hidden = options.hidden ? linesNamed(network, options.hidden) : linesHiddenAtFirst(network);
    return new NetworkFacts(network, hidden, options.plan ?? null, options.today ?? todayTimestamp());
  }

  /**
   * Each network with the lines a person may show or hide, hidden ones too.
   *
   * @returns Each, in the network's order.
   */
  public networkChoices(): NetworkChoice[] {
    return networkChoicesOf(this.stored, this.hidden);
  }

  /**
   * The plan a city opens on, before its facts are made with it: the one asked for, if it has it;
   * else, for a network never built, its first.
   *
   * @param network - The network, as stored.
   * @param asked - The plan an address names, if any.
   * @returns The plan's id, or none.
   */
  public static planToOpen(network: Network, asked: unknown): PlanId | undefined {
    if (typeof asked === 'string' && isPlanIn(network, asked)) return asked;
    return isPlanOnly(network) ? firstPlanOf(network) : undefined;
  }

  /**
   * The network at a glance, for a picture of it: each line's track today, or a network never
   * built, its first plan's, dashed.
   *
   * @returns The track by line, bottom first.
   */
  public sketch(): LineSketch[] {
    const { engine, cursor } = this.asBuilt();
    return sketchOf(engine.index, engine.timeline, cursor, this.planOnly);
  }

  /**
   * How the network sums up, for a list of cities: as `today()` counts it, one never built by its
   * first plan. Whichever plan is built, the network shown.
   *
   * @returns Its summary.
   */
  public summary(): NetworkSummary {
    const { network } = this.shown;
    const { engine, cursor } = this.asBuilt();
    const { lines, stations } = engine.statsAt(cursor);
    const opening = this.timeline.steps.find(step => step.kind === 'open' && !step.planned);
    return {
      networks: Object.values(network.networks).map(brand => brand.name),
      openedYear: opening ? yearOf(opening.time) : null,
      planOnly: this.planOnly,
      plans: keysOf(network.plans ?? {}).length,
      lines,
      stations,
    };
  }

  /**
   * Every plan the city has, and what each would add to the network as built.
   *
   * @returns The plans, in the network's order.
   */
  public plans(): PlanInfo[] {
    const { network } = this.shown;
    const { stations } = networkAt(this.index, this.timeline, this.playheads.today().cursor);
    return entriesOf(network.plans ?? {}).map(([id, plan]) => ({
      id,
      name: plan.name,
      status: plan.status,
      ...(plan.description && { description: plan.description }),
      facts: planFacts(plan, buildPlan(network, id), stations),
    }));
  }

  /**
   * A line by a string that may be its id, if the network has it (its plan built on it): where an
   * address's line becomes one.
   *
   * @param id - The string.
   * @returns The line's id and name, or `null`.
   */
  public findLine(id: string): { id: LineId; name: string } | null {
    return isLineIn(this.index.network, id) ? { id, name: this.index.lineOf(id).name } : null;
  }

  /**
   * A station by a string that may be its id, if the network has it (its plan built on it): where an
   * address's station becomes one.
   *
   * @param id - The string.
   * @returns The station's id and name, or `null`.
   */
  public findStation(id: string): Stop | null {
    return isStationIn(this.index.network, id) ? { id, name: this.index.stationOf(id).name } : null;
  }

  /**
   * A station by a string that may be its id, among what the city has whatever is hidden now: what a
   * link may name and be kept by, though the network shown has it only once its line shows.
   *
   * @param id - The string.
   * @returns Its id, or `null`.
   */
  public stationOfCity(id: string): StationId | null {
    return isStationIn(this.stored, id) || isStationIn(this.index.network, id) ? id : null;
  }

  /**
   * A line's own colour, in each theme.
   *
   * @param line - The line id.
   * @returns Its colours.
   */
  public colorOf(line: LineId): LineColor {
    return this.index.colorOf(line);
  }

  /**
   * Every line a user can toggle.
   *
   * @returns The lines, in the network's order.
   */
  public lines(): LineInfo[] {
    return this.index.lineIds.map(id => lineInfoOf(this.index, id));
  }

  /**
   * Every change in the history, planned ones last, described as its caption will be when it plays.
   *
   * @returns The changes, in the order they play.
   */
  public changes(): ChangeInfo[] {
    return this.timeline.steps.map(step => this.change(step.index));
  }

  /**
   * One change, described as its caption says it.
   *
   * @param index - Its place in the history (`ChangeInfo.index`).
   * @returns The change.
   */
  public change(index: number): ChangeInfo {
    const step = required(this.timeline.steps[index], `change ${index}`);
    return { index, ...captionOf(step, { index: this.index, timeline: this.timeline }) };
  }

  /**
   * The network year by year up to this one, how many stations opened in each decade, and the busiest.
   *
   * @returns Its growth.
   */
  public growth(): NetworkGrowth {
    const { years, firstYears } = this.networkHistory();
    const decades = openingsByDecade(firstYears);
    return { years, decades, busiest: busiestDecade(decades) };
  }

  /**
   * Whether the network has a history to show: some year with a station on the map. One never built
   * has only its plans.
   *
   * @returns True if any year has a station.
   */
  public hasHistory(): boolean {
    return this.growth().years.some(year => year.stations > 0);
  }

  /**
   * The network today, for the questions about it now: every dated change on or before today played.
   *
   * @returns The questions, each answered for today.
   */
  public today(): FactsAt {
    return this.asOf(this.playheads.today());
  }

  /**
   * The network at a moment, for the questions about it then.
   *
   * @param moment - The moment: the map's `time`.
   * @returns The questions, each answered for that moment.
   */
  public asOf(moment: Playhead): FactsAt {
    return new FactsAt(this.moments, moment);
  }

  /**
   * How much of a city is near a station, within its outline: on any date, and year by year.
   *
   * @param boundary - The city's outline.
   * @returns Its coverage, measured once per outline.
   */
  public coverage(boundary: CityBoundary): CoverageMeasure {
    const known = this.coverages.get(boundary);
    if (known) return known;
    const measure = new CoverageMeasure(boundary, this.index, this.timeline, this.range.today);
    this.coverages.set(boundary, measure);
    return measure;
  }

  /**
   * The network as a sum or a picture takes it: today, or a network never built, its first plan whole.
   *
   * @returns The engine to ask, and the cursor to ask at.
   */
  private asBuilt(): { engine: NetworkEngine; cursor: number } {
    const first = this.planOnly ? firstPlanOf(this.shown.network) : undefined;
    if (first === undefined) return { engine: this[ENGINE], cursor: this.playheads.today().cursor };
    const engine = first === this.plan ? this[ENGINE] : new NetworkEngine(this.shown.network, first, this.range.today, this.shown.gaps);
    return { engine, cursor: engine.timeline.steps.length };
  }

  /**
   * The network year by year, worked out once.
   *
   * @returns Its history up to this year.
   */
  private networkHistory(): NetworkHistory {
    this.history ??= networkHistory(this.index, this.timeline, this.thisYear);
    return this.history;
  }
}
