import type { CityBoundary } from '@railtime/schema/boundary.types';
import type { Network } from '@railtime/schema/network.types';
import { firstPlanOf, isPlanOnly } from '@railtime/schema/plan.utils';
import { required } from '@railtime/core/required.utils';
import { todayTimestamp, toIsoDate, toTimestamp, yearOf } from '@railtime/core/date.utils';
import { REACH_BANDS } from './facts.constants.ts';
import { bandOf, networkSummary, planFacts, reachedSegments, recordsOf, sketchOf, trackDatesAt } from './facts.utils.ts';
import { optionalNetworksAsked, optionalNetworksOf, withNetworksShown } from './networks.utils.ts';
import { RouteFinder } from '../route/finder.service.ts';
import type { NetworkHistory } from '../engine/history.types';
import { networkHistory, openingsByDecade, statsAt } from '../engine/history.utils.ts';
import { directionsAt, lineBranches, lineLengthKm, stepChangesLine } from '../engine/lineDetails.utils.ts';
import { CoverageMeasure } from '../coverage/coverage.service.ts';
import type { NetworkIndex } from '../engine/index.service';
import { NetworkEngine } from '../engine/engine.service.ts';
import type { Timeline } from '../engine/timeline.service';
import { captionOf } from '../engine/caption.utils.ts';
import type {
  ChangeInfo,
  FactsAt,
  LineColor,
  LineDetails,
  LineInfo,
  LineSketch,
  NetworkFactsOptions,
  NetworkGrowth,
  NetworkTime,
  OptionalNetworkInfo,
  NetworkRecords,
  NetworkSummary,
  PlanInfo,
  ReachInfo,
  RouteInfo,
  RoutePreference,
  StationInfo,
  StationSummary,
  TransferInfo,
} from './facts.types';

/**
 * A city's network, its history and its plans, and every fact about them: what it is and was on any
 * date, what a plan would add, how it sums up. Pure: no map, no clock. Made once, from the network as
 * stored, and asked by the map, the app, the data commands and the tests; nothing else works a fact
 * out. A line's colour comes in both themes (`LineColor`): what shows it picks one.
 */
export class NetworkFacts {
  /** The plan built on the network, if one was asked for. */
  public readonly plan: string | null;
  /** The optional networks shown, in the network's order; the rest are left off. */
  public readonly networks: string[];
  /** Whether the network was never built: it has only its plans. */
  public readonly planOnly: boolean;
  /** The raw network through time, which every answer comes from: what the renderer plays and draws. */
  public readonly engine: NetworkEngine;
  /** The timeline's first date, its end (today, or a dated step after it) and today, as timestamps. A plan's future plays at `end`. */
  public readonly range: { start: number; end: number; today: number };
  /** The network, indexed. */
  private readonly index: NetworkIndex;
  /** Its history as steps. */
  private readonly timeline: Timeline;
  /** Finds routes, and how far one gets, between its stations. */
  private readonly routes: RouteFinder;
  /** The year the history runs to. */
  private readonly thisYear: number;
  /** The network year by year, worked out the first time it is asked for: it does not change. */
  private history: NetworkHistory | null = null;
  /** Each outline's coverage, measured the first time it is asked for. */
  private readonly coverages = new WeakMap<CityBoundary, CoverageMeasure>();
  /** The network as shown, its plans unbuilt. */
  private readonly source: Network;
  /** The network as stored, every optional network in it. */
  private readonly stored: Network;

  private constructor(stored: Network, networks: string[], plan: string | null, today: number) {
    this.stored = stored;
    this.networks = networks;
    const source = withNetworksShown(stored, networks);
    this.source = source;
    this.plan = plan;
    this.planOnly = isPlanOnly(source);
    this.engine = new NetworkEngine(source, plan, today);
    this.index = this.engine.index;
    this.timeline = this.engine.timeline;
    this.range = this.engine.range;
    this.routes = new RouteFinder(this.index, this.timeline);
    this.thisYear = yearOf(today);
  }

  /**
   * A network's facts.
   *
   * @param network - The network, as stored.
   * @param options - A plan to build on it, its optional networks to show, and today.
   * @returns Its facts.
   */
  public static create(network: Network, options: NetworkFactsOptions = {}): NetworkFacts {
    return new NetworkFacts(network, optionalNetworksAsked(network, options.networks ?? []), options.plan ?? null, options.today ?? todayTimestamp());
  }

  /**
   * The networks the city may show or leave off, each with its lines: shown or not.
   *
   * @returns Each, in the network's order.
   */
  public optionalNetworks(): OptionalNetworkInfo[] {
    return optionalNetworksOf(this.stored, this.networks);
  }

  /**
   * The plan a city opens on, before its facts are made with it: the one asked for, if it has it;
   * else, for a network never built, its first.
   *
   * @param network - The network, as stored.
   * @param asked - The plan an address names, if any.
   * @returns The plan's id, or none.
   */
  public static planToOpen(network: Network, asked: unknown): string | undefined {
    if (typeof asked === 'string' && network.plans?.[asked]) return asked;
    return isPlanOnly(network) ? firstPlanOf(network) : undefined;
  }

  /**
   * The network at a glance, for a picture of it: each line's track today, or a network never
   * built, its first plan's, dashed.
   *
   * @returns The track by line, bottom first.
   */
  public sketch(): LineSketch[] {
    return sketchOf(this.source);
  }

  /**
   * How the network sums up, for a list of cities: one never built by its first plan.
   *
   * @returns Its summary.
   */
  public summary(): NetworkSummary {
    return networkSummary(this.source);
  }

  /**
   * Every plan the city has, and what each would add to the network as built.
   *
   * @returns The plans, in the network's order.
   */
  public plans(): PlanInfo[] {
    return Object.entries(this.source.plans ?? {}).map(([id, plan]) => ({
      id,
      name: plan.name,
      status: plan.status,
      ...(plan.description ? { description: plan.description } : {}),
      facts: planFacts(this.source, id),
    }));
  }

  /**
   * A line or station by its id, if the network has it (its plan built on it).
   *
   * @param kind - A line or a station.
   * @param id - Its id.
   * @returns Its id and name, or `null`.
   */
  public find(kind: 'line' | 'station', id: string): { id: string; name: string } | null {
    const known = kind === 'line' ? this.index.network.lines[id] : this.index.network.stations[id];
    return known ? { id, name: known.name } : null;
  }

  /**
   * A line's own colour, in each theme.
   *
   * @param line - The line id.
   * @returns Its colours.
   */
  public colorOf(line: string): LineColor {
    const info = this.index.lineOf(line);
    return { light: info.color, dark: info.darkColor ?? info.color };
  }

  /**
   * Every line a user can toggle.
   *
   * @returns The lines, in the network's order.
   */
  public lines(): LineInfo[] {
    return this.index.lineIds.map(id => {
      const line = this.index.lineOf(id);
      return {
        id,
        name: line.name,
        network: line.network,
        networkName: required(this.index.network.networks[line.network], `network ${line.network}`).name,
        color: this.colorOf(id),
        opened: Number.isFinite(this.index.lineOpens(id)) ? this.index.lineOpens(id) : null,
      };
    });
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
    return { index, ...captionOf(step, { index: this.index, timeline: this.timeline, colorOf: line => this.colorOf(line) }) };
  }

  /**
   * The network year by year up to this one, and how many stations opened in each decade.
   *
   * @returns Its growth.
   */
  public growth(): NetworkGrowth {
    const { years, firstYears } = this.networkHistory();
    return { years, decades: openingsByDecade(firstYears) };
  }

  /**
   * The moment at the end of a day: every change on it or before has happened.
   *
   * @param day - A timestamp on that day.
   * @returns The moment.
   */
  public momentOn(day: number): NetworkTime {
    return { cursor: this.timeline.cursorAt(day), time: day };
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
    return this.asOf(this.momentOn(this.range.today));
  }

  /**
   * The network at a moment, for the questions about it then.
   *
   * @param moment - The moment: the map's `time`.
   * @returns The questions, each answered for that moment.
   */
  public asOf(moment: NetworkTime): FactsAt {
    return {
      stations: () => this.stationsAt(moment),
      station: id => this.stationAt(id, moment),
      line: id => this.lineAt(id, moment),
      records: count => this.recordsAt(count, moment),
      route: (from, to, preference) => this.routeAt(from, to, preference, moment),
      reach: from => this.reachAt(from, moment),
      stats: () => statsAt(this.index, this.timeline, moment.cursor),
      directions: station =>
        new Map(this.stationAt(station, moment).lines.map(line => [line.id, directionsAt(station, this.lineAt(line.id, moment))] as const)),
    };
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
   * A line at a moment: its stops in order, by branch, how long it is, and the changes that made it.
   *
   * @param line - The line id.
   * @param moment - The moment.
   * @returns The line's details.
   */
  private lineAt(line: string, moment: NetworkTime): LineDetails {
    const info = required(
      this.lines().find(candidate => candidate.id === line),
      `line ${line}`,
    );
    const branches = lineBranches(this.index, this.timeline, line, moment.cursor).map(run =>
      run.map(station => ({ id: station, name: this.index.stationName(station, moment.time) })),
    );
    return {
      ...info,
      stations: new Set(branches.flatMap((run, position) => (position === 0 ? run : run.slice(1))).map(stop => stop.id)).size,
      km: lineLengthKm(this.index, this.timeline, line, moment.cursor),
      branches,
      changes: this.timeline.steps.filter(step => stepChangesLine(step, line)).map(step => step.index),
    };
  }

  /**
   * The best route between two stations at a moment: the lines to ride, where to change, and about
   * how long it takes.
   *
   * @param from - The station to start at.
   * @param to - The station to get to.
   * @param preference - Fastest, or fewer changes.
   * @param moment - The moment.
   * @returns The route, or `null` if the network then has none.
   */
  private routeAt(from: string, to: string, preference: RoutePreference, moment: NetworkTime): RouteInfo | null {
    const route = this.routes.find(from, to, moment.cursor, preference);
    if (!route) return null;
    const stop = (station: string) => ({ id: station, name: this.index.stationName(station, moment.time) });
    return {
      from: stop(from),
      to: stop(to),
      legs: route.legs.map(leg =>
        leg.kind === 'walk'
          ? { kind: 'walk', from: stop(leg.from), to: stop(leg.to), minutes: leg.minutes }
          : {
              kind: 'ride',
              line: leg.line,
              lineName: this.index.lineName(leg.line),
              color: this.colorOf(leg.line),
              stops: leg.stops.map(stop),
              minutes: leg.minutes,
              km: leg.km,
            },
      ),
      minutes: route.minutes,
      km: route.km,
      changes: route.changes,
      segments: route.legs.map(leg => (leg.kind === 'ride' ? leg.segments : [])),
    };
  }

  /**
   * How long it takes to get from a station to every other at a moment, by the fastest routes.
   *
   * @param from - The station to start at.
   * @param moment - The moment.
   * @returns The stations it gets to, soonest first, the bands they are coloured in, and the track it colours; `null` if no line calls there then.
   */
  private reachAt(from: string, moment: NetworkTime): ReachInfo | null {
    const minutes = this.routes.reach(from, moment.cursor);
    if (minutes.size === 0) return null;
    const name = (station: string) => this.index.stationName(station, moment.time);
    // The search reaches stations soonest first, so they come in that order.
    const stations = [...minutes].filter(([station]) => station !== from).map(([id, time]) => ({ id, name: name(id), minutes: time, band: bandOf(time) }));
    // Each open segment once, though several lines run on it.
    const open = new Map(
      this.index.lineSegments
        .filter(lineSegment => this.timeline.isOpen(lineSegment, moment.cursor))
        .map(lineSegment => [lineSegment.segment.index, lineSegment.segment]),
    );
    const track = reachedSegments(minutes, open.values()).map(reached => ({ segment: reached.segment, band: bandOf(reached.minutes) }));
    return { from: { id: from, name: name(from) }, stations, bands: REACH_BANDS, track };
  }

  /**
   * The network's records at a moment: the stations open longest, those most lines call at, and the
   * longest lines.
   *
   * @param count - How many of each.
   * @param moment - The moment.
   * @returns The records.
   */
  private recordsAt(count: number, moment: NetworkTime): NetworkRecords {
    const { firstYears } = this.networkHistory();
    return recordsOf({ index: this.index, timeline: this.timeline, firstYears, colorOf: line => this.colorOf(line) }, count, moment);
  }

  /**
   * The stations on the map at a moment, for a search: each with its names and its lines' colours.
   *
   * @param moment - The moment.
   * @returns The stations a line calls at, by name.
   */
  private stationsAt(moment: NetworkTime): StationSummary[] {
    return (
      [...this.timeline.stationsOnMap(moment.cursor)]
        .map(station => {
          const lines = this.callingAt(station, moment.cursor);
          return {
            id: station,
            name: this.index.stationName(station, moment.time),
            otherNames: this.index.otherNames(this.index.namedAt(station, moment.time)),
            // Lines sharing a colour show it once.
            colors: [...new Map(lines.map(line => this.colorOf(line)).map(color => [`${color.light} ${color.dark}`, color])).values()],
            served: lines.length > 0,
          };
        })
        // A station the track passes but no line calls at is not one to look for.
        .filter(({ served }) => served)
        .map(({ served: _served, ...station }) => station)
        .sort((first, second) => first.name.localeCompare(second.name))
    );
  }

  /**
   * A station's lines, with when each opened there and, if it has, closed: its track, or its calls
   * there while the track stays; its former names by the moment, and its transfers then.
   *
   * @param station - The station id.
   * @param moment - The moment.
   * @returns The station's details.
   */
  private stationAt(station: string, moment: NetworkTime): StationInfo {
    const info = this.index.stationOf(station);
    const lines = [...trackDatesAt(this.index, this.timeline, station).entries()].map(([line, dates]) => {
      // The line stopped calling here, or its track here closed.
      const closed = info.closed?.[line] ?? (dates.allClosed ? toIsoDate(dates.lastClosed) : undefined);
      return {
        id: line,
        name: this.index.lineName(line),
        color: this.colorOf(line),
        // A plan's line has no date: Infinity, from its undated line segments.
        opened: info.infill?.[line] ?? (dates.opened === Infinity ? null : toIsoDate(dates.opened)),
        ...(closed ? { closed } : {}),
      };
    });
    return {
      id: station,
      name: this.index.stationName(station, moment.time),
      otherNames: this.index.otherNames(this.index.namedAt(station, moment.time)),
      // By opening, a plan's undated lines last.
      lines: lines.sort(
        (first, second) => (first.opened === null ? 1 : 0) - (second.opened === null ? 1 : 0) || (first.opened ?? '').localeCompare(second.opened ?? ''),
      ),
      // Only the names it had dropped by the moment.
      formerNames: (info.formerNames ?? [])
        .filter(former => toTimestamp(former.until) <= moment.time)
        .map(former => ({ name: former.name, otherNames: this.index.otherNames(former), until: former.until })),
      transfers: this.transfersFrom(station, moment),
    };
  }

  /**
   * The lines calling at a station at a cursor, each once.
   *
   * @param station - The station id.
   * @param cursor - The cursor.
   * @returns The lines, in side-by-side order.
   */
  private callingAt(station: string, cursor: number): string[] {
    const lines = this.index
      .lineSegmentsAt(station)
      .filter(lineSegment => this.timeline.isOpen(lineSegment, cursor) && this.timeline.servesStation(station, lineSegment.line, cursor))
      .map(lineSegment => lineSegment.line);
    return [...new Set(lines)].sort(this.index.compareLines);
  }

  /**
   * The stations a station changes to at a moment, with their lines then.
   *
   * @param station - The station id.
   * @param moment - The moment.
   * @returns Each one on the map then.
   */
  private transfersFrom(station: string, moment: NetworkTime): TransferInfo[] {
    return this.index.transfersAt(station).flatMap(other => {
      // The lines calling there now, each as it is drawn then (a branch still shown as its parent).
      const calling = this.callingAt(other, moment.cursor).map(line => this.timeline.identityOf(line, moment.cursor).id);
      if (calling.length === 0) return [];
      const ordered = [...new Set(calling)].sort(this.index.compareLines);
      return [
        {
          id: other,
          name: this.index.stationName(other, moment.time),
          lines: ordered.map(line => ({ id: line, name: this.index.lineName(line), color: this.colorOf(line) })),
        },
      ];
    });
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
