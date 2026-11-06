import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import type { BrowserContext } from 'playwright-core';
import { describe, expect, onTestFinished, test, vi } from 'vitest';
import { FFMPEG_LOCATIONS, OPEN_TIMEOUT_MS, WARM_UP_SECONDS } from '../../../src/recorder/recorder.constants.ts';
import { VideoRecorder } from '../../../src/recorder/recorder.service.ts';
import type { Recording, RecordingScope } from '../../../src/recorder/recorder.types.ts';
import {
  drawnOnceHeld,
  ffmpegArgsOf,
  ffmpegPathOf,
  installRecordingClock,
  launchOptionsOf,
  pageUrlOf,
  recordingOf,
  untilDrawn,
} from '../../../src/recorder/recorder.utils.ts';
import type { RecordedWindow, VideoPageState } from '../../../src/recorder/videoPage.types.ts';

/** A frame's picture, as the stand-in page takes it. */
const FRAME = Buffer.from('frame');

/** Frames a second: few, so the warm-up and a whole recording take no time. */
const FPS = 4;

/**
 * A page's globals as the clock finds them: a clock at 1000 ms, a date at 5000, and no frames.
 *
 * @returns Them.
 */
const scopeOf = (): RecordingScope => ({
  performance: { now: () => 1000 },
  Date: { now: () => 5000 },
  requestAnimationFrame: () => 0,
  cancelAnimationFrame: () => {},
});

describe('RecorderUtils', () => {
  describe('recordingOf', () => {
    test("records the city's video page at 1080p, 60 frames a second, from the app run by pnpm dev, into videos/", () => {
      expect(recordingOf(['kyiv'])).toEqual({
        city: 'kyiv',
        page: 'video',
        rehearse: true,
        fps: 60,
        width: 1920,
        height: 1080,
        seconds: 600,
        origin: 'http://localhost:5180',
        query: '',
        out: expect.stringMatching(/\/packages\/video\/videos\/kyiv\.mp4$/),
      });
    });

    test('takes each option, a query with or without its ?, an origin with or without its /', () => {
      const args = [
        'london',
        '--page',
        'explorer',
        '--no-rehearse',
        '--fps',
        '30',
        '--size',
        '1080x1920',
        '--seconds',
        '45',
        '--query',
        '?mapOnly=1',
        '--origin',
        'http://localhost:3000/',
      ];
      expect(recordingOf([...args, '--out', 'short.mp4'])).toEqual({
        city: 'london',
        page: 'explorer',
        rehearse: false,
        fps: 30,
        width: 1080,
        height: 1920,
        seconds: 45,
        origin: 'http://localhost:3000',
        query: 'mapOnly=1',
        out: 'short.mp4',
      });
    });

    test('says what is wrong for no city, two, an option it does not know, or a value it cannot read', () => {
      expect(() => recordingOf([])).toThrow('name one city');
      expect(() => recordingOf(['kyiv', 'london'])).toThrow('name one city');
      expect(() => recordingOf(['kyiv', '--speed', '2'])).toThrow("Unknown option '--speed'");
      expect(() => recordingOf(['kyiv', '--fps', '0'])).toThrow('--fps takes a whole number, not 0');
      expect(() => recordingOf(['kyiv', '--seconds', '1.5'])).toThrow('--seconds takes a whole number');
      expect(() => recordingOf(['kyiv', '--size', '1920'])).toThrow('--size takes width x height');
      expect(() => recordingOf(['kyiv', '--origin', 'localhost'])).toThrow('--origin takes an address');
      expect(() => recordingOf(['kyiv', '--page', 'landing'])).toThrow('--page takes video or explorer, not landing');
    });
  });

  describe('pageUrlOf', () => {
    test("opens the city's video page or explorer, with the query given", () => {
      expect(pageUrlOf(recordingOf(['kyiv']))).toBe('http://localhost:5180/video/kyiv');
      expect(pageUrlOf(recordingOf(['kyiv', '--page', 'explorer']))).toBe('http://localhost:5180/kyiv');
      expect(pageUrlOf(recordingOf(['kyiv', '--page', 'explorer', '--query', 'mapOnly=1&speed=2']))).toBe('http://localhost:5180/kyiv?mapOnly=1&speed=2');
    });
  });

  describe('launchOptionsOf', () => {
    test('starts the Chrome installed, at the size asked, stating the motion a recording wants', () => {
      expect(launchOptionsOf(recordingOf(['kyiv', '--size', '1280x720']))).toEqual({
        channel: 'chrome',
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: 1,
        reducedMotion: 'no-preference',
      });
    });
  });

  describe('drawnOnceHeld', () => {
    test("runs the page's frames at the moment held before it asks, so what came is drawn by the answer", () => {
      const said: string[] = [];
      const answer = drawnOnceHeld({
        railtimeRecorder: {
          advance: time => {
            said.push(`advance ${time}`);
          },
        },
        railtimeVideo: {
          state: () => 'playing',
          start: () => {},
          drawn: () => {
            said.push('drawn');
            return false;
          },
        },
      });
      expect(answer).toBe(false);
      expect(said).toEqual(['advance 0', 'drawn']);
    });

    test('has nothing to wait for on a page with no handle yet', () => {
      expect(drawnOnceHeld({})).toBe(true);
    });
  });

  describe('untilDrawn', () => {
    test('waits, drawing again, until the page says it is drawn, and no longer', async () => {
      const answers = [false, false, true];
      const wait = vi.fn(() => Promise.resolve());
      const drawn = vi.fn(() => Promise.resolve(answers.shift() ?? true));
      await untilDrawn(drawn, wait, () => false);
      expect([drawn.mock.calls.length, wait.mock.calls.length]).toEqual([3, 2]);
    });

    test('takes the frame as it is once it has waited as long as it may', async () => {
      const wait = vi.fn(() => Promise.resolve());
      await untilDrawn(
        () => Promise.resolve(false),
        wait,
        () => true,
      );
      expect(wait).not.toHaveBeenCalled();
    });
  });

  describe('ffmpegArgsOf', () => {
    test('encodes the frames piped in, at their rate, into an H.264 MP4 any player takes', () => {
      const args = ffmpegArgsOf(recordingOf(['kyiv', '--fps', '30']));
      expect(args.join(' ')).toContain('-f image2pipe -framerate 30 -c:v mjpeg -i -');
      expect(args.join(' ')).toContain('-c:v libx264');
      expect(args.join(' ')).toContain('-pix_fmt yuv420p');
      expect(args.at(-1)).toMatch(/\/packages\/video\/videos\/kyiv\.mp4$/);
    });
  });

  describe('ffmpegPathOf', () => {
    test('finds ffmpeg in the first place it is installed to that has it', () => {
      expect(ffmpegPathOf(() => true)).toBe(FFMPEG_LOCATIONS[0]);
      expect(ffmpegPathOf(path => path === '/usr/bin/ffmpeg')).toBe('/usr/bin/ffmpeg');
    });

    test('says how to install it where none has it', () => {
      expect(() => ffmpegPathOf(() => false)).toThrow('brew install ffmpeg');
    });
  });

  describe('installRecordingClock', () => {
    test('stands the time still, from where it was, until the recorder moves it', () => {
      const scope = scopeOf();
      installRecordingClock(scope);
      expect(scope.performance.now()).toBe(0);
      expect(scope.Date.now()).toBe(5000);
      scope.railtimeRecorder?.advance(16);
      expect(scope.performance.now()).toBe(16);
      expect(scope.Date.now()).toBe(5016);
    });

    test('runs the frames asked for as it moves, at its time; one asked for meanwhile, the next time', () => {
      const scope = scopeOf();
      installRecordingClock(scope);
      const times: number[] = [];
      const again = vi.fn();
      scope.requestAnimationFrame(time => {
        times.push(time);
        scope.requestAnimationFrame(again);
      });
      expect(times).toEqual([]);
      scope.railtimeRecorder?.advance(20);
      expect(times).toEqual([20]);
      expect(again).not.toHaveBeenCalled();
      scope.railtimeRecorder?.advance(0);
      expect(again).toHaveBeenCalledWith(20);
    });

    test('drops a frame cancelled before it runs', () => {
      const scope = scopeOf();
      installRecordingClock(scope);
      const cancelled = vi.fn();
      scope.cancelAnimationFrame(scope.requestAnimationFrame(cancelled));
      scope.railtimeRecorder?.advance(16);
      expect(cancelled).not.toHaveBeenCalled();
    });
  });
});

/**
 * What a page does under recording, on the clock only the recorder moves.
 *
 * @param behaviour - How it goes.
 * @param behaviour.readyAfter - How many frames it loads for.
 * @param behaviour.playsFor - How long it plays, ms, once started; for ever if not said.
 * @param behaviour.drawnAfter - How many times it is asked after each frame before it is drawn.
 * @param behaviour.onFrame - What else a frame moves.
 * @param behaviour.shotMs - How long a picture takes, ms.
 * @returns A browser with that page in it, and what was done to the page.
 */
const browserWith = ({ readyAfter = 2, playsFor = Infinity, drawnAfter = 0, onFrame = () => {}, shotMs = 0 }) => {
  const seen = { loads: [] as string[], starts: 0, frameTimes: [] as number[], shots: 0, shotsUndrawn: 0, framesWhenStarted: [] as number[], closes: 0 };
  let state: VideoPageState = 'loading';
  let framesLoading = 0;
  let playedMs = 0;
  let timesAsked = 0;
  const scope: RecordedWindow = {
    railtimeRecorder: {
      advance: milliseconds => {
        if (milliseconds === 0) return;
        seen.frameTimes.push(milliseconds);
        timesAsked = 0;
        onFrame();
        framesLoading += 1;
        if (state === 'loading' && framesLoading >= readyAfter) state = 'ready';
        if (state !== 'playing') return;
        playedMs += milliseconds;
        if (playedMs >= playsFor) state = 'done';
      },
    },
    railtimeVideo: {
      state: () => state,
      start: () => {
        seen.starts += 1;
        seen.framesWhenStarted.push(seen.frameTimes.length);
        state = 'playing';
      },
      drawn: () => {
        timesAsked += 1;
        return timesAsked > drawnAfter;
      },
    },
  };
  vi.stubGlobal('window', scope);
  const page = {
    setDefaultTimeout: () => {},
    on: () => {},
    addInitScript: () => Promise.resolve(),
    goto: (url: string) => {
      seen.loads.push(url);
      state = 'loading';
      framesLoading = 0;
      playedMs = 0;
      return Promise.resolve();
    },
    evaluate: (script: string | ((argument?: unknown) => unknown), argument?: unknown) => {
      if (typeof script !== 'string') return Promise.resolve(script(argument));
      // The one thing the recorder runs in the page as text.
      if (script !== `(${drawnOnceHeld.toString()})(window)`) throw new Error(`what is this? ${script}`);
      return Promise.resolve(drawnOnceHeld(scope));
    },
    screenshot: async () => {
      seen.shots += 1;
      if (timesAsked <= drawnAfter) seen.shotsUndrawn += 1;
      await sleep(shotMs);
      return FRAME;
    },
  };
  const context = {
    pages: () => [page],
    close: () => {
      seen.closes += 1;
      return Promise.resolve();
    },
  };
  return { context: context as unknown as BrowserContext, seen };
};

/**
 * A recording of a page served by nothing real, into a folder of the test's own, with a stand-in for
 * ffmpeg there that does as it is told.
 *
 * @param script - What the stand-in ffmpeg does, in `sh`; its last argument is the file to write.
 * @param overrides - What differs from a short recording rehearsed first.
 * @returns The recording, and where the stand-in is.
 */
const recordingApart = (script: string, overrides: Partial<Recording> = {}) => {
  const folder = mkdtempSync(join(tmpdir(), 'railtime-'));
  onTestFinished(() => {
    rmSync(folder, { recursive: true });
  });
  const ffmpeg = join(folder, 'ffmpeg');
  writeFileSync(ffmpeg, `#!/bin/sh\nfor out; do :; done\n${script}\n`);
  chmodSync(ffmpeg, 0o755);
  vi.stubGlobal('fetch', () => Promise.resolve(new Response()));
  return { ffmpeg, recording: { ...recordingOf(['kyiv', '--fps', String(FPS), '--seconds', '20']), out: join(folder, 'kyiv.mp4'), ...overrides } };
};

/** A stand-in ffmpeg that keeps what it is given. */
const KEEPS_FRAMES = 'cat > "$out"';

describe('VideoRecorder', () => {
  test('says to start the app when nothing serves it, before starting Chrome', async () => {
    const launch = vi.fn();
    // Port 9 (discard) has nothing listening on it.
    const recording = recordingOf(['kyiv', '--origin', 'http://127.0.0.1:9']);
    await expect(new VideoRecorder({ launch, report: vi.fn() }).record(recording)).rejects.toThrow('nothing serves the app at http://127.0.0.1:9: start it');
    expect(launch).not.toHaveBeenCalled();
  });

  test('rehearses, no frame taken, then loads the page afresh and takes each frame, until the page says it is over', async () => {
    const { context, seen } = browserWith({ playsFor: 2000 });
    const { recording, ffmpeg } = recordingApart(KEEPS_FRAMES);
    const said: string[] = [];
    const report = (line: string) => {
      said.push(line);
    };
    await new VideoRecorder({ launch: () => Promise.resolve(context), ffmpeg, report }).record(recording);
    const frames = (2000 / 1000) * FPS;
    expect(seen.loads).toEqual([pageUrlOf(recording), pageUrlOf(recording)]);
    expect(seen.starts).toBe(2);
    expect(seen.shots).toBe(frames);
    expect(readFileSync(recording.out)).toEqual(Buffer.concat(Array.from({ length: frames }, () => FRAME)));
    expect(said).toEqual(['rehearsing, to fetch the tiles the camera will look at', 'rehearsed 2 s; recording', `${recording.out}: ${frames} frames, 2.0 s`]);
    expect(seen.closes).toBe(1);
  });

  test('stops at the longest the recording runs, for a page that never says it is over', async () => {
    const { context, seen } = browserWith({});
    const { recording, ffmpeg } = recordingApart(KEEPS_FRAMES, { rehearse: false, seconds: 3 });
    await new VideoRecorder({ launch: () => Promise.resolve(context), ffmpeg, report: vi.fn() }).record(recording);
    expect(seen.shots).toBe(3 * FPS);
  });

  test('skips the rehearsal when told, the page loaded once', async () => {
    const { context, seen } = browserWith({ playsFor: 1000 });
    const { recording, ffmpeg } = recordingApart(KEEPS_FRAMES, { rehearse: false });
    await new VideoRecorder({ launch: () => Promise.resolve(context), ffmpeg, report: vi.fn() }).record(recording);
    expect(seen.loads).toHaveLength(1);
    expect(seen.starts).toBe(1);
  });

  test('moves the clock a frame at a time, until the page is ready and for the warm-up after, before starting it', async () => {
    const { context, seen } = browserWith({ readyAfter: 5, playsFor: 1000 });
    const { recording, ffmpeg } = recordingApart(KEEPS_FRAMES, { rehearse: false });
    await new VideoRecorder({ launch: () => Promise.resolve(context), ffmpeg, report: vi.fn() }).record(recording);
    expect(seen.framesWhenStarted).toEqual([5 + WARM_UP_SECONDS * FPS]);
    expect(new Set(seen.frameTimes)).toEqual(new Set([1000 / FPS]));
  });

  test('takes no frame until the page says it is drawn', async () => {
    const { context, seen } = browserWith({ drawnAfter: 2, playsFor: 1000 });
    const { recording, ffmpeg } = recordingApart(KEEPS_FRAMES, { rehearse: false });
    await new VideoRecorder({ launch: () => Promise.resolve(context), ffmpeg, report: vi.fn() }).record(recording);
    expect(seen.shots).toBe(FPS);
    expect(seen.shotsUndrawn).toBe(0);
  });

  test('says so of a page that never gets ready, and closes Chrome', async () => {
    let clock = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => clock);
    const { context, seen } = browserWith({
      readyAfter: Infinity,
      onFrame: () => {
        clock += OPEN_TIMEOUT_MS / 2;
      },
    });
    const { recording, ffmpeg } = recordingApart(KEEPS_FRAMES, { rehearse: false });
    await expect(new VideoRecorder({ launch: () => Promise.resolve(context), ffmpeg, report: vi.fn() }).record(recording)).rejects.toThrow(
      `the page never got ready to play: ${pageUrlOf(recording)}`,
    );
    expect(seen.shots).toBe(0);
    expect(seen.closes).toBe(1);
  });

  test('stops taking frames once ffmpeg has gone, and says what it said, Chrome closed', async () => {
    const { context, seen } = browserWith({ shotMs: 5 });
    const { recording, ffmpeg } = recordingApart('echo no codec >&2; exit 3', { rehearse: false, seconds: 600 });
    await expect(new VideoRecorder({ launch: () => Promise.resolve(context), ffmpeg, report: vi.fn() }).record(recording)).rejects.toThrow(
      'ffmpeg failed (3): no codec',
    );
    expect(seen.shots).toBeLessThan(600 * FPS);
    expect(seen.closes).toBe(1);
  });
});
