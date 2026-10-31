import type { LayerSpecification, Map as MapLibreMap } from 'maplibre-gl';

/** A layer on the stand-in map, as added, with every paint and layout property set on it since. */
export type FakeLayer = LayerSpecification & { paint: Record<string, unknown>; layout: Record<string, unknown>; filter?: unknown };

/** A stand-in for a MapLibre map in node, which has no WebGL: it keeps what the renderer sends it. */
export type FakeMap = {
  /** The stand-in, typed as the map the renderer takes. */
  map: MapLibreMap;
  /** Each source's data, as last set. */
  data: Map<string, unknown>;
  /** Each image source's picture and corners, as last set. */
  images: Map<string, { url: string; coordinates: unknown }>;
  /** How many times each source's data was set. */
  sends: Map<string, number>;
  /** The layers, by id, in the order added. */
  layers: Map<string, FakeLayer>;
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
  };
  /** What `queryRenderedFeatures` answers. */
  rendered: { properties: Record<string, unknown> }[];
};
