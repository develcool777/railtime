import { lineId, stationId } from '@railtime/schema/testing/ids';
import { describe, expect, test } from 'vitest';
import { REACH_BANDS } from '../../../src/facts/facts.constants';
import { bandOf, byOpening, linesAsDrawn, reachedSegments } from '../../../src/facts/facts.utils';

describe('FactsUtils', () => {
  describe('linesAsDrawn', () => {
    const drawn = lineId('red');

    test('makes lines drawn as one a single line, from the first of them to open', () => {
      expect(
        linesAsDrawn([
          { drawn, opened: '1910-01-01', closed: undefined },
          { drawn, opened: '1900-01-01', closed: '1950-01-01' },
        ]),
      ).toEqual([{ drawn, opened: '1900-01-01', closed: undefined }]);
    });

    test('closes them when the last has closed', () => {
      expect(
        linesAsDrawn([
          { drawn, opened: '1910-01-01', closed: '1960-01-01' },
          { drawn, opened: '1900-01-01', closed: '1950-01-01' },
        ]),
      ).toEqual([{ drawn, opened: '1900-01-01', closed: '1960-01-01' }]);
    });

    test('keeps a plan with no date undated only if none of them has one', () => {
      expect(linesAsDrawn([{ drawn, opened: null, closed: undefined }])).toEqual([{ drawn, opened: null, closed: undefined }]);
      expect(
        linesAsDrawn([
          { drawn, opened: null, closed: undefined },
          { drawn, opened: '1900-01-01', closed: undefined },
        ]),
      ).toEqual([{ drawn, opened: '1900-01-01', closed: undefined }]);
    });
  });

  describe('byOpening', () => {
    test("orders a station's lines by when they opened there, a plan's undated ones last", () => {
      const line = (opened: string | null) => ({ id: lineId('red'), name: 'Red', color: { light: '', dark: '' }, opened: opened as never, calls: true });
      expect(byOpening(line('1900-01-01'), line('1910-01-01'))).toBeLessThan(0);
      expect(byOpening(line(null), line('1910-01-01'))).toBeGreaterThan(0);
    });
  });

  describe('bandOf', () => {
    test('puts a time in the first band it fits, its end included', () => {
      expect(bandOf(0)).toBe(0);
      expect(bandOf(15)).toBe(0);
      expect(bandOf(15.5)).toBe(1);
      expect(bandOf(59)).toBe(3);
    });

    test('puts anything longer in the last band', () => {
      expect(bandOf(240)).toBe(REACH_BANDS.length - 1);
    });
  });

  describe('reachedSegments', () => {
    const segments = [
      { index: 0, stationA: stationId('a'), stationB: stationId('b') },
      { index: 1, stationA: stationId('b'), stationB: stationId('c') },
      { index: 2, stationA: stationId('x'), stationB: stationId('y') },
    ];

    test('times a segment by the mean of its ends, or its one end reached', () => {
      const minutes = new Map([
        [stationId('a'), 0],
        [stationId('b'), 10],
      ]);
      expect(reachedSegments(minutes, segments)).toEqual([
        { segment: 0, minutes: 5 },
        { segment: 1, minutes: 10 },
      ]);
    });

    test('leaves out a segment with neither end reached', () => {
      expect(reachedSegments(new Map(), segments)).toEqual([]);
    });
  });
});
