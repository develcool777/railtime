/** How long a train is drawn, km: a bead with the whole city in view, a capsule close in. */
export const TRAIN_LENGTH_KM = 0.12;

/** The least time between two moves of the trains, ms: thirty a second, each sending the map their track. */
export const TRAIN_UPDATE_MS = 33;

/** How much faster than real time trains run on the map: at a city's zoom a real one would hardly seem to move. */
export const TRAIN_TIME_LAPSE = 20;
