import type { Network } from '@railtime/schema/network.types';
import { globSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { toIsoDate } from '@railtime/core/date.utils';
import { buildNetworkSnapshot } from '../../../renderer/src/layers/snapshot.utils';
import type { LineSegment } from '@railtime/network/engine.types';
import { emptyDrawing } from '../../../renderer/src/steps/animation.utils';
import { playbackOf, renderStateOf } from '../../../renderer/test/support/playback.utils';

/** The package's `cities/` folder: each country's cities, `<country>/<city>/<city>.json`. */
const DATA = fileURLToPath(new URL('../../cities/', import.meta.url));

/**
 * A city's network, as the app serves it.
 *
 * @param city - The city's folder, under its country's in `cities/`.
 * @returns The network.
 */
export const cityNetwork = (city: string): Network => {
  const [path] = globSync(`*/${city}/${city}.json`, { cwd: DATA });
  if (!path) throw new Error(`No network for ${city} in ${DATA}`);
  return JSON.parse(readFileSync(`${DATA}${path}`, 'utf8'));
};

/** What playing a whole history at 1× did. */
export type PlayedHistory = {
  steps: number;
  started: number;
  cursor: number;
  mostHighlighted: number;
  /** Seconds at 1×. */
  seconds: number;
};

/**
 * Plays a network at 1× from where its player stands until it ends, drawing every fifth frame of
 * each step as the map would.
 *
 * @param playback - The network's pieces, its player placed where to start.
 * @param skipped - Steps before the start, left out of the count.
 * @returns How it went.
 */
const playOut = (playback: ReturnType<typeof playbackOf>, skipped: number): PlayedHistory => {
  const { timeline, player } = playback;
  player.play();
  const frameSeconds = 1 / 20;
  let seconds = 0;
  let started = 0;
  let mostHighlighted = 0;
  let frame = 0;
  while (player.playing && seconds < 7200) {
    started += player.tick(frameSeconds).filter(event => event.type === 'stepStart').length;
    seconds += frameSeconds;
    frame += 1;
    if (frame % 5 !== 0 || !player.active || player.phase === 'pre') continue;
    const state = renderStateOf(playback);
    const drawing = emptyDrawing();
    player.active.animation.draw({ state, snapshot: buildNetworkSnapshot(state, true), progress: player.progress, holdProgress: player.holdProgress }, drawing);
    mostHighlighted = Math.max(mostHighlighted, drawing.highlighted.size);
  }
  return { steps: timeline.steps.length - skipped, started, cursor: player.cursor - skipped, mostHighlighted, seconds };
};

/**
 * Plays a network's whole history at 1×, from its first day, drawing frames as the map would.
 *
 * @param network - The network.
 * @param plan - One of its plans, built on it and played after its history.
 * @returns How it went.
 */
export const playWholeHistory = (network: Network, plan?: string): PlayedHistory => {
  const playback = playbackOf(network, plan);
  playback.player.seek({ time: playback.timeline.start });
  return playOut(playback, 0);
};

/**
 * Plays a plan on its network from today, as "Play future" does: only the plan's sections.
 *
 * @param network - The network.
 * @param plan - One of its plans.
 * @returns How it went, counting the steps from today alone.
 */
export const playPlan = (network: Network, plan: string): PlayedHistory => {
  const playback = playbackOf(network, plan);
  // The player opens at today: whatever is dated after it plays first, as in the app.
  return playOut(playback, playback.player.cursor);
};

/**
 * How many pieces some line segments make: stretches that share no station.
 *
 * @param lineSegments - The line segments.
 * @returns The count.
 */
const piecesOf = (lineSegments: LineSegment[]): number => {
  const parent = new Map<string, string>();
  const root = (station: string): string => {
    const above = parent.get(station) ?? station;
    return above === station ? station : root(above);
  };
  for (const { segment } of lineSegments) parent.set(root(segment.stationA), root(segment.stationB));
  return new Set(lineSegments.map(({ segment }) => root(segment.stationA))).size;
};

/**
 * Where a network's history leaves a line in more pieces than before: each date a line, as it is
 * drawn then, comes apart. A line opening as a stretch of its own, or a works closure in its middle,
 * is history; a segment dated wrong is a bug that looks just the same, so a city lists each one.
 *
 * @param network - The network.
 * @returns `<line> <date>: <n> pieces`, in date order.
 */
export const lineSplits = (network: Network): string[] => {
  const { index, timeline } = playbackOf(network);
  const dated = timeline.steps.slice(0, timeline.datedCount);
  const pieces = new Map<string, number>();
  const splits: string[] = [];
  for (const [position, step] of dated.entries()) {
    // Counted once a day's steps have all played.
    if (dated[position + 1]?.time === step.time) continue;
    const cursor = position + 1;
    const byLine = new Map<string, LineSegment[]>();
    for (const lineSegment of index.lineSegments) {
      if (!timeline.isOpen(lineSegment, cursor)) continue;
      const line = timeline.identityOf(lineSegment.line, cursor).id;
      byLine.set(line, [...(byLine.get(line) ?? []), lineSegment]);
    }
    for (const line of new Set([...pieces.keys(), ...byLine.keys()])) {
      const count = piecesOf(byLine.get(line) ?? []);
      if (count > Math.max(pieces.get(line) ?? 1, 1)) splits.push(`${line} ${toIsoDate(step.time)}: ${count} pieces`);
      pieces.set(line, count);
    }
  }
  return splits;
};
