import type { CityBoundary } from '@railtime/schema/boundary.types';
import type { Network } from '@railtime/schema/network.types';
import { buildPlan } from '@railtime/schema/plan.utils';
import { required } from '../core/required.utils';
import { toIsoDate, todayTimestamp, toTimestamp } from '../core/date.utils';
import { REACH_BANDS } from '../route/reach.constants';
import { bandOf } from '../route/reach.utils';
import { RouteFinder } from '../route/finder.service';
import type { NetworkHistory } from '../network/history.types';
import { networkAt, networkHistory, openingsByDecade, statsAt } from '../network/history.utils';
import { directionsAt, lineBranches, lineLengthKm, stepChangesLine } from '../network/lineDetails.utils';
import { CoverageMeasure } from '../coverage/measure.service';
import { NetworkIndex } from '../network/index.service';
import { Timeline } from '../network/timeline.service';
import { captionOf } from '../changes/caption.utils';
import type {
  ChangeInfo,
  LineDetails,
  LineInfo,
  NetworkGrowth,
  NetworkRecords,
  ReachInfo,
  RouteInfo,
  RoutePreference,
  StationInfo,
  StationSummary,
  Theme,
  TransferInfo,
} from './facts.types';
import type { NetworkAt, NetworkModelOptions, NetworkMoment, NetworkTime } from './network.types';

/**
 * A network and its history, and every question about it: what it is and was on any date, in either
 * theme's colours. Pure: no map, no clock. Each question takes the moment and the theme it is about,
 * so its answer changes when they do and at no other time. Made before any map, and shared by the map,
 * the app and the tests.
 */
export class NetworkModel {
  /** The network, indexed: its plan built on it, if one was asked for. */
  public readonly index: NetworkIndex;
  /** Its history as steps, planned ones last. */
  public readonly timeline: Timeline;
  /** The timeline's first date, its end (today, or a dated step after it) and today, as timestamps. A plan's future plays at `end`. */
  public readonly range: { start: number; end: number; today: number };
  /** Finds routes, and how far one gets, between its stations. */
  private readonly routes: RouteFinder;
  /** The year the history runs to. */
  private readonly thisYear: number;
  /** The network year by year, worked out the first time it is asked for: it does not change. */
  private history: NetworkHistory | null = null;
  /** Each outline's coverage, measured the first time it is asked for. */
  private readonly coverages = new WeakMap<CityBoundary, CoverageMeasure>();

  private constructor(index: NetworkIndex, today: number) {
    this.index = index;
    this.timeline = new Timeline(index);
    this.range = { start: this.timeline.start, end: Math.max(today, this.timeline.lastDate), today };
    this.routes = new RouteFinder(index, this.timeline);
    this.thisYear = new Date(today).getUTCFullYear();
  }

  /**
   * A network's model.
   *
   * @param network - The network.
   * @param options - A plan to build on it, and today.
   * @returns The model.
   */
  public static create(network: Network, options: NetworkModelOptions = {}): NetworkModel {
    const plan = options.plan ? buildPlan(network, options.plan) : null;
    return new NetworkModel(new NetworkIndex(plan?.network ?? network, plan?.sections), options.today ?? todayTimestamp());
  }

  /**
   * A line's own colour in a theme.
   *
   * @param line - The line id.
   * @param theme - The theme.
   * @returns Its colour.
   */
  public colorOf(line: string, theme: Theme): string {
    const info = this.index.lineOf(line);
    return (theme === 'dark' && info.darkColor) || info.color;
  }

  /**
   * Every line a user can toggle.
   *
   * @param theme - The theme, for their colours.
   * @returns The lines, in the network's order.
   */
  public lines(theme: Theme): LineInfo[] {
    return this.lineInfos(line => this.colorOf(line, theme));
  }

  /**
   * Every change in the history, planned ones last, described as its caption will be when it plays.
   *
   * @param theme - The theme, for their colours.
   * @returns The changes, in the order they play.
   */
  public changes(theme: Theme): ChangeInfo[] {
    return this.timeline.steps.map(step => this.change(step.index, theme));
  }

  /**
   * One change, described as its caption says it.
   *
   * @param index - Its place in the history (`ChangeInfo.index`).
   * @param theme - The theme, for its colour.
   * @returns The change.
   */
  public change(index: number, theme: Theme): ChangeInfo {
    const step = required(this.timeline.steps[index], `change ${index}`);
    return { index, ...captionOf(step, { index: this.index, timeline: this.timeline, colorOf: line => this.colorOf(line, theme) }) };
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
   * The network at a moment, for the questions about it then.
   *
   * @param moment - The moment: the map's `time`.
   * @param theme - The theme, for colours.
   * @returns The questions, each answered for that moment.
   */
  public asOf(moment: NetworkTime, theme: Theme): NetworkAt {
    const then: NetworkMoment = { cursor: moment.cursor, clock: moment.time, colorOf: line => this.colorOf(line, theme) };
    return {
      stations: () => this.stationsAt(then),
      station: id => this.stationAt(id, then),
      line: id => this.lineAt(id, then),
      records: count => this.recordsAt(count, then),
      route: (from, to, preference) => this.routeAt(from, to, preference, then),
      reach: from => this.reachAt(from, then),
      stats: () => statsAt(this.index, this.timeline, moment.cursor),
      directions: station => new Map(this.stationAt(station, then).lines.map(line => [line.id, directionsAt(station, this.lineAt(line.id, then))] as const)),
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
   * Every line a user can toggle, with its colour.
   *
   * @param colorOf - A line's colour in the theme asked for.
   * @returns The lines, in the network's order.
   */
  private lineInfos(colorOf: NetworkMoment['colorOf']): LineInfo[] {
    return this.index.lineIds.map(id => {
      const line = this.index.lineOf(id);
      return {
        id,
        name: line.name,
        network: line.network,
        networkName: required(this.index.network.networks[line.network], `network ${line.network}`).name,
        color: colorOf(id),
        opened: Number.isFinite(this.index.lineOpens(id)) ? this.index.lineOpens(id) : null,
      };
    });
  }

  /**
   * A line at a moment: its stops in order, by branch, how long it is, and the changes that made it.
   *
   * @param line - The line id.
   * @param moment - The moment.
   * @returns The line's details.
   */
  private lineAt(line: string, moment: NetworkMoment): LineDetails {
    const info = required(
      this.lineInfos(moment.colorOf).find(candidate => candidate.id === line),
      `line ${line}`,
    );
    const branches = lineBranches(this.index, this.timeline, line, moment.cursor).map(run =>
      run.map(station => ({ id: station, name: this.index.stationName(station, moment.clock) })),
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
  private routeAt(from: string, to: string, preference: RoutePreference, moment: NetworkMoment): RouteInfo | null {
    const route = this.routes.find(from, to, moment.cursor, preference);
    if (!route) return null;
    const stop = (station: string) => ({ id: station, name: this.index.stationName(station, moment.clock) });
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
              color: moment.colorOf(leg.line),
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
   * @returns The stations it gets to, soonest first, and the bands they are coloured in; `null` if no line calls there then.
   */
  private reachAt(from: string, moment: NetworkMoment): ReachInfo | null {
    const minutes = this.routes.reach(from, moment.cursor);
    if (minutes.size === 0) return null;
    const name = (station: string) => this.index.stationName(station, moment.clock);
    // The search reaches stations soonest first, so they come in that order.
    const stations = [...minutes].filter(([station]) => station !== from).map(([id, time]) => ({ id, name: name(id), minutes: time, band: bandOf(time) }));
    return { from: { id: from, name: name(from) }, stations, bands: REACH_BANDS };
  }

  /**
   * The network's records at a moment: the stations open longest, those most lines call at, and the
   * longest lines.
   *
   * @param count - How many of each.
   * @param moment - The moment.
   * @returns The records.
   */
  private recordsAt(count: number, moment: NetworkMoment): NetworkRecords {
    const { firstYears } = this.networkHistory();
    const { stations } = networkAt(this.index, this.timeline, moment.cursor);
    const name = (station: string) => this.index.stationName(station, moment.clock);
    const oldest = [...stations.keys()]
      .flatMap(station => {
        const year = firstYears.get(station);
        return year === undefined ? [] : [{ id: station, name: name(station), year }];
      })
      .sort((first, second) => first.year - second.year || first.name.localeCompare(second.name))
      .slice(0, count);
    const busiest = [...stations]
      .map(([station, lines]) => ({
        id: station,
        name: name(station),
        lines: [...lines].sort(this.index.compareLines).map(line => ({ id: line, name: this.index.lineName(line), color: moment.colorOf(line) })),
      }))
      .sort((first, second) => second.lines.length - first.lines.length || first.name.localeCompare(second.name))
      .slice(0, count);
    const longest = this.index.lineIds
      .map(line => ({
        id: line,
        name: this.index.lineName(line),
        color: moment.colorOf(line),
        km: lineLengthKm(this.index, this.timeline, line, moment.cursor),
      }))
      .filter(line => line.km > 0)
      .sort((first, second) => second.km - first.km)
      .slice(0, count);
    return { oldest, busiest, longest };
  }

  /**
   * The stations on the map at a moment, for a search: each with its names and its lines' colours.
   *
   * @param moment - The moment.
   * @returns The stations a line calls at, by name.
   */
  private stationsAt(moment: NetworkMoment): StationSummary[] {
    return (
      [...this.timeline.stationsOnMap(moment.cursor)]
        .map(station => {
          const lines = this.callingAt(station, moment.cursor);
          return {
            id: station,
            name: this.index.stationName(station, moment.clock),
            otherNames: this.index.otherNames(this.index.namedAt(station, moment.clock)),
            colors: [...new Set(lines.map(line => moment.colorOf(line)))],
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
  private stationAt(station: string, moment: NetworkMoment): StationInfo {
    const info = this.index.stationOf(station);
    const byLine = new Map<string, { opened: number; lastClosed: number; allClosed: boolean }>();
    for (const lineSegment of this.index.lineSegmentsAt(station)) {
      if (!this.timeline.everServes(station, lineSegment.line)) continue;
      // Timestamps before 1970 are negative: the latest close starts below any of them.
      const dates = byLine.get(lineSegment.line) ?? { opened: Infinity, lastClosed: -Infinity, allClosed: true };
      dates.opened = Math.min(dates.opened, lineSegment.opens);
      dates.lastClosed = Math.max(dates.lastClosed, lineSegment.closes ?? -Infinity);
      // A line has closed at a station only when every one of its segments there has.
      dates.allClosed &&= lineSegment.closes !== null;
      byLine.set(lineSegment.line, dates);
    }
    const lines = [...byLine.entries()].map(([line, dates]) => {
      // The line stopped calling here, or its track here closed.
      const closed = info.closed?.[line] ?? (dates.allClosed ? toIsoDate(dates.lastClosed) : undefined);
      return {
        id: line,
        name: this.index.lineName(line),
        color: moment.colorOf(line),
        // A plan's line has no date: Infinity, from its undated line segments.
        opened: info.infill?.[line] ?? (dates.opened === Infinity ? null : toIsoDate(dates.opened)),
        ...(closed ? { closed } : {}),
      };
    });
    return {
      id: station,
      name: this.index.stationName(station, moment.clock),
      otherNames: this.index.otherNames(this.index.namedAt(station, moment.clock)),
      // By opening, a plan's undated lines last.
      lines: lines.sort(
        (first, second) => (first.opened === null ? 1 : 0) - (second.opened === null ? 1 : 0) || (first.opened ?? '').localeCompare(second.opened ?? ''),
      ),
      // Only the names it had dropped by the moment.
      formerNames: (info.formerNames ?? [])
        .filter(former => toTimestamp(former.until) <= moment.clock)
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
  private transfersFrom(station: string, moment: NetworkMoment): TransferInfo[] {
    return this.index.transfersAt(station).flatMap(other => {
      // The lines calling there now, each as it is drawn then (a branch still shown as its parent).
      const calling = this.callingAt(other, moment.cursor).map(line => this.timeline.identityOf(line, moment.cursor).id);
      if (calling.length === 0) return [];
      const ordered = [...new Set(calling)].sort(this.index.compareLines);
      return [
        {
          id: other,
          name: this.index.stationName(other, moment.clock),
          lines: ordered.map(line => ({ id: line, name: this.index.lineName(line), color: moment.colorOf(line) })),
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
