import { toTimestamp } from '@railtime/core/date.utils';
import { NetworkFacts } from '@railtime/network/facts.service';
import { tinyNetwork } from '@railtime/network/testing/tinyNetwork';
import { planId } from '@railtime/schema/testing/ids';
import { describe, expect, test } from 'vitest';
import { arrivalPlayhead, arrivalTimeOf, timeStateOf } from '../../src/transitMap.utils';

const today = toTimestamp('2026-01-01');
const asBuilt = () => NetworkFacts.create(tinyNetwork(), { today });
const planned = () => NetworkFacts.create(tinyNetwork(), { plan: planId('extension'), today });

describe('TransitMapUtils', () => {
  describe('arrivalPlayhead', () => {
    test('rests without a moment: today, or a plan built', () => {
      expect(arrivalPlayhead(asBuilt().playheads, null)).toEqual(asBuilt().playheads.today());
      expect(arrivalPlayhead(planned().playheads, null)).toEqual(planned().playheads.end());
    });

    test('stands on the moment asked for, on the network given', () => {
      const day = toTimestamp('1905-01-01');
      expect(arrivalPlayhead(planned().playheads, { day })).toEqual(planned().playheads.on(day));
    });
  });

  describe('timeStateOf', () => {
    test('says of a playhead what the facts count there, and how the map stands', () => {
      const facts = asBuilt();
      const { playheads } = facts;
      const drawn = timeStateOf(facts, playheads.after(1, 0.5), { inPlan: false, playing: true });
      expect(drawn).toMatchObject({ ...playheads.after(1, 0.5), playing: true, atToday: false, atRest: false });
      expect(drawn.stats).toEqual(facts.asOf(playheads.after(1, 0.5)).stats());
      expect(timeStateOf(facts, playheads.today(), { inPlan: false, playing: false })).toMatchObject({ atToday: true, atRest: true });
    });
  });

  describe('arrivalTimeOf', () => {
    test('says of a network what its map will, paused where it arrives', () => {
      const facts = planned();
      expect(arrivalTimeOf(facts, null)).toMatchObject({ ...facts.playheads.end(), atRest: true, inPlan: true, playing: false });
      expect(arrivalTimeOf(facts, null).stats).toEqual(facts.asOf(facts.playheads.end()).stats());
    });
  });
});
