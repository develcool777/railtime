import { NetworkFacts } from '@railtime/network/facts.service';
import { playbackOf, snapshotOf } from '@railtime/renderer/testing/playback';
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
    expect(today.routes('heathrow-terminal-5', 'epping').length).toBeGreaterThan(0);
    await benchAgainstLastRun(bench, 'London route', () => {
      today.routes('heathrow-terminal-5', 'epping');
    });
  });

  test('finds where a station reaches', async ({ bench }) => {
    const today = NetworkFacts.create(LONDON.network).today();
    expect(today.reach('bank')?.stations.length).toBeGreaterThan(100);
    await benchAgainstLastRun(bench, 'London reach', () => {
      today.reach('bank');
    });
  });

  test('measures how its coverage grew, year by year', async ({ bench }) => {
    expect(NetworkFacts.create(LONDON.network).coverage(LONDON.boundary).history(800).length).toBeGreaterThan(100);
    await benchAgainstLastRun(bench, 'London coverage history', () => {
      // Made again each time: a city's facts keep the coverage they measured.
      NetworkFacts.create(LONDON.network).coverage(LONDON.boundary).history(800);
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
