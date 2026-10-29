import { describe, expect, test } from 'vitest';
import { buildNetworkSnapshot } from '../../../src/layers/networkSnapshot.utils';
import { toTimestamp } from '../../../src/model/date.utils';
import { tinyNetwork } from '../../support/factories/tinyNetwork.utils';
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

    test('links a transfer once both its stations are on the map, and draws both as interchanges', () => {
      const playback = playbackOf(tinyNetwork());
      const snapshotOn = (date: string) => {
        playback.player.seek(toTimestamp(date));
        return buildNetworkSnapshot(renderStateOf(playback), false);
      };
      expect(snapshotOn('1905-01-01').transfers.features).toHaveLength(0);
      const linked = snapshotOn('1915-01-01');
      expect(linked.transfers.features).toHaveLength(1);
      expect([...linked.linked].sort()).toEqual(['a', 'd']);
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
  });
});
