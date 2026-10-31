import { describe, expect, test } from 'vitest';
import { toTimestamp } from '../../../src/core/date.utils';
import { NetworkIndex } from '../../../src/network/index.service';
import { Timeline } from '../../../src/network/timeline.service';
import { tinyNetwork } from '../../support/factories/tinyNetwork.utils';
import { playbackOf } from '../../support/playback.utils';

const timelineOf = (network = tinyNetwork()) => {
  const index = new NetworkIndex(network);
  return { index, timeline: new Timeline(index) };
};

describe('Timeline', () => {
  test('orders steps by date, identity changes first on a shared date', () => {
    const { timeline } = timelineOf();
    expect(timeline.steps.map(step => [new Date(step.time).getUTCFullYear(), step.kind])).toEqual([
      [1900, 'open'],
      [1910, 'open'],
      [1920, 'infill'],
      [1925, 'rename'],
      [1930, 'open'],
      [1940, 'close'],
      [1945, 'open'],
      [1950, 'close'],
      [1960, 'stationClose'],
      [1970, 'open'],
      [1990, 'identity'],
    ]);
  });

  test('opens lines drawn as the same line together', () => {
    const { timeline } = timelineOf();
    const first = timeline.steps[0];
    if (first?.kind !== 'open') throw new Error('expected the first step to open a line');
    expect(first.line).toBe('red');
    expect(first.lineSegments.map(lineSegment => lineSegment.line).sort()).toEqual(['pink', 'red']);
  });

  test('puts the cursor after every step on or before a day', () => {
    const { timeline } = timelineOf();
    expect(timeline.cursorAt(toTimestamp('1899-12-31'))).toBe(0);
    expect(timeline.cursorAt(toTimestamp('1900-01-01'))).toBe(1);
    expect(timeline.cursorAt(toTimestamp('2026-01-01'))).toBe(timeline.steps.length);
  });

  test('opens and closes line segments by cursor, each period of a suspended line on its own', () => {
    const { index, timeline } = timelineOf();
    const [before, after] = index.lineSegments.filter(lineSegment => lineSegment.line === 'blue');
    expect(timeline.isOpen(before!, timeline.cursorAt(toTimestamp('1929-12-31')))).toBe(false);
    expect(timeline.isOpen(before!, timeline.cursorAt(toTimestamp('1935-01-01')))).toBe(true);
    expect(timeline.hasClosed(before!, timeline.cursorAt(toTimestamp('1940-01-01')))).toBe(true);
    expect(timeline.isOpen(after!, timeline.cursorAt(toTimestamp('1940-01-01')))).toBe(false);
    expect(timeline.isOpen(after!, timeline.cursorAt(toTimestamp('1945-01-01')))).toBe(true);
    expect(timeline.hasClosed(after!, timeline.cursorAt(toTimestamp('1950-01-01')))).toBe(true);
  });

  test('keeps an infill station off its line until it opens', () => {
    const { timeline } = timelineOf();
    expect(timeline.servesStation('c', 'red', timeline.cursorAt(toTimestamp('1915-01-01')))).toBe(false);
    expect(timeline.servesStation('c', 'red', timeline.cursorAt(toTimestamp('1920-06-01')))).toBe(true);
  });

  test('never stops a line at a station that opened after the line had left', () => {
    const { timeline } = timelineOf();
    expect(timeline.everServes('c', 'blue')).toBe(false);
    expect(timeline.servesStation('c', 'blue', timeline.cursorAt(toTimestamp('1935-01-01')))).toBe(false);
    expect(timeline.steps.filter(step => step.kind === 'infill')).toEqual([expect.objectContaining({ station: 'c', lines: ['red'] })]);
  });

  test('never stops a line at a station that closed before the line came', () => {
    const { timeline } = timelineOf();
    expect(timeline.everServes('d', 'green')).toBe(false);
    expect(timeline.everServes('c', 'green')).toBe(true);
  });

  test('stops a line calling at a closed station, still while its closing step plays', () => {
    const { timeline } = timelineOf();
    const closing = timeline.steps.find(step => step.kind === 'stationClose')!;
    expect(closing).toMatchObject({ station: 'd', lines: ['red'] });
    expect(timeline.servesStation('d', 'red', closing.index)).toBe(true);
    expect(timeline.servesStation('d', 'red', closing.index + 1)).toBe(false);
  });

  test('renames a station on the map, but not one renamed before it opened', () => {
    const { timeline } = timelineOf();
    expect(timeline.steps.filter(step => step.kind === 'rename')).toEqual([expect.objectContaining({ station: 'd', from: 'Old D', to: 'D' })]);
  });

  test('resolves aliases, switching to the line itself while its identity step plays', () => {
    const { timeline } = timelineOf();
    const identity = timeline.steps.find(step => step.kind === 'identity')!;
    expect(timeline.identityOf('pink', identity.index)).toEqual({ id: 'red' });
    expect(timeline.identityOf('pink', identity.index, true)).toEqual({ id: 'pink', previousId: 'red' });
    expect(timeline.identityOf('pink', identity.index + 1)).toEqual({ id: 'pink' });
  });

  test("follows every dated step with a plan's, undated, in the plan's order", () => {
    const timeline = new Timeline(playbackOf(tinyNetwork(), 'extension').index);
    const planned = timeline.steps.slice(timeline.datedCount);
    expect(planned.map(step => [step.kind, step.planned, step.time])).toEqual([
      ['open', true, Infinity],
      ['infill', true, Infinity],
    ]);
    expect(timeline.steps.slice(0, timeline.datedCount).every(step => !step.planned)).toBe(true);
    expect(timeline.cursorAt(toTimestamp('2999-01-01'))).toBe(timeline.datedCount);
  });

  test("keeps a plan's station off its line until its section plays", () => {
    const timeline = new Timeline(playbackOf(tinyNetwork(), 'extension').index);
    expect(timeline.servesStation('f', 'red', timeline.steps.length - 1)).toBe(false);
    expect(timeline.servesStation('f', 'red', timeline.steps.length)).toBe(true);
  });
});
