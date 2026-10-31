import { describe, expect, test } from 'vitest';
import { toTimestamp } from '../../../src/core/date.utils';
import { buildNetworkSnapshot } from '../../../src/layers/snapshot.utils';
import { createStepAnimation, describeSteps, emptyDrawing } from '../../../src/steps/animation.utils';
import { tinyNetwork } from '../../support/factories/tinyNetwork.utils';
import { playbackOf, renderStateOf } from '../../support/playback.utils';

describe('StepAnimationUtils', () => {
  describe('describeSteps', () => {
    test('describes every step as its caption, planned ones last and undated', () => {
      const playback = playbackOf(tinyNetwork(), 'extension');
      const changes = describeSteps(renderStateOf(playback));
      expect(changes.map(change => change.index)).toEqual(playback.timeline.steps.map(step => step.index));
      expect(changes[0]).toMatchObject({ kind: 'open', time: toTimestamp('1900-01-01'), title: 'Red line opens', color: '#ff0000' });
      expect(changes.slice(-2).map(change => change.time)).toEqual([null, null]);
      expect(changes.at(-2)).toMatchObject({ title: 'Red line extended', subtitle: 'D – E' });
    });
  });

  describe('createStepAnimation', () => {
    test('gives every kind of step an animation that frames, describes and draws it from start to end', () => {
      const playback = playbackOf(tinyNetwork(), 'extension');
      const { index, timeline } = playback;
      const kinds = new Set<string>();
      for (const step of timeline.steps) {
        playback.player.seekBefore(step.index);
        const animation = createStepAnimation(step, { index, timeline, stationsBefore: timeline.stationsOnMap(step.index) });
        kinds.add(step.kind);
        expect(animation.step).toBe(step);
        expect(animation.drawSeconds).toBeGreaterThan(0);
        expect(animation.holdSeconds).toBeGreaterThan(0);
        expect(animation.cameraPoints().length).toBeGreaterThan(0);
        const state = { ...renderStateOf(playback), identityProgress: animation.changesIdentity ? 0.5 : null };
        expect(animation.describe(state)).toMatchObject({ kind: step.kind, time: step.planned ? null : step.time });
        const snapshot = buildNetworkSnapshot(state, true);
        for (const [progress, holdProgress] of [
          [0, 0],
          [0.5, 0],
          [1, 0],
          [1, 0.5],
          [1, 1],
        ] as const) {
          const drawing = emptyDrawing();
          animation.draw({ state, snapshot, progress, holdProgress }, drawing);
          // Whatever it draws is in some line's colour, and a closing station never fades beyond nothing.
          for (const feature of drawing.lines.features) expect(feature.properties.color).toMatch(/^#[0-9a-f]{6}$/);
          for (const opacity of drawing.fading.values()) expect(opacity).toBeGreaterThanOrEqual(0);
        }
      }
      expect(kinds).toEqual(new Set(['open', 'close', 'infill', 'stationClose', 'rename', 'identity']));
    });
  });
});
