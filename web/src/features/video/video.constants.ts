/** How fast the history plays: as the explorer's does at first, a change about every two seconds. */
export const VIDEO_SPEED = 2;

/** How long the title shows before the history plays, ms. */
export const TITLE_MS = 4500;

/** How long the end card shows before the video is over, ms: the camera's move to the whole network, then the card. */
export const END_MS = 7000;

/** How long after the history ends the end card starts to show, ms: the camera moves first. */
export const END_CARD_DELAY_MS = 1800;

/** How long anything takes to fade in or out, ms. */
export const FADE_MS = 600;

/** Room kept clear at the map's edges, as shares of its size: the year at the top, the caption at the bottom. */
export const VIDEO_PADDING_SHARES = { top: 0.16, bottom: 0.26, left: 0.08, right: 0.08 };
