import type { CustomLayerInterface, LayerSpecification, Map as MapLibreMap } from 'maplibre-gl';
import type { FakeGl } from './fakeGl.types';

/** A layer on the stand-in map, as added, with every paint and layout property set on it since. */
export type FakeLayer = LayerSpecification & { paint: Record<string, unknown>; layout: Record<string, unknown>; filter?: unknown };

/** A stand-in for a MapLibre map in node, which has no WebGL: it keeps what the renderer sends it. */
export type FakeMap = {
  /** The stand-in, typed as the map the renderer takes. */
  map: MapLibreMap;
  /** Each source's data, as last set. */
  data: Map<string, unknown>;
  /** What a GeoJSON source holds, as last set: its features, none before it is added. */
  featuresIn: <Feature = { type: 'Feature'; properties: Record<string, unknown>; geometry: unknown }>(source: string) => Feature[];
  /** Each image source's picture and corners, as last set. */
  images: Map<string, { url: string; coordinates: unknown }>;
  /** How many times each source's data was set. */
  sends: Map<string, number>;
  /** Each feature's state, by `<source>|<id>`: how it looks this frame. */
  states: Map<string, Record<string, number>>;
  /** The layers, by id, in the order added: a layer that draws itself among them, as its id and type. */
  layers: Map<string, FakeLayer>;
  /** The layers that draw themselves, by id: added to the context as they are added to the map. */
  custom: Map<string, CustomLayerInterface>;
  /** The context they draw in. */
  webgl: FakeGl;
  /** Draws a frame, as MapLibre does once asked for a repaint: each layer that draws itself, in its context. */
  paint: () => void;
  /** How many repaints were asked for. */
  repaints: () => number;
  /** Every `fitBounds`, `easeTo` and `jumpTo` asked of the camera, in order. */
  moves: { kind: 'fit' | 'ease' | 'jump'; target: unknown; options: Record<string, unknown> }[];
  /** The camera: where it looks, how close, the container's size and the panels over it (its padding), pixels. Set it to place the camera. */
  view: {
    center: [number, number];
    zoom: number;
    width: number;
    height: number;
    cover: { top: number; right: number; bottom: number; left: number };
    /** Whether the camera is moving, as `isMoving` answers. */
    moving: boolean;
    /** Whether every tile in view has loaded, as `areTilesLoaded` answers. */
    tilesLoaded: boolean;
    /** Whether the style and what was last sent to its sources have loaded, as `isStyleLoaded` answers. */
    styleLoaded: boolean;
  };
  /** The map's one canvas: the cursor set on its style, and the picture `toDataURL` gives (its format and quality). Replace `toDataURL` to fail it. */
  canvas: { style: Record<string, string>; toDataURL: (format?: string, quality?: number) => string };
  /** What `queryRenderedFeatures` answers. */
  rendered: { properties: Record<string, unknown> }[];
  /** Fires a map event, as MapLibre would: `style.load`, `click`, `moveend`; a repaint fires `idle` once the tiles are in. */
  fire: (event: string, payload?: unknown) => void;
  /** Whether `remove` was called. */
  isRemoved: () => boolean;
  /** How many times `resize` was called. */
  resizes: () => number;
};
