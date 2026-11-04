/**
 * The contract between a page made to be recorded and the recorder, on the page's `window`: the
 * recorder's clock, which it installs before the page's scripts run (`installRecordingClock`), and the
 * page's handle, which the page sets once it can say where it is. `web`'s video page keeps its side
 * (`web/src/features/video/`); the recorder, this one, records it from `start` until `done`.
 */

/** The clock a page under recording runs on: moved only by the recorder, a frame at a time. */
export type RecorderClock = {
  /**
   * Moves the clock on and runs the frames the page asked for.
   *
   * @param milliseconds - How far; 0 runs them at the same time, for what arrived meanwhile.
   */
  advance: (milliseconds: number) => void;
};

/** Where a video page is: loading, ready to start, playing, or over. */
export type VideoPageState = 'loading' | 'ready' | 'playing' | 'done';

/** What a video page offers the recorder: where it is, and how to start it once `ready`. */
export type VideoPageHandle = {
  state: () => VideoPageState;
  start: () => void;
};

/** A page's window under recording: the recorder's clock, and a video page's handle. */
export type RecordedWindow = {
  railtimeRecorder?: RecorderClock;
  railtimeVideo?: VideoPageHandle;
};
