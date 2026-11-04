import { entriesOf, keysOf, pushTo } from '@railtime/core/collection.utils';
import { toTimestamp } from '@railtime/core/date.utils';
import type { Bounds, LngLat } from '@railtime/core/geometry.types';
import { boundsOf, cumulativeDistances } from '@railtime/core/geometry.utils';
import { required } from '@railtime/core/required.utils';
import type { Line, LineId, Network, Segment, SegmentLine, Station, StationId } from '@railtime/schema/network.types';
import type { BuiltSection } from '@railtime/schema/plan.types';
import type { LineGap, LineSegment, TrackSegment } from './engine.types';
import { outsideGaps } from './gaps.utils.ts';
import { orientSegments } from './orientation.utils.ts';

/**
 * The network, indexed for drawing: segments with their distances and direction of travel
 * precomputed, and one `LineSegment` per (segment, line, period) with its dates as timestamps: a line
 * suspended on a segment and back is two periods there, linked; a line left out for a while (a gap)
 * is two there, apart. A plan built on the network adds one
 * undated `LineSegment` per line its sections put on a segment.
 */
export class NetworkIndex {
  /** The normalized network this index was built from. */
  public readonly network: Network;
  /** Every track segment, in the network's order. */
  public readonly segments: TrackSegment[];
  /** Every line on every segment, one entry per period. */
  public readonly lineSegments: LineSegment[] = [];
  /** Lines a user can see and toggle: every line but pseudo lines (alias targets). */
  public readonly lineIds: LineId[];
  /** The bounding box of every station. */
  public readonly bounds: Bounds;
  /** The middle of `bounds`: where a network with nothing on the map yet grows from. */
  public readonly centre: LngLat;
  /** The plan built on the network, section by section; none without one. */
  public readonly sections: BuiltSection[];
  /** Each line's position in the network: also the order lines sit side by side on shared track. */
  private readonly lineOrder: Map<LineId, number>;
  /** The stations each station has a transfer to. */
  private readonly transfersByStation = new Map<StationId, StationId[]>();
  /** Line segments touching each station. */
  private readonly lineSegmentsByStation = new Map<StationId, LineSegment[]>();
  /** The stretches of time each line is left out, if any. */
  public readonly gaps: ReadonlyMap<LineId, readonly LineGap[]>;

  /**
   * @param network - The network: with a plan's track, if one is built on it (`buildPlan`).
   * @param sections - That plan's sections, in order.
   * @param gaps - The stretches of time each line is left out: the years it was drawn as a line hidden.
   */
  public constructor(network: Network, sections: BuiltSection[] = [], gaps: ReadonlyMap<LineId, readonly LineGap[]> = new Map()) {
    this.network = network;
    this.sections = sections;
    this.gaps = gaps;
    this.lineOrder = new Map(keysOf(network.lines).map((line, position) => [line, position]));
    this.lineIds = entriesOf(network.lines)
      .filter(([, line]) => !line.pseudo)
      .map(([id]) => id);
    this.segments = network.segments.map((segment, index) => this.indexSegment(segment, index));
    for (const [position, section] of sections.entries()) {
      for (const segmentIndex of section.segments) {
        const segment = required(this.segments[segmentIndex], `segment ${segmentIndex}`);
        this.addLineSegment({ segment, line: section.line, opens: Infinity, closes: null, section: position, previous: null, next: null });
      }
    }
    for (const [segment, travel] of orientSegments(this.segments)) segment.travel = travel;
    this.bounds = boundsOf(Object.values(network.stations).map(station => station.coordinate)) ?? [
      [0, 0],
      [0, 0],
    ];
    this.centre = [(this.bounds[0][0] + this.bounds[1][0]) / 2, (this.bounds[0][1] + this.bounds[1][1]) / 2];
    for (const { stationA, stationB } of network.transfers ?? []) {
      pushTo(this.transfersByStation, stationA, stationB);
      pushTo(this.transfersByStation, stationB, stationA);
    }
  }

  /**
   * Something's names in other languages, by language code, but those the same as its English name.
   *
   * @param named - A station or former name.
   * @returns Its other names.
   */
  public otherNames(named: Pick<Station, 'name' | 'names'>): string[] {
    return entriesOf(named.names ?? {})
      .toSorted(([first], [second]) => first.localeCompare(second))
      .map(([, name]) => name)
      .filter(name => name !== named.name);
  }

  /**
   * Sorts line ids into side-by-side order.
   *
   * @param first - A line id.
   * @param second - Another line id.
   * @returns Negative if `first` sits left of `second`.
   */
  public readonly compareLines = (first: LineId, second: LineId): number => (this.lineOrder.get(first) ?? 0) - (this.lineOrder.get(second) ?? 0);

  /**
   * Where a station is.
   *
   * @param station - A station id.
   * @returns Its coordinate.
   */
  public coordOf(station: StationId): LngLat {
    return this.stationOf(station).coordinate;
  }

  /**
   * A station's details.
   *
   * @param station - A station id.
   * @returns The station.
   */
  public stationOf(station: StationId): Station {
    return required(this.network.stations[station], `station ${station}`);
  }

  /**
   * A line's details.
   *
   * @param line - A line id.
   * @returns The line.
   */
  public lineOf(line: LineId): Line {
    return required(this.network.lines[line], `line ${line}`);
  }

  /**
   * A station's name on a date: a former name until the day it changed.
   *
   * @param station - A station id.
   * @param time - The date's timestamp; today's name without one.
   * @returns Its display name then.
   */
  public stationName(station: StationId, time = Infinity): string {
    return this.namedAt(station, time).name;
  }

  /**
   * A station's label on the map on a date: its name, then its names in other languages beneath.
   *
   * @param station - A station id.
   * @param time - The date's timestamp; today's name without one.
   * @returns One name per line.
   */
  public stationLabel(station: StationId, time = Infinity): string {
    const named = this.namedAt(station, time);
    return [named.name, ...this.otherNames(named)].join('\n');
  }

  /**
   * A line's name as people say it.
   *
   * @param line - A line id.
   * @returns Its full name where it has one; else "<name> line", or a pseudo line's own name as it is.
   */
  public lineName(line: LineId): string {
    const info = this.lineOf(line);
    if (info.fullName) return info.fullName;
    return info.pseudo ? info.name : `${info.name} line`;
  }

  /**
   * When a line first ran as itself: its first opening, or, for a line drawn as another until a
   * date (an alias), that date, or its first opening after it where it was out then (a gap).
   *
   * @param line - A line id.
   * @returns A timestamp; `Infinity` for a line only a plan builds.
   */
  public lineOpens(line: LineId): number {
    const ownFrom = Math.max(...(this.lineOf(line).aliases ?? []).map(alias => toTimestamp(alias.until)));
    const runsAsItself = this.lineSegments.filter(lineSegment => lineSegment.line === line && (lineSegment.closes === null || lineSegment.closes > ownFrom));
    return Math.min(...runsAsItself.map(lineSegment => Math.max(lineSegment.opens, ownFrom)));
  }

  /**
   * Whether a line goes out at a moment (a gap starts): what it is drawn as changing then shows nowhere.
   *
   * @param line - A line id.
   * @param time - A timestamp.
   * @returns True if one of its gaps starts then.
   */
  public goesOutAt(line: LineId, time: number): boolean {
    return (this.gaps.get(line) ?? []).some(gap => gap.from === time);
  }

  /**
   * The stations a station has a transfer to.
   *
   * @param station - A station id.
   * @returns Their ids.
   */
  public transfersAt(station: StationId): StationId[] {
    return this.transfersByStation.get(station) ?? [];
  }

  /**
   * The line segments touching a station.
   *
   * @param station - A station id.
   * @returns Every line on every segment ending there.
   */
  public lineSegmentsAt(station: StationId): LineSegment[] {
    return this.lineSegmentsByStation.get(station) ?? [];
  }

  /**
   * Prepares one segment for drawing and indexes the lines running over it.
   *
   * @param segment - The segment as the network has it.
   * @param index - Its position in the network.
   * @returns The prepared segment; its `travel` is set afterwards, once all segments exist.
   */
  private indexSegment(segment: Segment, index: number): TrackSegment {
    const reversedCoordinates = segment.coordinates.toReversed();
    const distances = cumulativeDistances(segment.coordinates);
    const trackSegment: TrackSegment = {
      index,
      stationA: segment.stationA,
      stationB: segment.stationB,
      coordinates: segment.coordinates,
      reversedCoordinates,
      distances,
      reversedDistances: cumulativeDistances(reversedCoordinates),
      lengthKm: distances.at(-1) ?? 0,
      travel: 1,
    };
    for (const [line, dates] of entriesOf(segment.lines)) this.indexLineOnSegment(trackSegment, line, dates);
    return trackSegment;
  }

  /**
   * Indexes one line's periods on a segment: a period per spell it runs there, cut where the line is left out.
   *
   * @param trackSegment - The prepared segment.
   * @param line - The line's id.
   * @param dates - Its dates on the segment, as the network has them.
   */
  private indexLineOnSegment(trackSegment: TrackSegment, line: LineId, dates: SegmentLine): void {
    // Each spell without trains ends one period and starts the next.
    const starts = [dates.open, ...(dates.suspended ?? []).map(spell => spell.until)];
    const ends = [...(dates.suspended ?? []).map(spell => spell.from), dates.close];
    // The period before, while it ran up to the spell: one a gap cut short leaves the next apart.
    let previous: LineSegment | null = null;
    for (const [period, start] of starts.entries()) {
      const end = ends[period];
      const opens = toTimestamp(start);
      const closes = end ? toTimestamp(end) : null;
      const pieces = outsideGaps(opens, closes, this.gaps.get(line) ?? []).map((piece): LineSegment => ({
        segment: trackSegment,
        line,
        ...piece,
        section: null,
        previous: null,
        next: null,
      }));
      const [first] = pieces;
      if (first && previous && first.opens === opens) {
        first.previous = previous;
        previous.next = first;
      }
      for (const piece of pieces) this.addLineSegment(piece);
      const last = pieces.at(-1);
      previous = last?.closes === closes ? last : null;
    }
  }

  /**
   * Indexes one line's period on a segment, and at the stations it ends at.
   *
   * @param lineSegment - The line segment.
   */
  private addLineSegment(lineSegment: LineSegment): void {
    this.lineSegments.push(lineSegment);
    for (const station of [lineSegment.segment.stationA, lineSegment.segment.stationB]) {
      const atStation = this.lineSegmentsByStation.get(station) ?? [];
      atStation.push(lineSegment);
      this.lineSegmentsByStation.set(station, atStation);
    }
  }

  /**
   * A station, or the former name it had on a date.
   *
   * @param station - A station id.
   * @param time - The date's timestamp.
   * @returns What it was called then, with that name's other languages.
   */
  public namedAt(station: StationId, time: number): Pick<Station, 'name' | 'names'> {
    const info = this.stationOf(station);
    return info.formerNames?.find(former => time < toTimestamp(former.until)) ?? info;
  }
}
