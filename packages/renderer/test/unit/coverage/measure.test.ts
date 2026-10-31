import type { CityBoundary } from '@railtime/schema/boundary.types';
import { describe, expect, test } from 'vitest';
import { toTimestamp } from '../../../src/core/date.utils';
import { CoverageGrid } from '../../../src/coverage/grid.service';
import { COVERAGE_BANDS, COVERAGE_HEADLINE_METRES } from '../../../src/coverage/layer.constants';
import { coverageHistory, coverageImage, coverageOf, servedStations } from '../../../src/coverage/layer.utils';
import { CoverageMeasure } from '../../../src/coverage/measure.service';
import { tinyNetwork } from '../../support/factories/tinyNetwork.utils';
import { playbackOf } from '../../support/playback.utils';

/** Degrees of longitude and latitude in a km, at 51.5° north. */
const KM_EAST = 0.0144;
const KM_NORTH = 1 / 110.57;

/** A city round the tiny network: A to D, 0 to 3 km east, with 2 km to spare all round, and a hole. */
const CITY: CityBoundary = {
  name: 'Tiny',
  source: 'test',
  polygons: [
    [
      [
        [-2 * KM_EAST, 51.5 - 2 * KM_NORTH],
        [5 * KM_EAST, 51.5 - 2 * KM_NORTH],
        [5 * KM_EAST, 51.5 + 2 * KM_NORTH],
        [-2 * KM_EAST, 51.5 + 2 * KM_NORTH],
        [-2 * KM_EAST, 51.5 - 2 * KM_NORTH],
      ],
      [
        [3.5 * KM_EAST, 51.5 + KM_NORTH],
        [4.5 * KM_EAST, 51.5 + KM_NORTH],
        [4.5 * KM_EAST, 51.5 + 1.5 * KM_NORTH],
        [3.5 * KM_EAST, 51.5 + KM_NORTH],
      ],
    ],
  ],
};

describe('CoverageMeasure', () => {
  test("measures the city on the network at a cursor, named by its outline, as the grid's helpers do", () => {
    const { index, timeline } = playbackOf(tinyNetwork());
    const measure = new CoverageMeasure(CITY, index, timeline, toTimestamp('1925-06-01'));
    const grid = new CoverageGrid(CITY);
    const cursor = timeline.cursorAt(toTimestamp('1915-01-01'));
    const distances = grid.distances(servedStations(index, timeline, cursor), COVERAGE_BANDS.at(-1)!.upTo);
    expect(measure.info(cursor)).toEqual({ name: 'Tiny', source: 'test', ...coverageOf(grid, distances, COVERAGE_BANDS, COVERAGE_HEADLINE_METRES) });
    // Before the first line, nothing is near a station.
    expect(measure.info(0).share).toBe(0);
  });

  test("draws the grid's picture where it lies, and every ring of the outline", () => {
    const { index, timeline } = playbackOf(tinyNetwork());
    const measure = new CoverageMeasure(CITY, index, timeline, toTimestamp('1925-06-01'));
    const grid = new CoverageGrid(CITY);
    const cursor = timeline.cursorAt(toTimestamp('1915-01-01'));
    const drawing = measure.drawing(cursor);
    const distances = grid.distances(servedStations(index, timeline, cursor), COVERAGE_BANDS.at(-1)!.upTo);
    expect(drawing.image).toEqual({ width: grid.columns, height: grid.rows, pixels: coverageImage(grid, distances, COVERAGE_BANDS) });
    expect(drawing.corners).toEqual(grid.corners);
    expect(drawing.outline.map(feature => feature.geometry.coordinates)).toEqual(CITY.polygons[0]);
  });

  test('works out the history from the timeline’s first year to today’s once, and frames the city', () => {
    const { index, timeline } = playbackOf(tinyNetwork());
    const measure = new CoverageMeasure(CITY, index, timeline, toTimestamp('1925-06-01'));
    const history = measure.history();
    const first = new Date(timeline.start).getUTCFullYear();
    expect(history).toEqual(coverageHistory(index, timeline, new CoverageGrid(CITY), [first, 1925], COVERAGE_HEADLINE_METRES));
    expect(measure.history()).toBe(history);
    expect(measure.bounds).toEqual([
      [-2 * KM_EAST, 51.5 - 2 * KM_NORTH],
      [5 * KM_EAST, 51.5 + 2 * KM_NORTH],
    ]);
  });
});
