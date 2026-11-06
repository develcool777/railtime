import { toIsoDate } from '@railtime/core/date.utils';
import { drawnStep, playbackOf } from '@railtime/renderer/testing/playback';
import type { Network, PlanId } from '@railtime/schema/network.types';
import { globSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

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

/** The stations either end of a stretch of a line's track. */
type TrackStretch = { segment: { stationA: string; stationB: string } };

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
  const { facts, player } = playback;
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
    if (frame % 5 !== 0 || player.phase === 'pre') continue;
    mostHighlighted = Math.max(mostHighlighted, drawnStep(playback)?.highlighted.size ?? 0);
  }
  return { steps: facts.changes().length - skipped, started, cursor: player.cursor - skipped, mostHighlighted, seconds };
};

/**
 * Plays a network's whole history at 1×, from its first day, drawing frames as the map would.
 *
 * @param network - The network.
 * @param shown - What is shown of it.
 * @param shown.plan - One of its plans, built on it and played after its history.
 * @param shown.hidden - Its lines hidden, by line or network; without them, as the app opens it.
 * @returns How it went.
 */
export const playWholeHistory = (network: Network, shown: { plan?: PlanId; hidden?: readonly string[] } = {}): PlayedHistory => {
  const playback = playbackOf(network, shown);
  playback.player.seek(playback.facts.playheads.on(playback.facts.range.start));
  return playOut(playback, 0);
};

/**
 * Plays a plan on its network from today, as "Play the plan" does: only the plan's sections.
 *
 * @param network - The network.
 * @param plan - One of its plans.
 * @param hidden - Its lines hidden, by line or network; without them, as the app opens it.
 * @returns How it went, counting the steps from today alone.
 */
export const playPlan = (network: Network, plan: PlanId, hidden?: readonly string[]): PlayedHistory => {
  const playback = playbackOf(network, { plan, ...(hidden && { hidden }) });
  // The player opens at today: whatever is dated after it plays first, as in the app.
  return playOut(playback, playback.player.cursor);
};

/**
 * How many pieces some line segments make: stretches that share no station.
 *
 * @param lineSegments - The line segments.
 * @returns The count.
 */
const piecesOf = (lineSegments: TrackStretch[]): number => {
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
 * Worked out on the raw track, the exception to the engine's fence (`CLAUDE.md`): a line's stops, all
 * the facts say of it, part where its track holds together through a junction its trains pass.
 *
 * @param network - The network.
 * @param hidden - Its lines hidden, by line or network; without them, as the app opens it.
 * @returns `<line> <date>: <n> pieces`, in date order.
 */
export const lineSplits = (network: Network, hidden?: readonly string[]): string[] => {
  const { index, timeline } = playbackOf(network, hidden ? { hidden } : {});
  const dated = timeline.steps.slice(0, timeline.datedCount);
  const pieces = new Map<string, number>();
  const splits: string[] = [];
  for (const [position, step] of dated.entries()) {
    // Counted once a day's steps have all played.
    if (dated[position + 1]?.time === step.time) continue;
    const cursor = position + 1;
    const byLine = new Map<string, TrackStretch[]>();
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
