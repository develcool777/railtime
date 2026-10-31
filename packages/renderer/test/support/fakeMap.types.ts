import type { LayerSpecification, Map as MapLibreMap } from 'maplibre-gl';

/** A layer on the stand-in map, as added, with every paint and layout property set on it since. */
export type FakeLayer = LayerSpecification & { paint: Record<string, unknown>; layout: Record<string, unknown>; filter?: unknown };

/** A stand-in for a MapLibre map in node, which has no WebGL: it keeps what the renderer sends it. */
export type FakeMap = {
  /** The stand-in, typed as the map the renderer takes. */
  map: MapLibreMap;
  /** Each source's data, as last set. */
  data: Map<string, unknown>;
  /** How many times each source's data was set. */
  sends: Map<string, number>;
  /** The layers, by id, in the order added. */
  layers: Map<string, FakeLayer>;
  /** Every `fitBounds` and `easeTo` asked of the camera, in order. */
  moves: { kind: 'fit' | 'ease'; target: unknown; options: Record<string, unknown> }[];
  /** The camera: where it looks, how close, and the container's size, pixels. Set it to place the camera. */
  view: { center: [number, number]; zoom: number; width: number; height: number };
  /** What `queryRenderedFeatures` answers. */
  rendered: { properties: Record<string, unknown> }[];
};
