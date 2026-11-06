/** How long the numbers take to count to a new value, ms. */
export const COUNT_MS = 900;

/** How long a camera's shutter stays open, ms: half a frame at 30 a second, an After Effects default. */
export const SHUTTER_MS = 1000 / 60;

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
