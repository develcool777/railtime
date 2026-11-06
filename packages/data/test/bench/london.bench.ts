import { NetworkFacts } from '@railtime/network/facts.service';
import { playbackOf, snapshotOf, trainsOf } from '@railtime/renderer/testing/playback';
import { stationId } from '@railtime/schema/testing/ids';
import { describe, expect, test } from 'vitest';
import { benchAgainstLastRun, benchCity } from '../support/bench.utils';

/** London: the largest network, where a slow way of working something out shows first. */
const LONDON = benchCity('london');

// Each checks once that the work does its job, so a slip (a station that is not there) cannot pass for
// speed, then times it against its last run.
describe('London', () => {
  test('opens: its facts made, the index, the timeline and its playheads', async ({ bench }) => {
    expect(NetworkFacts.create(LONDON.network).today().stats().stations).toBeGreaterThan(400);
    await benchAgainstLastRun(bench, 'London opens', () => {
      NetworkFacts.create(LONDON.network);
    });
  });

  test('finds the ways between two stations far apart', async ({ bench }) => {
    const today = NetworkFacts.create(LONDON.network).today();
    expect(today.routes(stationId('heathrow-terminal-5'), stationId('epping')).length).toBeGreaterThan(0);
    await benchAgainstLastRun(bench, 'London route', () => {
      today.routes(stationId('heathrow-terminal-5'), stationId('epping'));
    });
  });

  test('finds where a station reaches', async ({ bench }) => {
    const today = NetworkFacts.create(LONDON.network).today();
    expect(today.reach(stationId('bank'))?.stations.length).toBeGreaterThan(100);
    await benchAgainstLastRun(bench, 'London reach', () => {
      today.reach(stationId('bank'));
    });
  });

  test('measures how its coverage grew, year by year', async ({ bench }) => {
    expect(NetworkFacts.create(LONDON.network).coverage(LONDON.boundary).history(800).length).toBeGreaterThan(100);
    await benchAgainstLastRun(bench, 'London coverage history', () => {
      // Made again each time: a city's facts keep the coverage they measured.
      NetworkFacts.create(LONDON.network).coverage(LONDON.boundary).history(800);
    });
  });

  test('moves its trains: what a frame sends the map, thirty times a second while they run', async ({ bench }) => {
    const playback = playbackOf(LONDON.network);
    const snapshot = snapshotOf(playback);
    const service = playback.facts.asOf(playback.player.playhead).trains();
    expect(trainsOf(playback, snapshot, service, 60).features.length).toBeGreaterThan(40);
    await benchAgainstLastRun(bench, 'London trains', () => {
      trainsOf(playback, snapshot, service, 60);
    });
  });

  test('works out the trains it runs: once each time the date changes', async ({ bench }) => {
    const playback = playbackOf(LONDON.network);
    expect(playback.facts.asOf(playback.player.playhead).trains().fleet).toBeGreaterThan(40);
    await benchAgainstLastRun(bench, 'London train service', () => {
      playback.facts.asOf(playback.player.playhead).trains();
    });
  });

  test('draws the map today: the network snapshot a frame shows', async ({ bench }) => {
    const playback = playbackOf(LONDON.network);
    expect(snapshotOf(playback).stations.size).toBeGreaterThan(400);
    await benchAgainstLastRun(bench, 'London frame', () => {
      snapshotOf(playback);
    });
  });
});
