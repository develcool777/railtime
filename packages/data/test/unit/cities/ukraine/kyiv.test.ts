import { byCodeUnits } from '@railtime/core/text.utils';
import { playbackOf } from '@railtime/renderer/testing/playback';
import { lineId, planId } from '@railtime/schema/testing/ids';
import { describe, expect, test } from 'vitest';
import { cityNetwork, lineSplits, playPlan, playWholeHistory } from '../../../support/history.utils';

describe('Kyiv', () => {
  test('keeps each line in one piece, but where its history parts it', () => {
    expect(lineSplits(cityNetwork('kyiv'))).toEqual([]);
  });

  test('plays its whole history, every step, drawing frames without errors', () => {
    const played = playWholeHistory(cityNetwork('kyiv'));
    expect(played.started).toBe(played.steps);
    expect(played.cursor).toBe(played.steps);
    // The first line's five stations of 1960: no later opening added more at once.
    expect(played.mostHighlighted).toBe(5);
  });

  test('runs a train the whole way to each end of a fork, in the 2070 concept', () => {
    const { facts } = playbackOf(cityNetwork('kyiv'), { plan: planId('kyiv-2070') });
    const runs = facts.engine
      .trainService(facts.playheads.end().cursor)
      .timetables.map(({ run }) => run)
      .filter(run => run.line === lineId('m2'));
    expect(runs.map(run => run.ends.toSorted(byCodeUnits).join('–')).toSorted(byCodeUnits)).toEqual([
      'heroiv-dnipra–odeska',
      'heroiv-dnipra–vulytsia-dmytra-lutsenka',
    ]);
  });

  test.each(['under-construction', 'long-term', 'kyiv-2070'])('plays on through its %s plan, section by section', plan => {
    const played = playPlan(cityNetwork('kyiv'), planId(plan));
    expect(played.steps).toBeGreaterThan(0);
    expect(played.started).toBe(played.steps);
    expect(played.cursor).toBe(played.steps);
  });
});
