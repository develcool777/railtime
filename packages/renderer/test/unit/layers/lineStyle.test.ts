import { describe, expect, test } from 'vitest';
import { offsetFor, resolveLine } from '../../../src/layers/lineStyle.utils';
import { toTimestamp } from '../../../src/core/date.utils';
import { tinyNetwork } from '../../support/factories/tinyNetwork.utils';
import { playbackOf, renderStateOf } from '../../support/playback.utils';

describe('LineStyleUtils', () => {
  describe('resolveLine', () => {
    test('draws a line as the line it is shown as, and blends the colours while it becomes its own', () => {
      const playback = playbackOf(tinyNetwork());
      playback.player.seek(toTimestamp('1950-06-01'));
      expect(resolveLine(renderStateOf(playback), 'pink')).toEqual({ id: 'red', color: '#ff0000' });
      playback.player.seek(toTimestamp('2000-01-01'));
      expect(resolveLine(renderStateOf(playback), 'pink')).toEqual({ id: 'pink', color: '#ff88cc' });
      // Pink's own colour fades in from red's as its identity step plays.
      const identity = playback.timeline.steps.find(step => step.kind === 'identity')!;
      playback.player.seekBefore(identity.index);
      const blended = (progress: number) => resolveLine({ ...renderStateOf(playback), identityProgress: progress }, 'pink').color;
      expect([blended(0), blended(0.5), blended(1)]).toEqual(['#ff0000', '#ff4466', '#ff88cc']);
    });
  });

  describe('offsetFor', () => {
    test('puts lines side by side about the middle, in the direction of travel', () => {
      const playback = playbackOf(tinyNetwork());
      const segment = playback.index.segments[0]!;
      const sideBySide = new Map([[segment.index, ['red', 'blue', 'green']]]);
      expect(['red', 'blue', 'green'].map(line => offsetFor(sideBySide, segment, line))).toEqual([-1, 0, 1].map(slot => slot * segment.travel));
      expect(offsetFor(new Map(), segment, 'red')).toBe(0);
    });
  });
});
