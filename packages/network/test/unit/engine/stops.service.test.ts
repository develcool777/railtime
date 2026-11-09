import { lineId, stationId } from '@railtime/schema/testing/ids';
import { describe, expect, test } from 'vitest';
import { StationStops } from '../../../src/engine/stops.service';

describe('StationStops', () => {
  test('calls at a station not on its record, from the start and for good', () => {
    const stops = new StationStops();
    expect([
      stops.serves(stationId('a'), lineId('red'), 0),
      stops.serves(stationId('a'), lineId('red'), 1000),
      stops.ever(stationId('a'), lineId('red')),
    ]).toEqual([true, true, true]);
  });

  test('calls from after its opening step to its closing step, but through no spell closed', () => {
    const stops = new StationStops();
    Object.assign(stops.stopOf(stationId('a'), lineId('red')), { opens: 2, closes: 9 });
    stops.stopOf(stationId('a'), lineId('red')).spells.push({ closes: 4, reopens: 6 });
    expect([1, 2, 3, 4, 5, 6, 7, 9, 10].map(cursor => stops.serves(stationId('a'), lineId('red'), cursor))).toEqual([
      false,
      false,
      true,
      true,
      false,
      false,
      true,
      true,
      false,
    ]);
  });

  test('never calls where it passes, on every cursor', () => {
    const stops = new StationStops();
    stops.stopOf(stationId('a'), lineId('red')).never = true;
    expect([stops.serves(stationId('a'), lineId('red'), 5), stops.ever(stationId('a'), lineId('red')), stops.ever(stationId('a'), lineId('blue'))]).toEqual([
      false,
      false,
      true,
    ]);
  });
});
