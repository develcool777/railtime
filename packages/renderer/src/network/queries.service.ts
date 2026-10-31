import { required } from '../core/required.utils';
import { toIsoDate, toTimestamp } from '../core/date.utils';
import { REACH_BANDS } from '../reach/layer.constants';
import { bandOf } from '../reach/layer.utils';
import { RouteFinder } from '../route/finder.service';
import type {
  LineDetails,
  LineInfo,
  NetworkGrowth,
  NetworkRecords,
  ReachInfo,
  RouteInfo,
  RoutePreference,
  StationInfo,
  StationSummary,
  TransferInfo,
} from '../transitMap.types';
import type { NetworkHistory } from './history.types';
import { networkAt, networkHistory, openingsByDecade } from './history.utils';
import type { NetworkIndex } from './index.service';
import { lineBranches, lineLengthKm, stepChangesLine } from './lineDetails.utils';
import type { NetworkMoment } from './queries.types';
import type { Timeline } from './timeline.service';

/**
 * What the app asks of the network at a moment: its lines, a line's stops, a station's lines and
 * transfers, the stations to search, routes, how far one gets, how it grew and its records. Pure:
 * `TransitMap` passes the moment it shows.
 */
export class NetworkQueries {
  /** The network, indexed. */
  private readonly index: NetworkIndex;
  /** Its history as steps. */
  private readonly timeline: Timeline;
  /** Finds routes, and how far one gets, between its stations. */
  private readonly routeFinder: RouteFinder;
  /** The year the history runs to. */
  private readonly thisYear: number;
  /** The network year by year, worked out the first time it is asked for: it does not change. */
  private history: NetworkHistory | null = null;

  public constructor(index: NetworkIndex, timeline: Timeline, today: number) {
    this.index = index;
    this.timeline = timeline;
    this.routeFinder = new RouteFinder(index, timeline);
    this.thisYear = new Date(today).getUTCFullYear();
  }

  /**
   * Every line a user can toggle, with its colour.
   *
   * @param colorOf - A line's colour in the current theme.
   * @returns The lines, in the network's order.
   */
  public lines(colorOf: NetworkMoment['colorOf']): LineInfo[] {
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
  public lineDetails(line: string, moment: NetworkMoment): LineDetails {
    const info = required(
      this.lines(moment.colorOf).find(candidate => candidate.id === line),
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
  public route(from: string, to: string, preference: RoutePreference, moment: NetworkMoment): RouteInfo | null {
    const route = this.routeFinder.find(from, to, moment.cursor, preference);
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
  public reach(from: string, moment: NetworkMoment): ReachInfo | null {
    const minutes = this.routeFinder.reach(from, moment.cursor);
    if (minutes.size === 0) return null;
    const name = (station: string) => this.index.stationName(station, moment.clock);
    // The search reaches stations soonest first, so they come in that order.
    const stations = [...minutes].filter(([station]) => station !== from).map(([id, time]) => ({ id, name: name(id), minutes: time, band: bandOf(time) }));
    return { from: { id: from, name: name(from) }, stations, bands: REACH_BANDS };
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
   * The network's records at a moment: the stations open longest, those most lines call at, and the
   * longest lines.
   *
   * @param count - How many of each.
   * @param moment - The moment.
   * @returns The records.
   */
  public records(count: number, moment: NetworkMoment): NetworkRecords {
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
  public stations(moment: NetworkMoment): StationSummary[] {
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
  public stationInfo(station: string, moment: NetworkMoment): StationInfo {
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
