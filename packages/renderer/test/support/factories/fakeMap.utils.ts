import type { LayerSpecification, Map as MapLibreMap } from 'maplibre-gl';
import type { FakeLayer, FakeMap } from '../fakeMap.types';

/** The prefixes of the paint properties each kind of layer has: setting another throws, as MapLibre does. */
const PROPERTY_PREFIXES: Record<string, string[]> = {
  background: ['background'],
  fill: ['fill'],
  'fill-extrusion': ['fill-extrusion'],
  line: ['line'],
  symbol: ['text', 'icon'],
  circle: ['circle'],
};

/** Pixels per degree of longitude at zoom 0: MapLibre's 512-pixel world. */
const PIXELS_PER_DEGREE = 512 / 360;

/** How much taller a degree of latitude is drawn than one of longitude, about 51° north. */
const LATITUDE_STRETCH = 1.6;

/**
 * A stand-in for a MapLibre map: it keeps the sources' data, the layers and their properties, and the
 * camera's moves, so a layer group or the camera can be run in node and what it sent looked at. Its
 * camera is a flat projection of a `view` in a 1000 × 600 container; a fit lands on the box's middle
 * at its `maxZoom`, as it does for a box smaller than the view.
 *
 * @param style - The basemap's layers, as a loaded style has them.
 * @returns The stand-in and what it keeps.
 */
export const fakeMap = (style: LayerSpecification[] = []): FakeMap => {
  const view: FakeMap['view'] = { center: [0, 51.5], zoom: 10, width: 1000, height: 600 };
  const data = new Map<string, unknown>();
  const sends = new Map<string, number>();
  const layers = new Map<string, FakeLayer>(style.map(layer => [layer.id, { paint: {}, layout: {}, ...layer } as FakeLayer]));
  const moves: FakeMap['moves'] = [];
  const rendered: FakeMap['rendered'] = [];
  const layerOf = (id: string): FakeLayer => {
    const layer = layers.get(id);
    if (!layer) throw new Error(`no layer ${id}`);
    return layer;
  };
  const map = {
    addSource: (id: string, source: { data: unknown }) => {
      if (data.has(id)) throw new Error(`source ${id} already added`);
      data.set(id, source.data);
    },
    getSource: (id: string) =>
      data.has(id)
        ? {
            setData: (next: unknown) => {
              data.set(id, next);
              sends.set(id, (sends.get(id) ?? 0) + 1);
            },
          }
        : undefined,
    addLayer: (layer: LayerSpecification) => {
      if (layers.has(layer.id)) throw new Error(`layer ${layer.id} already added`);
      layers.set(layer.id, { paint: {}, layout: {}, ...layer } as FakeLayer);
    },
    getLayer: (id: string) => layers.get(id),
    getStyle: () => ({ layers: [...layers.values()] }),
    setPaintProperty: (id: string, property: string, value: unknown) => {
      const layer = layerOf(id);
      if (!(PROPERTY_PREFIXES[layer.type] ?? []).some(prefix => property.startsWith(`${prefix}-`))) throw new Error(`${layer.type} layer has no ${property}`);
      layer.paint[property] = value;
    },
    setLayoutProperty: (id: string, property: string, value: unknown) => {
      layerOf(id).layout[property] = value;
    },
    setFilter: (id: string, filter: unknown) => {
      Object.assign(layerOf(id), { filter });
    },
    queryRenderedFeatures: () => rendered,
    getZoom: () => view.zoom,
    getContainer: () => ({ clientWidth: view.width, clientHeight: view.height }),
    project: ([lng, lat]: [number, number]) => {
      const scale = PIXELS_PER_DEGREE * 2 ** view.zoom;
      return { x: view.width / 2 + (lng - view.center[0]) * scale, y: view.height / 2 - (lat - view.center[1]) * scale * LATITUDE_STRETCH };
    },
    cameraForBounds: (_bounds: unknown, options: { maxZoom: number }) => ({ zoom: options.maxZoom }),
    fitBounds: ([[west, south], [east, north]]: [[number, number], [number, number]], options: Record<string, unknown>) => {
      moves.push({
        kind: 'fit',
        target: [
          [west, south],
          [east, north],
        ],
        options,
      });
      Object.assign(view, { center: [(west + east) / 2, (south + north) / 2], zoom: options.maxZoom });
    },
    easeTo: (options: Record<string, unknown>) => moves.push({ kind: 'ease', target: options.center, options }),
  };
  return { map: map as unknown as MapLibreMap, data, sends, layers, moves, rendered, view };
};
