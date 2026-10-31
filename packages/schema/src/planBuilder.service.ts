import type { LngLat, Network, PlanSection, Segment } from './network.types';
import type { SectionWorks } from './plan.types';
import { splitTrack } from './geometry.utils.ts';

/**
 * Builds plan sections on a network, keeping track of segments as objects, so splitting one never
 * loses which sections run over it.
 */
export class PlanBuilder {
  /** The network being built on. */
  public readonly network: Network;
  /** Every section built so far, in order. */
  public readonly sections: SectionWorks[] = [];

  public constructor(network: Network) {
    this.network = network;
  }

  /**
   * Builds one section: stands its new stations between neighbours on the line's track, then puts the
   * line on the track between its stations, laying straight track where there is none.
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
  private between(stationA: string, stationB: string): Segment | undefined {
    return this.network.segments.find(
      segment => (segment.stationA === stationA && segment.stationB === stationB) || (segment.stationA === stationB && segment.stationB === stationA),
    );
  }

  /**
   * Whether a line runs over a segment: by date, or from a section.
   *
   * @param segment - The segment.
   * @param line - The line id.
   * @returns True if it does.
   */
  private runsOver(segment: Segment, line: string): boolean {
    return line in segment.lines || this.sections.some(section => section.line === line && section.segments.includes(segment));
  }

  /**
   * Straight track between two stations.
   *
   * @param stationA - One end.
   * @param stationB - The other.
   * @returns The new segment, with no lines yet.
   */
  private lay(stationA: string, stationB: string): Segment {
    // Within bounds: the schema checks every station of a plan exists.
    const coordinates: LngLat[] = [this.network.stations[stationA]!.coordinate, this.network.stations[stationB]!.coordinate];
    const segment: Segment = { stationA, stationB, lines: {}, coordinates };
    this.network.segments.push(segment);
    return segment;
  }

  /**
   * Splits a segment at the point on it nearest a station, the track brought to the station there:
   * two segments in its place, each with its lines, its dated ones and the sections' alike.
   *
   * @param segment - The segment.
   * @param station - The station to stand on it.
   */
  private split(segment: Segment, station: string): void {
    // Within bounds: the schema checks every station of a plan exists.
    const place = this.network.stations[station]!.coordinate;
    const [first, second] = splitTrack(segment.coordinates, place);
    // The halves meet at the station itself, not beside it on the track.
    const halves: Segment[] = [
      { ...segment, stationB: station, coordinates: [...first.slice(0, -1), place] },
      { ...segment, stationA: station, coordinates: [place, ...second.slice(1)] },
    ];
    this.network.segments.splice(this.network.segments.indexOf(segment), 1, ...halves);
    for (const section of this.sections) section.segments = section.segments.flatMap(item => (item === segment ? halves : [item]));
  }
}
