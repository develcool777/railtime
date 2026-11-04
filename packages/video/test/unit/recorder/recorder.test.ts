import { describe, expect, test, vi } from 'vitest';
import { FFMPEG_LOCATIONS, RECORD_USAGE } from '../../../src/recorder/recorder.constants.ts';
import { VideoRecorder } from '../../../src/recorder/recorder.service.ts';
import type { RecordingScope } from '../../../src/recorder/recorder.types.ts';
import { ffmpegArgsOf, ffmpegPathOf, installRecordingClock, pageUrlOf, recordingOf } from '../../../src/recorder/recorder.utils.ts';

/**
 * A page's globals as the clock finds them: a clock at 1000 ms, a date at 5000, and no frames.
 *
 * @returns Them.
 */
const scopeOf = (): RecordingScope => ({
  performance: { now: () => 1000 },
  Date: { now: () => 5000 },
  requestAnimationFrame: () => 0,
  cancelAnimationFrame: () => undefined,
});

describe('RecorderUtils', () => {
  describe('recordingOf', () => {
    test("records the city's video page at 1080p, 60 frames a second, from the app run by pnpm dev, into videos/", () => {
      expect(recordingOf(['kyiv'])).toEqual({
        city: 'kyiv',
        page: 'video',
        fps: 60,
        width: 1920,
        height: 1080,
        seconds: 600,
        origin: 'http://localhost:5180',
        query: '',
        out: 'videos/kyiv.mp4',
      });
    });

    test('takes each option, a query with or without its ?, an origin with or without its /', () => {
      const args = [
        'london',
        '--page',
        'explorer',
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
        fps: 30,
        width: 1080,
        height: 1920,
        seconds: 45,
        origin: 'http://localhost:3000',
        query: 'mapOnly=1',
        out: 'short.mp4',
      });
    });

    test('says how to call it for no city, two, an option it does not know, or a value it cannot read', () => {
      expect(() => recordingOf([])).toThrow(RECORD_USAGE);
      expect(() => recordingOf(['kyiv', 'london'])).toThrow(RECORD_USAGE);
      expect(() => recordingOf(['kyiv', '--speed', '2'])).toThrow(RECORD_USAGE);
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

  describe('ffmpegArgsOf', () => {
    test('encodes the frames piped in, at their rate, into an H.264 MP4 any player takes', () => {
      const args = ffmpegArgsOf(recordingOf(['kyiv', '--fps', '30']));
      expect(args.join(' ')).toContain('-f image2pipe -framerate 30 -c:v mjpeg -i -');
      expect(args.join(' ')).toContain('-c:v libx264');
      expect(args.join(' ')).toContain('-pix_fmt yuv420p');
      expect(args.at(-1)).toBe('videos/kyiv.mp4');
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

describe('VideoRecorder', () => {
  test('says to start the app when nothing serves it, before starting Chrome', async () => {
    const launch = vi.fn();
    // Port 9 (discard) has nothing listening on it.
    const recording = recordingOf(['kyiv', '--origin', 'http://127.0.0.1:9']);
    await expect(new VideoRecorder({ launch }).record(recording)).rejects.toThrow('nothing serves the app at http://127.0.0.1:9: start it with pnpm dev');
    expect(launch).not.toHaveBeenCalled();
  });
});
