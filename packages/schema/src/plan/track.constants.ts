/** How far apart a laid curve's points are, km: close enough that it reads as a curve, up close in 3D too. */
export const CURVE_STEP_KM = 0.04;

/** How far along a track its heading is taken, km: the way it leaves, not a kink at its first point. */
export const HEADING_SPAN_KM = 0.1;

/** How far each end's handle reaches along its heading, as a share of the distance between the ends. */
export const HANDLE_SHARE = 1 / 3;
