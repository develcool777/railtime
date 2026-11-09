import type { TrackSegment } from '@railtime/network/engine.types';
import { engineOf } from '@railtime/network/engine.utils';
import { NetworkFacts } from '@railtime/network/facts.service';
import { tinyNetwork } from '@railtime/network/testing/tinyNetwork';
import type { TrainRun } from '@railtime/network/trains.types';
import { lineId, stationId } from '@railtime/schema/testing/ids';
import { describe, expect, test } from 'vitest';
import { buildNetworkSnapshot } from '../../../src/layers/snapshot.utils';
import type { RenderState } from '../../../src/layers/style.types';
import { TRAIN_LENGTH_KM } from '../../../src/layers/trains.constants';
import { stretchOf, trainsAt, trainStretchOf } from '../../../src/layers/trains.utils';
import { UNTOUCHED_BASE } from '../../../src/steps/animation.constants';

/** One km of straight track, A to B, as far along it at each point. */
const SEGMENT = {
  index: 0,
  stationA: stationId('a'),
  stationB: stationId('b'),
  coordinates: [
    [0, 0],
    [1, 0],
    [2, 0],
  ],
  distances: [0, 0.5, 1],
  lengthKm: 1,
  travel: 1,
} as unknown as TrackSegment;

/** A run three km long. */
const RUN: TrainRun = { line: lineId('red'), mode: 'metro', ends: [stationId('a'), stationId('b')], legs: [], lengthKm: 3, stopsKm: [] };

describe('TrainUtils', () => {
  describe('trainStretchOf', () => {
    test('takes up track behind the way it heads', () => {
      expect(trainStretchOf({ run: RUN, km: 1, heading: 1 })).toEqual([1 - TRAIN_LENGTH_KM, 1]);
      expect(trainStretchOf({ run: RUN, km: 1, heading: -1 })).toEqual([1, 1 + TRAIN_LENGTH_KM]);
    });

    test('stands whole at either end of the run, never off it', () => {
      expect(trainStretchOf({ run: RUN, km: 0, heading: 1 })).toEqual([0, TRAIN_LENGTH_KM]);
      expect(trainStretchOf({ run: RUN, km: 3, heading: -1 })).toEqual([3 - TRAIN_LENGTH_KM, 3]);
    });
  });

  describe('stretchOf', () => {
    test('takes the track between two points along it, with the corners between', () => {
      expect(stretchOf(SEGMENT, 0.25, 0.75)).toEqual([
        [0.5, 0],
        [1, 0],
        [1.5, 0],
      ]);
    });
  });

  describe('trainsAt', () => {
    const facts = NetworkFacts.create(tinyNetwork());
    const { index, timeline } = engineOf(facts);
    const cursor = timeline.cursorAt(Date.UTC(1935, 0, 1));
    const state: RenderState = { index, timeline, cursor, base: UNTOUCHED_BASE, baseColor: line => facts.colorOf(line).dark };
    const snapshot = buildNetworkSnapshot(state);
    const places = engineOf(facts).trainService(cursor).placesAt(3);

    test('draws each train on track of its line', () => {
      const trains = trainsAt(places, state, snapshot.sideBySide);
      expect(trains.length).toBeGreaterThanOrEqual(places.length);
      expect(trains.map(train => train.path.flat().length)).toEqual(trains.map(train => train.path.length * 2));
      expect(new Set(trains.map(train => train.group))).toEqual(new Set(places.map(({ run }) => timeline.drawnAs(run.line, cursor))));
    });

    test('says the line as drawn: one drawn as another is that line, as focus reads it', () => {
      const pinkAsRed = timeline.cursorAt(Date.UTC(1985, 0, 1));
      const stateThen: RenderState = { ...state, cursor: pinkAsRed };
      const placesThen = engineOf(facts).trainService(pinkAsRed).placesAt(3);
      expect(placesThen.map(({ run }) => run.line)).toContain('pink');
      const trains = trainsAt(placesThen, stateThen, buildNetworkSnapshot(stateThen).sideBySide);
      expect(trains.map(train => train.group)).not.toContain('pink');
    });

    test('sits on its own line on shared track: as far across as the line is drawn', () => {
      const offsets = trainsAt(places, state, snapshot.sideBySide).map(train => train.slot);
      const drawn = new Set(snapshot.lines.features.map(line => line.properties.offset));
      expect(offsets.every(offset => drawn.has(offset))).toBe(true);
    });
  });
});
