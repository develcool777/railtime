import { toIsoDate, toTimestamp } from '@railtime/core/date.utils';
import type { LineId, StationId } from '@railtime/schema/network.types';
import { REACH_BANDS } from './facts.constants.ts';
import type {
  LineDetails,
  LineDirection,
  LineInfo,
  NetworkRecords,
  NetworkStats,
  Playhead,
  ReachInfo,
  RouteInfo,
  RouteStrength,
  StationInfo,
  StationSummary,
  Stop,
  TransferInfo,
} from './facts.types';
import { bandOf, byOpening, lineInfoOf, linesAsDrawn, reachedSegments, recordsOf, trackDatesAt } from './facts.utils.ts';
import type { MomentSource } from './moment.types';
import { statsDrawn } from '../engine/history.utils.ts';
import type { NetworkIndex } from '../engine/index.service';
import { directionsAt, lineLengthKm, lineRuns, stepChangesLine } from '../engine/lineDetails.utils.ts';
import type { Timeline } from '../engine/timeline.service';
import type { RouteFinder } from '../route/finder.service';
import type { TrainService } from '../trains/trains.service';

/**
 * The network at one moment, and every question about it then. Every answer says what the map draws
 * at that moment: a line drawn as another then (`LineAlias`) is that line, in a station's lines, a
 * route's legs, a line's stops and the records. The rule is `Timeline.drawnAs`, and this class asks it
 * for every answer, so none can name a line the map does not.
 */
export class FactsAt {
  /** The network, indexed. */
  private readonly index: NetworkIndex;
  /** Its history as steps. */
  private readonly timeline: Timeline;
  /** Where in its history the map can be. */
  private readonly playheads: MomentSource['playheads'];
  /** Finds routes, and how far one gets, between its stations. */
  private readonly finder: RouteFinder;
  /** The network's size at a cursor. */
  private readonly sizeAt: MomentSource['statsAt'];
  /** The trains the network runs at a cursor. */
  private readonly trainsAt: MomentSource['trains'];
  /** The year each station was first on the map, worked out the first time it is asked for. */
  private readonly firstYears: MomentSource['firstYears'];
  /** The moment asked about. */
  private readonly moment: Playhead;

  /**
   * @param source - The network and what its answers draw on.
   * @param moment - The moment: the map's `time`.
   */
  public constructor(source: MomentSource, moment: Playhead) {
    this.index = source.index;
    this.timeline = source.timeline;
    this.playheads = source.playheads;
    this.finder = source.finder;
    this.sizeAt = source.statsAt;
    this.trainsAt = source.trains;
    this.firstYears = source.firstYears;
    this.moment = moment;
  }

  /**
   * The stations on the map, for a search: each with its names and its lines' colours.
   *
   * @returns The stations a line calls at, by name.
   */
  public stations(): StationSummary[] {
    const { cursor, time } = this.moment;
    return [...this.timeline.stationsOnMap(cursor)]
      .flatMap(station => {
        const lines = this.timeline.linesCallingAt(station, cursor);
        // A station the track passes but no line calls at is not one to look for.
        if (lines.length === 0) return [];
        const colors = lines.map(line => this.index.colorOf(line));
        return [
          {
            id: station,
            name: this.index.stationName(station, time),
            otherNames: this.index.otherNames(this.index.namedAt(station, time)),
            // Lines sharing a colour show it once.
            colors: [...new Map(colors.map(color => [`${color.light} ${color.dark}`, color])).values()],
          },
        ];
      })
      .toSorted((first, second) => first.name.localeCompare(second.name));
  }

  /**
   * A station's lines as they are drawn, with when each opened there and, if it has, closed: its track,
   * or its calls there while the track stays, and whether it calls there at the moment; its former
   * names by the moment, and its transfers then.
   *
   * @param id - The station id.
   * @returns The station's details.
   */
  public station(id: StationId): StationInfo {
    const { cursor, time } = this.moment;
    const info = this.index.stationOf(id);
    const calling = new Set(this.timeline.linesCallingAt(id, cursor));
    const dated = [...trackDatesAt(this.index, this.timeline, id)].map(([line, dates]) => ({
      drawn: this.timeline.drawnAs(line, cursor),
      // A plan's line has no date: Infinity, from its undated line segments.
      opened: info.infill?.[line] ?? (dates.opened === Infinity ? null : toIsoDate(dates.opened)),
      // The line stopped calling here, or its track here closed.
      closed: info.closed?.[line] ?? (dates.allClosed ? toIsoDate(dates.lastClosed) : undefined),
    }));
    const lines = linesAsDrawn(dated).map(({ drawn, opened, closed }) => ({
      ...this.named(drawn),
      opened,
      ...(closed && { closed }),
      calls: calling.has(drawn),
    }));
    return {
      id,
      name: this.index.stationName(id, time),
      otherNames: this.index.otherNames(this.index.namedAt(id, time)),
      lines: lines.toSorted(byOpening),
      // Only the names it had dropped by the moment.
      formerNames: (info.formerNames ?? [])
        .filter(former => toTimestamp(former.until) <= time)
        .map(former => ({ name: former.name, otherNames: this.index.otherNames(former), until: former.until })),
      transfers: this.transfersFrom(id),
    };
  }

  /**
   * A line as it is drawn: its stops in order, by branch, how long it is, and the changes that made it.
   *
   * @param id - The line id: one drawn as another then is that line.
   * @returns The line's details.
   */
  public line(id: LineId): LineDetails {
    const { cursor } = this.moment;
    const drawn = this.timeline.drawnAs(id, cursor);
    const lines = this.timeline.linesDrawnAs(drawn, cursor);
    const branches = this.runsOf(lines).map(run => run.stops);
    const info: LineInfo = lineInfoOf(this.index, drawn);
    return {
      ...info,
      stations: new Set(branches.flatMap((run, position) => (position === 0 ? run : run.slice(1))).map(stop => stop.id)).size,
      km: lineLengthKm(this.index, this.timeline, lines, cursor),
      branches,
      changes: this.timeline.steps.filter(step => lines.some(line => stepChangesLine(step, line))).map(step => step.index),
    };
  }

  /**
   * The stops either side of a station, on each line calling there, the way its trains go.
   *
   * @param station - The station id.
   * @returns Its directions, by line as drawn.
   */
  public directions(station: StationId): Map<LineId, LineDirection[]> {
    const { cursor } = this.moment;
    return new Map(
      this.timeline.linesCallingAt(station, cursor).map(line => [line, directionsAt(station, this.runsOf(this.timeline.linesDrawnAs(line, cursor)))] as const),
    );
  }

  /**
   * The network's records: the stations open longest, those most lines call at, and the longest lines.
   *
   * @param count - How many of each.
   * @returns The records.
   */
  public records(count: number): NetworkRecords {
    return recordsOf({ index: this.index, timeline: this.timeline, firstYears: this.firstYears() }, count, this.moment);
  }

  /**
   * The ways between two stations, fastest first: for each, the lines to ride, where to change, about
   * how long it takes, and what it is best at. The way that changes least is said to where it changes
   * less than the fastest.
   *
   * @param from - The station to start at.
   * @param to - The station to get to.
   * @returns The routes; none if the network then has none.
   */
  public routes(from: StationId, to: StationId): RouteInfo[] {
    const options = this.finder.options(from, to, this.moment.cursor);
    const fewest = Math.min(...options.map(route => route.changes));
    const stop = (station: StationId) => this.stop(station);
    return options.map((route, position) => ({
      from: stop(from),
      to: stop(to),
      legs: route.legs.map(leg =>
        leg.kind === 'walk'
          ? { kind: 'walk', from: stop(leg.from), to: stop(leg.to), minutes: leg.minutes }
          : {
              kind: 'ride',
              line: leg.line,
              lineName: this.index.lineName(leg.line),
              color: this.index.colorOf(leg.line),
              stops: leg.stops.map(stop),
              minutes: leg.minutes,
              km: leg.km,
            },
      ),
      minutes: route.minutes,
      km: route.km,
      changes: route.changes,
      segments: route.legs.map(leg => (leg.kind === 'ride' ? leg.segments : [])),
      best: [
        ...(position === 0 ? (['fastest'] as const) : []),
        ...(route.changes === fewest && fewest < (options[0]?.changes ?? 0) ? (['fewest-changes'] as const) : []),
      ] satisfies RouteStrength[],
    }));
  }

  /**
   * How long it takes to get from a station to every other, by the fastest routes.
   *
   * @param from - The station to start at.
   * @returns The stations it gets to, soonest first, the bands they are coloured in, and the track it colours; `null` if no line calls there then.
   */
  public reach(from: StationId): ReachInfo | null {
    const { cursor } = this.moment;
    const minutes = this.finder.reach(from, cursor);
    if (minutes.size === 0) return null;
    // The search reaches stations soonest first, so they come in that order.
    const stations = [...minutes].filter(([station]) => station !== from).map(([id, time]) => ({ ...this.stop(id), minutes: time, band: bandOf(time) }));
    // Each open segment once, though several lines run on it.
    const open = new Map(
      this.index.lineSegments
        .filter(lineSegment => this.timeline.isOpen(lineSegment, cursor))
        .map(lineSegment => [lineSegment.segment.index, lineSegment.segment]),
    );
    const track = reachedSegments(minutes, open.values()).map(reached => ({ segment: reached.segment, band: bandOf(reached.minutes) }));
    return { from: this.stop(from), stations, bands: REACH_BANDS, track };
  }

  /**
   * The lines that had opened as themselves by the moment (`LineInfo.opened`); in a plan, every line.
   *
   * @returns Their ids.
   */
  public linesOpened(): Set<LineId> {
    const inPlan = this.playheads.inPlan(this.moment);
    return new Set(this.index.lineIds.filter(line => inPlan || this.index.lineOpens(line) <= this.moment.time));
  }

  /**
   * The trains the network runs at the moment: a service worked out from its track, the same way for any
   * city, and where each train is by the clock.
   *
   * @returns Its trains.
   */
  public trains(): TrainService {
    return this.trainsAt(this.moment.cursor);
  }

  /**
   * How many stations, km of track and lines there are at the moment, a change partway counted as far
   * as it has been drawn (`statsDrawn`): the one count, what the map's `time` says of a playhead too.
   *
   * @returns The stats.
   */
  public stats(): NetworkStats {
    const { cursor, progress } = this.moment;
    return progress === 0 ? this.sizeAt(cursor) : statsDrawn(this.sizeAt(cursor), this.sizeAt(cursor + 1), progress);
  }

  /**
   * The stations a station changes to, with their lines then.
   *
   * @param station - The station id.
   * @returns Each one on the map then.
   */
  private transfersFrom(station: StationId): TransferInfo[] {
    return this.index.transfersAt(station).flatMap(other => {
      const lines = this.timeline.linesCallingAt(other, this.moment.cursor);
      if (lines.length === 0) return [];
      return [{ ...this.stop(other), lines: lines.map(line => this.named(line)) }];
    });
  }

  /**
   * Lines' runs of track, their stops named as they were at the moment.
   *
   * @param lines - One line, or those drawn as one.
   * @returns Each run's stops, and whether it runs one way.
   */
  private runsOf(lines: LineId[]): { stops: Stop[]; oneWay: boolean }[] {
    return lineRuns(this.index, this.timeline, lines, this.moment.cursor).map(({ stops, oneWay }) => ({ stops: stops.map(stop => this.stop(stop)), oneWay }));
  }

  /**
   * A station by its id and its name at the moment.
   *
   * @param station - The station id.
   * @returns The stop.
   */
  private stop(station: StationId): Stop {
    return { id: station, name: this.index.stationName(station, this.moment.time) };
  }

  /**
   * A line by its id, its name as people say it, and its colours.
   *
   * @param line - The line id.
   * @returns The line.
   */
  private named(line: LineId): { id: LineId; name: string; color: LineInfo['color'] } {
    return { id: line, name: this.index.lineName(line), color: this.index.colorOf(line) };
  }
}
