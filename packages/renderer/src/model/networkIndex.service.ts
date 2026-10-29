import type { Line, LngLat, Network, Segment, Station } from '@railtime/schema/network.types';
import { required } from '../core/required.utils';
import { toTimestamp } from './date.utils';
import type { Bounds } from './geometry.types';
import { boundsOf, cumulativeDistances } from './geometry.utils';
import type { LineSegment, TrackSegment } from './networkIndex.types';
import { orientSegments } from './orientation.utils';

/**
 * The network, indexed for drawing: segments with their distances and direction of travel
 * precomputed, and one `LineSegment` per (segment, line) with its dates as timestamps.
 */
export class NetworkIndex {
  /** The normalized network this index was built from. */
  public readonly network: Network;
  /** Every track segment, in the network's order. */
  public readonly segments: TrackSegment[];
  /** Every line on every segment. */
  public readonly lineSegments: LineSegment[] = [];
  /** Lines a user can see and toggle: every line but pseudo lines (alias targets). */
  public readonly lineIds: string[];
  /** The bounding box of every station. */
  public readonly bounds: Bounds;
  /** The middle of `bounds`: where a network with nothing on the map yet grows from. */
  public readonly centre: LngLat;
  /** Each line's position in the network: also the order lines sit side by side on shared track. */
  private readonly lineOrder: Map<string, number>;
  /** Line segments touching each station. */
  private readonly lineSegmentsByStation = new Map<string, LineSegment[]>();

  public constructor(network: Network) {
    this.network = network;
    this.lineOrder = new Map(Object.keys(network.lines).map((line, position) => [line, position]));
    this.lineIds = Object.entries(network.lines)
      .filter(([, line]) => !line.pseudo)
      .map(([id]) => id);
    this.segments = network.segments.map((segment, index) => this.indexSegment(segment, index));
    for (const [segment, travel] of orientSegments(this.segments)) segment.travel = travel;
    this.bounds = boundsOf(Object.values(network.stations).map(station => station.coordinate)) ?? [
      [0, 0],
      [0, 0],
    ];
    this.centre = [(this.bounds[0][0] + this.bounds[1][0]) / 2, (this.bounds[0][1] + this.bounds[1][1]) / 2];
  }

  /**
   * Sorts line ids into side-by-side order.
   *
   * @param first - A line id.
   * @param second - Another line id.
   * @returns Negative if `first` sits left of `second`.
   */
  public readonly compareLines = (first: string, second: string): number => (this.lineOrder.get(first) ?? 0) - (this.lineOrder.get(second) ?? 0);

  /**
   * Where a station is.
   *
   * @param station - A station id.
   * @returns Its coordinate.
   */
  public coordOf(station: string): LngLat {
    return this.stationOf(station).coordinate;
  }

  /**
   * A station's details.
   *
   * @param station - A station id.
   * @returns The station.
   */
  public stationOf(station: string): Station {
    return required(this.network.stations[station], `station ${station}`);
  }

  /**
   * A line's details.
   *
   * @param line - A line id.
   * @returns The line.
   */
  public lineOf(line: string): Line {
    return required(this.network.lines[line], `line ${line}`);
  }

  /**
   * A station's name on a date: a former name until the day it changed.
   *
   * @param station - A station id.
   * @param time - The date's timestamp; today's name without one.
   * @returns Its display name then.
   */
  public stationName(station: string, time = Infinity): string {
    const info = this.stationOf(station);
    return info.formerNames?.find(former => time < toTimestamp(former.until))?.name ?? info.name;
  }

  /**
   * A line's name as people say it.
   *
   * @param line - A line id.
   * @returns "Victoria line", or a pseudo line's own name ("London Overground").
   */
  public lineName(line: string): string {
    const info = this.lineOf(line);
    return info.pseudo ? info.name : `${info.name} line`;
  }

  /**
   * The line segments touching a station.
   *
   * @param station - A station id.
   * @returns Every line on every segment ending there.
   */
  public lineSegmentsAt(station: string): LineSegment[] {
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
    const reversedCoordinates = segment.coordinates.slice().reverse();
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
    for (const [line, dates] of Object.entries(segment.lines)) {
      const lineSegment: LineSegment = { segment: trackSegment, line, opens: toTimestamp(dates.open), closes: dates.close ? toTimestamp(dates.close) : null };
      this.lineSegments.push(lineSegment);
      for (const station of [segment.stationA, segment.stationB]) {
        const atStation = this.lineSegmentsByStation.get(station) ?? [];
        atStation.push(lineSegment);
        this.lineSegmentsByStation.set(station, atStation);
      }
    }
    return trackSegment;
  }
}
