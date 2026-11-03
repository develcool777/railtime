import type { NetworkFacts } from '@railtime/network/facts.service';
import type { ChangeInfo } from '@railtime/network/facts.types';
import { describe, expect, test } from 'vitest';

import { END_CARD_DELAY_MS, END_MS, FADE_MS, TITLE_MS, VIDEO_SPEED } from '~/features/video/video.constants';
import {
  fadedIn,
  historySpan,
  pageStateOf,
  sceneAfter,
  shownFor,
  spokenAddress,
  videoLayersOf,
  videoMapPropsOf,
  videoPaddingOf,
} from '~/features/video/video.utils';

/**
 * A change on a date, or a planned one.
 *
 * @param date - Its date, or `null` for a planned change.
 * @returns The change.
 */
const changeOn = (date: string | null) => ({ time: date === null ? null : Date.parse(date) }) as ChangeInfo;

describe('VideoUtils', () => {
  describe('sceneAfter', () => {
    test('moves the title on to the history, and the end card on to over, as their time runs out', () => {
      expect(sceneAfter('title', TITLE_MS - 1)).toBe('title');
      expect(sceneAfter('title', TITLE_MS)).toBe('history');
      expect(sceneAfter('end', END_MS - 1)).toBe('end');
      expect(sceneAfter('end', END_MS)).toBe('done');
    });

    test('leaves the history to its playback, and a video not started, or over, as it is', () => {
      expect(sceneAfter('history', 10 * 60_000)).toBe('history');
      expect(sceneAfter('ready', 10 * 60_000)).toBe('ready');
      expect(sceneAfter('done', 10 * 60_000)).toBe('done');
    });
  });

  describe('fadedIn', () => {
    test('rises from nothing to whole over the fade, and stays', () => {
      expect(fadedIn(-100, 600)).toBe(0);
      expect(fadedIn(300, 600)).toBe(0.5);
      expect(fadedIn(9000, 600)).toBe(1);
    });
  });

  describe('shownFor', () => {
    test('fades in at the start, holds, and fades out at the end', () => {
      expect(shownFor(0, 4000, 500)).toBe(0);
      expect(shownFor(250, 4000, 500)).toBe(0.5);
      expect(shownFor(2000, 4000, 500)).toBe(1);
      expect(shownFor(3750, 4000, 500)).toBe(0.5);
      expect(shownFor(4000, 4000, 500)).toBe(0);
    });
  });

  describe('historySpan', () => {
    test("spans its first change's year to its last's, leaving planned changes out", () => {
      expect(historySpan([changeOn('1960-11-06'), changeOn('1976-12-17'), changeOn('2023-01-01'), changeOn(null)])).toBe('1960 – 2023');
    });

    test('names the one year of a history in one year, and nothing for none', () => {
      expect(historySpan([changeOn('1960-11-06'), changeOn('1960-12-01')])).toBe('1960');
      expect(historySpan([changeOn(null)])).toBe('');
    });
  });

  describe('videoPaddingOf', () => {
    test('keeps room for the year above and the caption below, more below, in proportion to the size', () => {
      expect(videoPaddingOf({ width: 1920, height: 1080 })).toEqual({ top: 173, bottom: 281, left: 154, right: 154 });
      expect(videoPaddingOf({ width: 1080, height: 1920 }).bottom).toBe(499);
    });
  });

  describe('pageStateOf', () => {
    test('tells a recorder loading, ready and over as they are, and every scene between as playing', () => {
      expect(pageStateOf('loading')).toBe('loading');
      expect(pageStateOf('ready')).toBe('ready');
      expect(['title', 'history', 'end'].map(scene => pageStateOf(scene as 'title'))).toEqual(['playing', 'playing', 'playing']);
      expect(pageStateOf('done')).toBe('done');
    });
  });

  describe('videoLayersOf', () => {
    const still = { elapsed: 0, sinceCaption: 0, sinceCaptionGone: null };

    test('shows the title over its scene alone, fading in and out', () => {
      expect(videoLayersOf({ ...still, scene: 'title', elapsed: TITLE_MS / 2 }).title).toBe(1);
      expect(videoLayersOf({ ...still, scene: 'title', elapsed: TITLE_MS }).title).toBe(0);
      expect(videoLayersOf({ ...still, scene: 'history', elapsed: TITLE_MS / 2 }).title).toBe(0);
    });

    test('brings the year in with the history, and takes it out just as the end card comes in', () => {
      expect(videoLayersOf({ ...still, scene: 'history', elapsed: FADE_MS / 2 }).year).toBe(0.5);
      expect(videoLayersOf({ ...still, scene: 'end', elapsed: 0 }).year).toBe(1);
      expect(videoLayersOf({ ...still, scene: 'end', elapsed: END_CARD_DELAY_MS }).year).toBe(0);
      expect(videoLayersOf({ ...still, scene: 'end', elapsed: END_CARD_DELAY_MS }).end).toBe(0);
      expect(videoLayersOf({ ...still, scene: 'end', elapsed: END_CARD_DELAY_MS + FADE_MS }).end).toBe(1);
      expect(videoLayersOf({ ...still, scene: 'done' }).end).toBe(1);
    });

    test('fades a caption in as its change starts and out once it goes, never more than the year', () => {
      const playing = { scene: 'history' as const, elapsed: 10_000 };
      expect(videoLayersOf({ ...playing, sinceCaption: FADE_MS / 2, sinceCaptionGone: null }).caption).toBe(0.5);
      expect(videoLayersOf({ ...playing, sinceCaption: 5000, sinceCaptionGone: null }).caption).toBe(1);
      expect(videoLayersOf({ ...playing, sinceCaption: 5000, sinceCaptionGone: FADE_MS }).caption).toBe(0);
      expect(videoLayersOf({ scene: 'history', elapsed: FADE_MS / 4, sinceCaption: 5000, sinceCaptionGone: null }).caption).toBe(0.25);
    });
  });

  describe('videoMapPropsOf', () => {
    test("shows the network dark, at the video's pace, without street names, framing clear of what lies over it", () => {
      const facts = {} as NetworkFacts;
      expect(videoMapPropsOf(facts, { width: 1920, height: 1080 })).toEqual({
        facts,
        theme: 'dark',
        speed: VIDEO_SPEED,
        streetLabels: false,
        padding: videoPaddingOf({ width: 1920, height: 1080 }),
      });
    });
  });

  describe('spokenAddress', () => {
    test('says an address without its scheme or its last slash', () => {
      expect(spokenAddress('https://develcool777.github.io/railtime/')).toBe('develcool777.github.io/railtime');
      expect(spokenAddress('http://localhost:5180/')).toBe('localhost:5180');
    });
  });
});
