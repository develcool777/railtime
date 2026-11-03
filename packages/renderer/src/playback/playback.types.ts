import type { StationLayer } from '../layers/stations.service';
import type { MapProps, NetworkParts, TransitMapEvents } from '../transitMap.types';
import type { CameraDirector } from './camera.service';

/** What `Playback` plays the history on: the map's parts, read afresh as another network replaces them. */
export type PlaybackOptions = {
  /** The network drawn now, with its player, overlay and frames. */
  parts: () => NetworkParts;
  /** The map's props as they stand. */
  props: () => MapProps;
  /** Moves the map's camera. */
  camera: CameraDirector;
  /** Stations, their pulses and the selection ring. */
  stations: StationLayer;
  /** Whether every tile in view has loaded. */
  tilesLoaded: () => boolean;
  /** Fits the whole network in view, over so long, ms. */
  fitNetwork: (durationMs: number) => void;
  /** Raises an event, delivered at the end of the frame. */
  notify: <Name extends keyof TransitMapEvents>(event: Name, payload: TransitMapEvents[Name]) => void;
};
