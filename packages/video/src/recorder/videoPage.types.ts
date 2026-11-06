/**
 * The contract between a page recorded and the recorder, on the page's `window`: the recorder's clock,
 * which it installs before the page's scripts run (`installRecordingClock`), and the page's handle,
 * which the page sets once it can say where it is. `web` keeps its side, for its video page
 * (`web/src/features/video/`) and its explorer (`web/src/features/explorer/`); the recorder, this one,
 * records a page from `start` until `done`, and knows no more of it.
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

/** Where a page is: loading, ready to start, playing, or over, all of it shown. */
export type VideoPageState = 'loading' | 'ready' | 'playing' | 'done';

/** What a page offers the recorder: where it is, how to start it once `ready`, and when a frame can be taken. */
export type VideoPageHandle = {
  state: () => VideoPageState;
  start: () => void;
  /**
   * Whether what the page shows now is drawn. Asked with the clock held, so it says nothing of motion: a
   * move or a pulse under way finishes only as the clock moves.
   */
  drawn: () => boolean;
};

/** A page's window under recording: the recorder's clock, and the page's handle. */
export type RecordedWindow = {
  railtimeRecorder?: RecorderClock;
  railtimeVideo?: VideoPageHandle;
};
