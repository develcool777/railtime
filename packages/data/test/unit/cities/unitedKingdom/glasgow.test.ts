import { playbackOf } from '@railtime/renderer/testing/playback';
import { lineId, planId } from '@railtime/schema/testing/ids';
import { describe, expect, test } from 'vitest';
import { cityNetwork, lineSplits, playPlan, playWholeHistory } from '../../../support/history.utils';

describe('Glasgow', () => {
  describe('trains', () => {
    const { facts } = playbackOf(cityNetwork('glasgow'));
    const service = facts.engine.trainService(facts.playheads.end().cursor);

    test('takes about the 24 minutes a real train takes round the circle', () => {
      const laps = service.timetables.map(({ tripSeconds }) => tripSeconds / 60);
      expect(laps).toEqual([expect.closeTo(24, 0), expect.closeTo(24, 0)]);
    });

    test('runs the Outer Circle clockwise and the Inner anticlockwise, each one way only', () => {
      const swept = (line: string) => {
        const { run } = service.timetables.find(timetable => timetable.run.line === lineId(line))!;
        const points = run.legs.map(({ segment, forward }) => (forward ? segment.coordinates : segment.reversedCoordinates)[0]!);
        let area = 0;
        for (const [place, [fromX, fromY]] of points.entries()) {
          const [toX, toY] = points[place + 1] ?? points[0] ?? [fromX, fromY];
          area += fromX * toY - toX * fromY;
        }
        return Math.sign(area) * (run.oneWay ?? 0);
      };
      expect(swept('outer')).toBe(-1);
      expect(swept('inner')).toBe(1);
    });

    test('never takes a train out of sight, there being no terminus', () => {
      expect(service.placesAt(600)).toHaveLength(service.fleet);
      expect(service.placesAt(1234)).toHaveLength(service.fleet);
    });
  });

  test('keeps each line in one piece, but where its history parts it', () => {
    expect(lineSplits(cityNetwork('glasgow'))).toEqual([]);
  });

  test('plays its whole history, every step, drawing frames without errors', () => {
    const played = playWholeHistory(cityNetwork('glasgow'));
    expect(played.started).toBe(played.steps);
    expect(played.cursor).toBe(played.steps);
  });

  test.each(['long-term-strategy-2010', 'stds-1988', 'extensions-1954', 'eastern-circle-1944', 'extensions-1937'])(
    'plays on through its %s plan, section by section',
    plan => {
      const played = playPlan(cityNetwork('glasgow'), planId(plan));
      expect(played.steps).toBeGreaterThan(0);
      expect(played.started).toBe(played.steps);
      expect(played.cursor).toBe(played.steps);
    },
  );
});
