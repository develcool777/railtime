import { toTimestamp } from '@railtime/core/date.utils';
import type { CoverageCells, RouteInfo, RouteLegInfo } from '@railtime/network/facts.types';
import { TINY_WITH_HOLE as CITY } from '@railtime/network/testing/boundaries';
import { tinyNetwork } from '@railtime/network/testing/tinyNetwork';
import { lineId, stationId } from '@railtime/schema/testing/ids';
import { describe, expect, test } from 'vitest';
import { COVERAGE_ALPHA, UNCOVERED_ALPHA } from '../../../src/overlay/overlay.constants';
import { coverageDrawing, coverageImage, reachStops, reachTrack, routeStopMarks, routeStops, routeTrack } from '../../../src/overlay/overlay.utils';
import { networkNow, playbackOf } from '../../support/playback.utils';
/** How far one gets from A in 1955, when red runs A–B–C–D, and the network it is found on. */
const reachFromA = () => {
  const playback = playbackOf(tinyNetwork());
  playback.player.seek(playback.facts.playheads.on(toTimestamp('1955-01-01')));
  return { playback, reach: networkNow(playback).reach(stationId('a'))! };
};

/** A city of 2 × 2 cells: one in each of two bands, one beyond them, one outside. */
const CELLS: CoverageCells = {
  columns: 2,
  rows: 2,
  corners: [
    [0, 1],
    [1, 1],
    [1, 0],
    [0, 0],
  ],
  bands: [
    { upTo: 400, label: 'near', color: '#0b7a75' },
    { upTo: 800, label: 'farther', color: '#1fa89f' },
  ],
  cells: Int8Array.from([0, 1, 2, -1]),
};

/**
 * A ride on a line through stops named by their ids.
 *
 * @param color - The line's colour in the light theme, which is its id too; in the dark, upper case.
 * @param stops - The stops' ids, from where it is boarded.
 * @returns The leg.
 */
const ride = (color: string, stops: string[]): RouteLegInfo => ({
  kind: 'ride',
  line: lineId(color),
  lineName: color,
  color: { light: color, dark: color.toUpperCase() },
  stops: stops.map(id => ({ id: stationId(id), name: id.toUpperCase() })),
  minutes: 0,
  km: 0,
});

/**
 * A route made of legs, from the first stop of the first to the given end.
 *
 * @param legs - Its legs.
 * @param to - Where it ends.
 * @returns The route.
 */
const routeOf = (legs: RouteLegInfo[], to: string): RouteInfo => ({
  from: { id: stationId('a'), name: 'A' },
  to: { id: stationId(to), name: to.toUpperCase() },
  legs,
  minutes: 0,
  km: 0,
  changes: legs.length - 1,
  segments: [],
  best: [],
});

describe('OverlayUtils', () => {
  /** A route from A to D in 1935, along red, and the network it runs on. */
  const routeAtoD = () => {
    const playback = playbackOf(tinyNetwork());
    playback.player.seek(playback.facts.playheads.on(toTimestamp('1935-01-01')));
    return { index: playback.index, route: networkNow(playback).routes(stationId('a'), stationId('d'))[0]! };
  };

  describe('routeTrack', () => {
    test("draws each ride along its segments in its line's colour, a walk straight, and nothing without a route", () => {
      const { index, route } = routeAtoD();
      expect(routeTrack(index, route, 'light').map(feature => [feature.properties, feature.geometry.coordinates])).toEqual(
        [0, 1, 2].map(segment => [{ color: '#ff0000', walk: false }, index.segments[segment]!.coordinates]),
      );
      const walk = { ...route, legs: [{ kind: 'walk' as const, from: route.from, to: route.to, minutes: 5 }], segments: [[]] };
      expect(routeTrack(index, walk, 'light')).toEqual([
        {
          type: 'Feature',
          properties: { color: '', walk: true },
          geometry: { type: 'LineString', coordinates: [index.coordOf(stationId('a')), index.coordOf(stationId('d'))] },
        },
      ]);
      expect(routeTrack(index, null, 'light')).toEqual([]);
    });
  });

  describe('routeStops', () => {
    test('marks each stop where it is, and none without a route', () => {
      const { index, route } = routeAtoD();
      const stops = routeStops(index, route, 'light');
      expect(stops.map(stop => [stop.properties.name, stop.properties.kind])).toEqual([
        ['A', 'board'],
        ['B', 'pass'],
        ['C', 'pass'],
        ['D', 'end'],
      ]);
      expect(stops[0]?.geometry.coordinates).toEqual(index.coordOf(stationId('a')));
      expect(routeStops(index, null, 'light')).toEqual([]);
    });
  });

  describe('routeStopMarks', () => {
    test('rings where each ride begins, passes the stops between, ends at the last', () => {
      const marks = routeStopMarks(routeOf([ride('red', ['a', 'b', 'c']), ride('blue', ['c', 'd', 'e'])], 'e'), 'light');
      expect(marks.map(entry => [entry.station, entry.kind, entry.color])).toEqual([
        ['a', 'board', 'red'],
        ['b', 'pass', 'red'],
        ['c', 'board', 'blue'],
        ['d', 'pass', 'blue'],
        ['e', 'end', 'blue'],
      ]);
    });

    test("colours each mark in its line's colour for the theme asked for", () => {
      const marks = routeStopMarks(routeOf([ride('red', ['a', 'b'])], 'b'), 'dark');
      expect(marks.map(entry => entry.color)).toEqual(['RED', 'RED']);
    });

    test('rings both ends of a walk, as changes', () => {
      const walk: RouteLegInfo = { kind: 'walk', from: { id: stationId('c'), name: 'C' }, to: { id: stationId('x'), name: 'X' }, minutes: 3 };
      const marks = routeStopMarks(routeOf([ride('red', ['a', 'c']), walk, ride('blue', ['x', 'e'])], 'e'), 'light');
      expect(marks.map(entry => [entry.station, entry.kind])).toEqual([
        ['a', 'board'],
        ['c', 'board'],
        ['x', 'board'],
        ['e', 'end'],
      ]);
    });
  });

  describe('reachTrack', () => {
    test("draws each segment the reach colours along its track, in its band's colour, and nothing without a reach", () => {
      const { playback, reach } = reachFromA();
      const track = reachTrack(playback.index, reach);
      expect(track.map(feature => feature.geometry.coordinates)).toEqual(reach.track.map(({ segment }) => playback.index.segments[segment]!.coordinates));
      expect(track.map(feature => feature.properties.color)).toEqual(reach.track.map(({ band }) => reach.bands[band]!.color));
      expect(reachTrack(playback.index, null)).toEqual([]);
    });
  });

  describe('reachStops', () => {
    test('names the start apart and every other station with its time, and nothing without a reach', () => {
      const { playback, reach } = reachFromA();
      const stops = reachStops(playback.index, reach);
      expect(stops[0]?.properties).toEqual({ color: reach.bands[0]!.color, label: 'A', minutes: 0, origin: true });
      expect(stops.slice(1).map(stop => stop.properties.label)).toEqual(reach.stations.map(station => `${station.name} · ${Math.round(station.minutes)} min`));
      expect(stops.every(stop => !stop.properties.origin || stop === stops[0])).toBe(true);
      expect(reachStops(playback.index, null)).toEqual([]);
    });
  });

  describe('coverageImage', () => {
    test("colours each cell in its band's colour, tints the rest of the city, and leaves outside it clear", () => {
      const pixels = coverageImage(CELLS);
      const pixelAt = (cell: number) => [...pixels.slice(cell * 4, cell * 4 + 4)];
      expect(pixelAt(0)).toEqual([0x0b, 0x7a, 0x75, COVERAGE_ALPHA]);
      expect(pixelAt(1)).toEqual([0x1f, 0xa8, 0x9f, COVERAGE_ALPHA]);
      expect(pixelAt(2)).toEqual([0x80, 0x80, 0x80, UNCOVERED_ALPHA]);
      expect(pixelAt(3)).toEqual([0, 0, 0, 0]);
    });
  });

  describe('coverageDrawing', () => {
    test("draws the city's picture where it lies, and every ring of the outline", () => {
      const { facts, timeline } = playbackOf(tinyNetwork());
      const cells = facts.coverage(CITY).cells(timeline.cursorAt(toTimestamp('1915-01-01')), 1200);
      const drawing = coverageDrawing(cells, CITY);
      expect(drawing.image).toEqual({ width: cells.columns, height: cells.rows, pixels: coverageImage(cells) });
      expect(drawing.corners).toEqual(cells.corners);
      expect(drawing.outline.map(feature => feature.geometry.coordinates)).toEqual(CITY.polygons[0]);
    });
  });
});
