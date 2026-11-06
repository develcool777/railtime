import { toTimestamp } from '@railtime/core/date.utils';
import { byCodeUnits } from '@railtime/core/text.utils';
import { tinyNetwork } from '@railtime/network/testing/tinyNetwork';
import { planId, stationId } from '@railtime/schema/testing/ids';
import { describe, expect, test } from 'vitest';
import { buildNetworkSnapshot, statsDrawn } from '../../../src/layers/snapshot.utils';
import { networkNow, playbackOf, renderStateOf } from '../../support/playback.utils';

describe('NetworkSnapshotUtils', () => {
  describe('statsDrawn', () => {
    const done = { stations: 10, km: 20, lines: 2 };
    const after = { stations: 16, km: 30, lines: 3 };

    test('is the size before the change until it begins, and the size after once drawn', () => {
      expect(statsDrawn(done, after, 0)).toEqual(done);
      expect(statsDrawn(done, after, 1)).toEqual(after);
    });

    test('counts a station or a line as soon as the change has begun on it, whole, and track as far as it has got', () => {
      expect(statsDrawn(done, after, 0.01)).toEqual({ stations: 11, km: 20.1, lines: 3 });
      expect(statsDrawn(done, after, 0.5)).toEqual({ stations: 13, km: 25, lines: 3 });
    });

    test('counts down for a closure', () => {
      const closed = { stations: 10, km: 20, lines: 2 };
      expect(statsDrawn({ stations: 16, km: 30, lines: 3 }, closed, 0.5)).toEqual({ stations: 13, km: 25, lines: 2 });
    });
  });

  describe('buildNetworkSnapshot', () => {
    test('counts what is on the map at a date, with shared track side by side', () => {
      const playback = playbackOf(tinyNetwork());
      playback.player.seek(playback.facts.playheads.on(toTimestamp('1935-01-01')));
      const snapshot = buildNetworkSnapshot(renderStateOf(playback), false);
      expect(snapshot.stats).toMatchObject({ stations: 4, lines: 2 });
      expect(snapshot.sideBySide.get(1)).toEqual(['red', 'blue']);
    });

    test('tags each stretch of track with its line, so lines can be brought forward', () => {
      const playback = playbackOf(tinyNetwork());
      playback.player.seek(playback.facts.playheads.on(toTimestamp('1935-01-01')));
      const snapshot = buildNetworkSnapshot(renderStateOf(playback), false);
      expect(new Set(snapshot.lines.features.map(feature => feature.properties.line))).toEqual(new Set(['red', 'blue']));
      expect(snapshot.transfers.features.every(feature => feature.properties.line === '')).toBe(true);
    });

    test("draws a plan's track as planned, and a station only it reaches", () => {
      const playback = playbackOf(tinyNetwork(), { plan: planId('extension') });
      playback.player.seek(playback.facts.playheads.end());
      const snapshot = buildNetworkSnapshot(renderStateOf(playback), false);
      const extension = playback.index.segments.at(-1)!.coordinates;
      expect(snapshot.planned.features.map(feature => feature.geometry.coordinates)).toEqual([extension]);
      expect(snapshot.lines.features.map(feature => feature.geometry.coordinates)).not.toContainEqual(extension);
      // D is long closed on red, and F stands on built track: only E is a plan's alone.
      expect([...snapshot.plannedStations]).toEqual(['e']);
      expect(snapshot.stations.has(stationId('f'))).toBe(true);
    });

    test('links a transfer once both its stations are on the map, and draws both as interchanges', () => {
      const playback = playbackOf(tinyNetwork());
      const snapshotOn = (date: string) => {
        playback.player.seek(playback.facts.playheads.on(toTimestamp(date)));
        return buildNetworkSnapshot(renderStateOf(playback), false);
      };
      expect(snapshotOn('1905-01-01').transfers.features).toHaveLength(0);
      const linked = snapshotOn('1915-01-01');
      expect(linked.transfers.features).toHaveLength(1);
      expect([...linked.linked].toSorted(byCodeUnits)).toEqual(['a', 'd']);
    });

    test('draws a suspended section as a ghost until its line is back there, and none once it has closed for good', () => {
      const playback = playbackOf(tinyNetwork());
      const ghostsOn = (date: string) => {
        playback.player.seek(playback.facts.playheads.on(toTimestamp(date)));
        return buildNetworkSnapshot(renderStateOf(playback), false).ghosts.features.length;
      };
      expect(ghostsOn('1942-01-01')).toBe(1);
      expect(ghostsOn('1947-01-01')).toBe(0);
      expect(ghostsOn('1960-01-01')).toBe(0);
    });
  });

  describe('stats', () => {
    test("counts what the network's history counts, every line shown, on any date", () => {
      const playback = playbackOf(tinyNetwork());
      for (const date of ['1905-01-01', '1935-01-01', '1942-01-01', '1965-01-01', '2026-01-01'] as const) {
        playback.player.seek(playback.facts.playheads.on(toTimestamp(date)));
        const drawn = buildNetworkSnapshot(renderStateOf(playback), false).stats;
        const counted = networkNow(playback).stats();
        expect(counted.stations).toBe(drawn.stations);
        expect(counted.lines).toBe(drawn.lines);
        expect(counted.km).toBeCloseTo(drawn.km, 6);
      }
    });
  });
});
