import { describe, expect, test } from 'vitest';
import { NetworkFacts } from '../../../src/facts/facts.service';
import { tinyNetwork } from '../../support/factories/tinyNetwork.utils';
import { tightestHeadway } from '../../support/trains.utils';

describe('TrainService', () => {
  const facts = NetworkFacts.create(tinyNetwork());
  const service = facts.engine.trainService(facts.engine.timeline.cursorAt(Date.UTC(1935, 0, 1)));

  test("runs at least a train on each of a network's routes, and counts them", () => {
    expect(service.fleet).toBeGreaterThanOrEqual(service.timetables.length);
  });

  test('says where each train in sight is, on a route of the network, from the clock alone', () => {
    const places = service.placesAt(5);
    expect(places.length).toBeGreaterThan(0);
    expect(places.every(({ run, km }) => km >= 0 && km <= run.lengthKm)).toBe(true);
    expect(service.placesAt(5)).toEqual(places);
  });

  test("keeps a line's trains apart on the track they share", () => {
    expect(tightestHeadway(service)).toBeGreaterThan(60);
  });
});
