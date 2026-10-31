import { yearOf } from '@railtime/core/date.utils';
import type { CityBoundary } from '@railtime/schema/boundary.types';
import type { Bounds } from '@railtime/core/geometry.types';
import type { NetworkIndex } from '../network/index.service';
import type { Timeline } from '../network/timeline.service';
import type { CoverageCells, CoverageInfo, CoverageYear } from '../facts/facts.types';
import { CoverageGrid } from './grid.service';
import { COVERAGE_BANDS, COVERAGE_HEADLINE_METRES } from './measure.constants';
import { cellBands, coverageHistory, coverageOf, servedStations } from './measure.utils';

/**
 * A city's coverage on its network: how much of its outline is within walking distance of a station
 * open at a cursor, what the map draws of it, and how that grew year by year. Pure: it draws nothing.
 */
export class CoverageMeasure {
  /** The city's outline. */
  public readonly boundary: CityBoundary;
  /** The outline, cut into cells. */
  public readonly grid: CoverageGrid;
  /** The network. */
  private readonly index: NetworkIndex;
  /** Its timeline. */
  private readonly timeline: Timeline;
  /** Today, which the history runs to. */
  private readonly today: number;
  /** The covered share year by year, worked out the first time it is asked for. */
  private years: CoverageYear[] | null = null;

  public constructor(boundary: CityBoundary, index: NetworkIndex, timeline: Timeline, today: number) {
    this.boundary = boundary;
    this.today = today;
    this.grid = new CoverageGrid(boundary);
    this.index = index;
    this.timeline = timeline;
  }

  /**
   * How much of the city is within walking distance of a station open at a cursor.
   *
   * @param cursor - The timeline's cursor.
   * @returns The share in each band and within the headline distance.
   */
  public info(cursor: number): CoverageInfo {
    const { name, source } = this.boundary;
    return { name, source, ...coverageOf(this.grid, this.distances(cursor), COVERAGE_BANDS, COVERAGE_HEADLINE_METRES) };
  }

  /**
   * The share of the city within the headline distance of a station at the end of each year, from
   * the timeline's start to today's.
   *
   * @returns A share for each year, oldest first.
   */
  public history(): CoverageYear[] {
    const years: [number, number] = [yearOf(this.timeline.start), yearOf(this.today)];
    this.years ??= coverageHistory(this.index, this.timeline, this.grid, years, COVERAGE_HEADLINE_METRES);
    return this.years;
  }

  /**
   * The city's south-west and north-east corners, for the camera to frame.
   *
   * @returns The corners.
   */
  public get bounds(): Bounds {
    const [, northEast, , southWest] = this.grid.corners;
    return [southWest, northEast];
  }

  /**
   * The city cell by cell at a cursor, each in its band: what a picture of its coverage is drawn from.
   *
   * @param cursor - The timeline's cursor.
   * @returns The cells, where they lie, and the bands.
   */
  public cells(cursor: number): CoverageCells {
    const { columns, rows, corners } = this.grid;
    return { columns, rows, corners, bands: COVERAGE_BANDS, cells: cellBands(this.grid, this.distances(cursor), COVERAGE_BANDS) };
  }

  /**
   * How far each cell is from the nearest station open at a cursor, up to the farthest band.
   *
   * @param cursor - The timeline's cursor.
   * @returns Metres, cell by cell.
   */
  private distances(cursor: number): Float32Array {
    const farthest = COVERAGE_BANDS.at(-1)?.upTo ?? COVERAGE_HEADLINE_METRES;
    return this.grid.distances(servedStations(this.index, this.timeline, cursor), farthest);
  }
}
