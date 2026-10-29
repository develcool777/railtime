import { describe, expect, test } from 'vitest';
import { buildNetworkSnapshot } from '../../../src/layers/networkSnapshot.utils';
import { toTimestamp } from '../../../src/model/date.utils';
import { tinyNetwork } from '../../support/factories/tinyNetwork.utils';
import { londonNetwork } from '../../support/fixtures/datasets.utils';
import { playbackOf, renderStateOf } from '../../support/playback.utils';

describe('NetworkSnapshotUtils', () => {
  describe('buildNetworkSnapshot', () => {
    test('counts what is on the map at a date, with shared track side by side', () => {
      const playback = playbackOf(tinyNetwork());
      playback.player.seek(toTimestamp('1935-01-01'));
      const snapshot = buildNetworkSnapshot(renderStateOf(playback), false);
      expect(snapshot.stats).toMatchObject({ stations: 4, lines: 2 });
      expect(snapshot.sideBySide.get(1)).toEqual(['red', 'blue']);
    });

    test('draws a closed section as a ghost, but not while its line is back there', () => {
      const playback = playbackOf(tinyNetwork());
      const ghostsOn = (date: string) => {
        playback.player.seek(toTimestamp(date));
        return buildNetworkSnapshot(renderStateOf(playback), false).ghosts.features.length;
      };
      expect(ghostsOn('1942-01-01')).toBe(1);
      expect(ghostsOn('1947-01-01')).toBe(0);
      expect(ghostsOn('1960-01-01')).toBe(1);
    });

    test('keeps London at its known size today', () => {
      const snapshot = buildNetworkSnapshot(renderStateOf(playbackOf(londonNetwork())), false);
      expect(snapshot.stats.stations).toBe(384);
      expect(snapshot.stats.lines).toBe(18);
    });
  });
});
