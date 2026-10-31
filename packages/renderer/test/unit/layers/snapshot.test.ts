import { describe, expect, test } from 'vitest';
import { buildNetworkSnapshot } from '../../../src/layers/snapshot.utils';
import { toTimestamp } from '../../../src/core/date.utils';
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

    test('tags each stretch of track with its line, so lines can be brought forward', () => {
      const playback = playbackOf(tinyNetwork());
      playback.player.seek(toTimestamp('1935-01-01'));
      const snapshot = buildNetworkSnapshot(renderStateOf(playback), false);
      expect(new Set(snapshot.lines.features.map(feature => feature.properties.line))).toEqual(new Set(['red', 'blue']));
      expect(snapshot.transfers.features.every(feature => feature.properties.line === '')).toBe(true);
    });

    test("draws a plan's track as planned, and a station only it reaches", () => {
      const playback = playbackOf(tinyNetwork(), 'extension');
      playback.player.seekEnd();
      const snapshot = buildNetworkSnapshot(renderStateOf(playback), false);
      const extension = playback.index.segments.at(-1)!.coordinates;
      expect(snapshot.planned.features.map(feature => feature.geometry.coordinates)).toEqual([extension]);
      expect(snapshot.lines.features.map(feature => feature.geometry.coordinates)).not.toContainEqual(extension);
      // D is long closed on red, and F stands on built track: only E is a plan's alone.
      expect([...snapshot.plannedStations]).toEqual(['e']);
      expect(snapshot.stations.has('f')).toBe(true);
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
