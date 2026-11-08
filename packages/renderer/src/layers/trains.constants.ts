import type { MoverStyle } from '../motion/motion.types';

/** How long a train is drawn, km: a bead with the whole city in view, a capsule close in. */
export const TRAIN_LENGTH_KM = 0.12;

/** How much faster than real time trains run on the map: at a city's zoom a real one would hardly seem to move. */
export const TRAIN_TIME_LAPSE = 20;

/**
 * How a train is drawn: a light body edged in its line's colour, which alone would vanish on its own
 * line, over a soft shadow; in 3D it stands half as tall again as it is wide, to stand out among the
 * buildings, its sides its line's colour darkened.
 */
export const TRAIN_STYLE: MoverStyle = {
  shadowPx: [11, 22],
  shadowBlurPx: [5, 10],
  shadowOpacity: 0.35,
  casingPx: [7, 14],
  bodyPx: [4, 8.5],
  risePx: [11, 22],
  shade: 0.4,
  bodyColor: 'trainBody',
  shadowColor: 'trainShadow',
};
