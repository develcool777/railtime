import type { NetworkFacts } from '@railtime/network/facts.service';
import type { FrameRenderer } from '../layers/frame.service';
import type { MapLayers } from '../layers/stack.service';
import type { Minimap } from '../minimap/minimap.service';
import type { MapProps, TransitMapEvents } from '../transitMap.types';
import type { CameraDirector } from './camera.service';
import type { Player } from './player.service';

/** What `Playback` draws one network with, made again for another: its facts, its player and its frames. */
export type NetworkParts = {
  facts: NetworkFacts;
  player: Player;
  frames: FrameRenderer;
};

/** What `Playback` plays the history on: all of it the map's, there for the map's whole life. */
export type PlaybackOptions = {
  /** The map's props as they stand. */
  props: () => Readonly<MapProps>;
  /** Moves the map's camera. */
  camera: CameraDirector;
  /** The map's layer groups. */
  layers: MapLayers;
  /** The overview inset, if there is one. */
  minimap: Minimap | null;
  /** Whether every tile in view has loaded. */
  tilesLoaded: () => boolean;
  /** Raises an event, delivered at the end of the frame. */
  notify: <Name extends keyof TransitMapEvents>(event: Name, payload: TransitMapEvents[Name]) => void;
};
