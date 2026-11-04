import type { Bounds } from '@railtime/core/geometry.types';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { Palette } from '../layers/theme.types';
import type { CreateMap } from '../transitMap.types';

/** What a `Minimap` is made with. */
export type MinimapOptions = {
  /** Where it is drawn. */
  container: HTMLElement;
  /** The map whose view it outlines. */
  main: MapLibreMap;
  /** Makes its own map. */
  createMap: CreateMap;
  /** The basemap's style. */
  style: string;
  /** What it frames: the network's bounds. */
  bounds: Bounds;
  /** The theme's colours. */
  palette: Palette;
};

/** A box on the screen, pixels from its container's top left. */
export type ScreenBox = { left: number; top: number; width: number; height: number };

/** A point on the screen, pixels from its container's top left. */
export type ScreenPoint = { x: number; y: number };
