import { type ChildProcessByStdio, spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Readable, Writable } from 'node:stream';
import { setTimeout as sleep } from 'node:timers/promises';
import { type BrowserContext, chromium, type Page } from 'playwright-core';
import { recordedPageOf } from './recordedPage.utils.ts';
import { BROWSER_PROFILE, FRAME_QUALITY, OPEN_TIMEOUT_MS, QUIET_MS, SETTLE_POLL_MS, SETTLE_TIMEOUT_MS, WARM_UP_SECONDS } from './recorder.constants.ts';
import type { RecorderOptions, Recording } from './recorder.types.ts';
import { awaitedByFrame, ffmpegArgsOf, ffmpegPathOf, installRecordingClock, pageUrlOf } from './recorder.utils.ts';
import type { RecordedWindow } from './videoPage.types.ts';

/**
 * Records a city's page playing its history as a video: the page, in the Chrome installed on this
 * machine, runs on a clock only the recorder moves (`installRecordingClock`); each frame it is moved
 * on by one frame's time, waits until the tiles it asked for are drawn, and is taken as a picture,
 * which ffmpeg encodes. A slow frame makes the recording slower, never the video uneven. It records
 * from the app as it is served (`pnpm dev`), from playback's start until it ends.
 *
 * Before the take it rehearses: the page plays through once, no frame taken, so every tile the
 * camera will look at is fetched. The clock moves the same way both times, so the camera takes the
 * same path, and the take finds its tiles in the browser's cache: Chrome's own profile, kept between
 * recordings (`BROWSER_PROFILE`), so a city recorded again finds them there already.
 */
export class VideoRecorder {
  /** Starts the browser. */
  private readonly launch: (recording: Recording) => Promise<BrowserContext>;
  /** The browser, once started: Chrome on its own profile, which keeps its cache. */
  private context: BrowserContext | null = null;
  /** ffmpeg, while it encodes. */
  private encoder: ChildProcessByStdio<Writable, null, Readable> | null = null;
  /** Settles when ffmpeg is done: its exit code, or what kept it from starting. */
  private encoded: Promise<number | Error | null> = Promise.resolve(null);
  /** What ffmpeg said went wrong. */
  private encoderSaid: string[] = [];
  /** The page's requests not yet answered. */
  private pending = 0;
  /** When the page last asked for or got something, real milliseconds. */
  private lastActivity = 0;

  public constructor(options: RecorderOptions = {}) {
    this.launch =
      options.launch ??
      (recording =>
        chromium.launchPersistentContext(BROWSER_PROFILE, {
          channel: 'chrome',
          viewport: { width: recording.width, height: recording.height },
          deviceScaleFactor: 1,
        }));
  }

  /**
   * Records the video and writes it: rehearsed first, unless asked not to.
   *
   * @param recording - The page, its size, the frames a second, the longest it runs, the file.
   * @throws {Error} For no app at the origin, no ffmpeg installed, a page that never plays, or a video ffmpeg did not write; Chrome and ffmpeg are closed either way.
   */
  public async record(recording: Recording): Promise<void> {
    await this.checkServed(recording.origin);
    const ffmpeg = ffmpegPathOf(existsSync);
    try {
      const page = await this.open(recording);
      if (recording.rehearse) {
        console.log('rehearsing, to fetch the tiles the camera will look at');
        await this.load(page, recording);
        const rehearsed = await this.play(page, recording, null);
        console.log(`rehearsed ${(rehearsed / recording.fps).toFixed(0)} s; recording`);
      }
      await this.load(page, recording);
      const encoder = this.startEncoder(recording, ffmpeg);
      const frames = await this.play(page, recording, async frame => {
        // ffmpeg gone (not installed, or failed) is said by `finish`.
        if (encoder.stdin.destroyed) return false;
        if (!encoder.stdin.write(frame)) await Promise.race([once(encoder.stdin, 'drain'), this.encoded]);
        return true;
      });
      await this.finish();
      console.log(`${recording.out}: ${frames} frames, ${(frames / recording.fps).toFixed(1)} s`);
    } finally {
      // Whatever started is closed, or the command would never end.
      this.encoder?.kill();
      this.encoder = null;
      await this.context?.close();
      this.context = null;
    }
  }

  /**
   * Fails at once, and says what to do, when nothing serves the app.
   *
   * @param origin - Where the app should be served.
   * @throws {Error} When nothing answers there.
   */
  private async checkServed(origin: string): Promise<void> {
    try {
      await fetch(origin, { method: 'HEAD' });
    } catch (error) {
      throw new Error(`nothing serves the app at ${origin}: start it with pnpm dev, or give --origin`, { cause: error });
    }
  }

  /**
   * Starts Chrome, with a page that runs on the recording clock and whose requests are counted.
   *
   * @param recording - The recording.
   * @returns The page.
   */
  private async open(recording: Recording): Promise<Page> {
    this.context = await this.launch(recording);
    const page = this.context.pages()[0] ?? (await this.context.newPage());
    page.setDefaultTimeout(OPEN_TIMEOUT_MS);
    page.on('pageerror', error => console.error(`recorded page: ${error.message}`));
    // What a frame waits for: every request but a stream, which stays open as long as the page.
    page.on('request', request => {
      if (awaitedByFrame(request.resourceType())) this.touched(1);
    });
    page.on('requestfinished', request => {
      if (awaitedByFrame(request.resourceType())) this.touched(-1);
    });
    page.on('requestfailed', request => {
      if (awaitedByFrame(request.resourceType())) this.touched(-1);
    });
    // Run in the page as written, on its own `window`, before any of its scripts, each time it loads.
    await page.addInitScript({ content: `(${installRecordingClock.toString()})(window);` });
    return page;
  }

  /**
   * Loads the city's page afresh, and runs it until it can play.
   *
   * @param page - The page.
   * @param recording - The recording.
   * @throws {Error} For a page that never gets ready.
   */
  private async load(page: Page, recording: Recording): Promise<void> {
    this.pending = 0;
    await page.goto(pageUrlOf(recording), { waitUntil: 'domcontentloaded' });
    // Its frames run only as the clock moves: moved on until it is ready, then a little more.
    const frameMs = 1000 / recording.fps;
    const deadline = Date.now() + OPEN_TIMEOUT_MS;
    const recorded = recordedPageOf(recording.page);
    while (!(await recorded.ready(page))) {
      if (Date.now() > deadline) throw new Error(`the page never got ready to play: ${pageUrlOf(recording)}`);
      await this.step(page, frameMs);
    }
    for (let frame = 0; frame < WARM_UP_SECONDS * recording.fps; frame++) await this.step(page, frameMs);
  }

  /**
   * Plays the page a frame at each step of the clock, until it ends (and, for the explorer, the camera
   * has moved back to the whole network), or the longest the recording runs: each frame taken, or,
   * rehearsing, only drawn.
   *
   * @param page - The page, ready to play.
   * @param recording - The recording.
   * @param take - What is done with each frame's picture, saying whether to go on; `null` to take none.
   * @returns How many frames it played.
   */
  private async play(page: Page, recording: Recording, take: ((frame: Buffer) => Promise<boolean>) | null): Promise<number> {
    const frameMs = 1000 / recording.fps;
    const recorded = recordedPageOf(recording.page);
    await recorded.start(page);
    let played = 0;
    let tail: number | null = null;
    while (played < recording.seconds * recording.fps && (tail === null || tail > 0)) {
      await this.step(page, frameMs);
      if (take && !(await take(await page.screenshot({ type: 'jpeg', quality: FRAME_QUALITY })))) break;
      played++;
      if (tail !== null) tail--;
      // Once a second, whether it still plays: once it ends, its tail.
      else if (played % recording.fps === 0 && (await recorded.ended(page))) tail = recorded.tailSeconds * recording.fps;
      if (played % (recording.fps * 10) === 0) console.log(`${(played / recording.fps).toFixed(0)} s ${take ? 'recorded' : 'rehearsed'}`);
    }
    return played;
  }

  /**
   * Starts ffmpeg, taking frames on its input; what it says and how it ends are kept for `finish`.
   *
   * @param recording - The recording.
   * @param ffmpeg - Where ffmpeg is.
   * @returns ffmpeg.
   */
  private startEncoder(recording: Recording, ffmpeg: string): ChildProcessByStdio<Writable, null, Readable> {
    mkdirSync(dirname(recording.out), { recursive: true });
    const encoder = spawn(ffmpeg, ffmpegArgsOf(recording), { stdio: ['pipe', 'ignore', 'pipe'] });
    this.encoder = encoder;
    this.encoderSaid = [];
    encoder.stderr.on('data', (chunk: Buffer) => {
      this.encoderSaid.push(chunk.toString());
    });
    // Its input closes under a frame being written when it stops: said by how it ended.
    encoder.stdin.on('error', () => {});
    this.encoded = new Promise(resolve => {
      encoder.on('error', resolve);
      encoder.on('close', resolve);
    });
    return encoder;
  }

  /**
   * Ends ffmpeg's input and waits for it to write the video.
   *
   * @throws {Error} For no ffmpeg, or one that failed: what it said.
   */
  private async finish(): Promise<void> {
    if (!this.encoder) return;
    this.encoder.stdin.end();
    const ended = await this.encoded;
    this.encoder = null;
    if (ended instanceof Error) throw new Error(`ffmpeg did not start: ${ended.message}`, { cause: ended });
    if (ended !== 0) throw new Error(`ffmpeg failed (${ended}): ${this.encoderSaid.join('').trim()}`);
  }

  /**
   * Moves the page's clock on by one frame, then waits, its time held, until the tiles it asked for
   * have come and been drawn.
   *
   * @param page - The page.
   * @param milliseconds - The frame's time.
   */
  private async step(page: Page, milliseconds: number): Promise<void> {
    await this.advance(page, milliseconds);
    const deadline = Date.now() + SETTLE_TIMEOUT_MS;
    while (Date.now() < deadline && (this.pending > 0 || Date.now() - this.lastActivity < QUIET_MS)) {
      await sleep(SETTLE_POLL_MS);
      // What came meanwhile is drawn at the same moment.
      await this.advance(page, 0);
    }
  }

  /**
   * Moves the page's clock on and runs its frames.
   *
   * @param page - The page.
   * @param milliseconds - How far.
   */
  private async advance(page: Page, milliseconds: number): Promise<void> {
    await page.evaluate(time => (window as RecordedWindow).railtimeRecorder?.advance(time), milliseconds);
  }

  /**
   * Counts a request asked for or answered.
   *
   * @param change - 1 for asked, -1 for answered or failed.
   */
  private touched(change: number): void {
    this.pending = Math.max(0, this.pending + change);
    this.lastActivity = Date.now();
  }
}
