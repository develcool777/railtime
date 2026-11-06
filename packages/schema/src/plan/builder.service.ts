import type { LngLat } from '@railtime/core/geometry.types';
import { required } from '@railtime/core/required.utils';
import type { Heading, SectionWorks } from './build.types';
import { curveBetween, headingOf, samePair, splitTrack } from './track.utils.ts';
import type { LineId, Network, PlanSection, PlanTrack, Segment, Station, StationId } from '../format/network.types';

/**
 * Builds plan sections on a network, keeping track of segments as objects, so splitting one never
 * loses which sections run over it.
 */
export class PlanBuilder {
  /** The network being built on. */
  public readonly network: Network;
  /** Every section built so far, in order. */
  public readonly sections: SectionWorks[] = [];
  /** Where the plan's new track runs between two stations, where it says. */
  private readonly track: PlanTrack[];
  /** All the new track laid, each piece of what a station split on it. */
  public readonly laid = new Set<Segment>();
  /** The new track laid where the plan says none: straight until `curve` bends it through its line's stations. */
  private readonly unsaid = new Set<Segment>();

  public constructor(network: Network, track: PlanTrack[] = []) {
    this.network = network;
    this.track = track;
  }

  /**
   * Builds one section: stands its new stations between neighbours on the line's track, then puts the
   * line on the track between its stations, laying the plan's where there is none.
   *
   * @param section - The section.
   */
  public build(section: PlanSection): void {
    const works: SectionWorks = { line: section.line, segments: [], infills: [] };
    this.sections.push(works);
    for (const [index, station] of section.stations.entries()) {
      const [before, after] = [section.stations[index - 1], section.stations[index + 1]];
      if (before === undefined || after === undefined || this.between(before, station)) continue;
      const through = this.between(before, after);
      if (!through || !this.runsOver(through, section.line)) continue;
      this.split(through, station);
      works.infills.push(station);
    }
    for (const [index, stationB] of section.stations.entries()) {
      const stationA = section.stations[index - 1];
      if (stationA === undefined) continue;
      const segment = this.between(stationA, stationB) ?? this.lay(stationA, stationB);
      if (!this.runsOver(segment, section.line)) works.segments.push(segment);
    }
  }

  /**
   * The segment between two stations.
   *
   * @param stationA - One end.
   * @param stationB - The other.
   * @returns It, if there is one.
   */
  private between(stationA: StationId, stationB: StationId): Segment | undefined {
    return this.network.segments.find(segment => samePair(segment, { stationA, stationB }));
  }

  /**
   * Whether a line runs over a segment: by date, or from a section.
   *
   * @param segment - The segment.
   * @param line - The line id.
   * @returns True if it does.
   */
  private runsOver(segment: Segment, line: LineId): boolean {
    return line in segment.lines || this.sections.some(section => section.line === line && section.segments.includes(segment));
  }

  /**
   * A station the plan stands on: the schema checks every station of a plan exists.
   *
   * @param station - Its id.
   * @returns The station.
   */
  private stationOf(station: StationId): Station {
    return required(this.network.stations[station], `station ${station}`);
  }

  /**
   * New track between two stations: where the plan says it runs, either way round, else straight.
   *
   * @param stationA - One end.
   * @param stationB - The other.
   * @returns The new segment, with no lines yet.
   */
  private lay(stationA: StationId, stationB: StationId): Segment {
    const given = this.track.find(track => samePair(track, { stationA, stationB }));
    let coordinates: LngLat[] = [this.stationOf(stationA).coordinate, this.stationOf(stationB).coordinate];
    if (given) coordinates = given.stationA === stationA ? [...given.coordinates] : given.coordinates.toReversed();
    const segment: Segment = { stationA, stationB, lines: {}, coordinates };
    this.network.segments.push(segment);
    this.laid.add(segment);
    if (!given) this.unsaid.add(segment);
    return segment;
  }

  /**
   * Splits a segment at the point on it nearest a station, the track brought to the station there:
   * two segments in its place, each with its lines, its dated ones and the sections' alike.
   *
   * @param segment - The segment.
   * @param station - The station to stand on it.
   */
  private split(segment: Segment, station: StationId): void {
    const place = this.stationOf(station).coordinate;
    const [first, second] = splitTrack(segment.coordinates, place);
    // The halves meet at the station itself, not beside it on the track.
    const halves: Segment[] = [
      { ...segment, stationB: station, coordinates: [...first.slice(0, -1), place] },
      { ...segment, stationA: station, coordinates: [place, ...second.slice(1)] },
    ];
    this.network.segments.splice(this.network.segments.indexOf(segment), 1, ...halves);
    for (const section of this.sections) section.segments = section.segments.flatMap(item => (item === segment ? halves : [item]));
    if (this.unsaid.delete(segment)) for (const half of halves) this.unsaid.add(half);
    if (this.laid.delete(segment)) for (const half of halves) this.laid.add(half);
  }

  /**
   * Bends the new track the plan said nothing of, once every section is built, as a line's track
   * runs: each stretch leaves and comes into its stations on the way its line goes through them, so
   * the line curves through a station instead of turning a corner there. Where it ends, or reverses,
   * it runs straight on; where it meets track the plan said or the network had, it follows that.
   */
  public curve(): void {
    const headings = new Map<Segment, [Heading, Heading]>();
    for (const segment of this.unsaid) {
      const line = this.sections.find(section => section.segments.includes(segment))?.line;
      if (line === undefined) continue;
      // The way it comes into station B is the way it would leave B backwards, turned round.
      const [back, on] = [this.headingThrough(segment.stationB, segment, line), this.headingThrough(segment.stationA, segment, line)];
      headings.set(segment, [on, [-back[0], -back[1]]]);
    }
    // Every heading taken from the track as laid, before any of it bends.
    for (const [segment, [leaving, arriving]] of headings)
      segment.coordinates = curveBetween(
        required(segment.coordinates[0], "a segment's start"),
        required(segment.coordinates.at(-1), "a segment's end"),
        leaving,
        arriving,
      );
  }

  /**
   * The way a line's new track leaves a station: halfway between its own way and straight on from
   * the line's track it comes in on there (the one most nearly opposite, where it forks), or that
   * track's way exactly if the track is said, the plan's or the network's. Straight on where nothing
   * comes in, or the line reverses there.
   *
   * @param station - The station.
   * @param segment - The new track, unsaid.
   * @param line - Its line.
   * @returns The heading.
   */
  private headingThrough(station: StationId, segment: Segment, line: LineId): Heading {
    const leaving = (track: Segment) => headingOf(track.stationA === station ? track.coordinates : track.coordinates.toReversed());
    // A laid segment's ends are two stations apart, so it heads somewhere.
    const own = required(leaving(segment) ?? undefined, `the heading through ${station}`);
    if (this.network.stations[station]?.reverses?.includes(line)) return own;
    let against: { heading: Heading; said: boolean } | null = null;
    for (const other of this.network.segments) {
      if (other === segment || (other.stationA !== station && other.stationB !== station) || !this.runsOver(other, line)) continue;
      const heading = leaving(other);
      const dot = heading ? heading[0] * own[0] + heading[1] * own[1] : 0;
      if (heading && (!against || dot < against.heading[0] * own[0] + against.heading[1] * own[1])) against = { heading, said: !this.unsaid.has(other) };
    }
    if (!against) return own;
    const straightOn: Heading = [-against.heading[0], -against.heading[1]];
    if (against.said) return straightOn;
    const [east, north] = [own[0] + straightOn[0], own[1] + straightOn[1]];
    const length = Math.hypot(east, north);
    return length > 0 ? [east / length, north / length] : own;
  }
}
