/** How long the numbers take to count to a new value, ms. */
export const COUNT_MS = 900;

/** How long a camera's shutter stays open, ms: half a frame at 30 a second, an After Effects default. */
export const SHUTTER_MS = 1000 / 60;

/** How far into a count a number starts to settle, as a share of it: while it still moves, so it never stops dead first. */
export const SETTLE_START_SHARE = 0.75;

/** How long a number takes to settle, ms. */
export const SETTLE_MS = 900;

/** How far a number swings past where it lands, in units: under one, so it never rests on, or reads as, a wrong number. */
export const SETTLE_SWING = 0.3;

/** How many times it swings a second. */
export const SETTLE_SWINGS_PER_SECOND = 2.2;

/** How fast its swing dies away, a second. */
export const SETTLE_DECAY_PER_SECOND = 5;

/** How tall a reel's window is, in `em`: room for a digit's full height. */
export const REEL_HEIGHT_EM = 1.15;

/** How wide a comma or a point is, in `em`. */
export const MARK_WIDTH_EM = 0.32;

/** How much blur a digit's move past the shutter makes, as a share of its strip's height. */
export const BLUR_PER_DIGIT = 0.25;

/** The most blur a reel takes: a reel spinning faster stays this smeared. */
export const MOST_BLUR = 0.22;

/** The least blur worth drawing: under this a reel is sharp. */
export const LEAST_BLUR = 0.002;
