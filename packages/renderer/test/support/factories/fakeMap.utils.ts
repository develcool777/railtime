import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import type { LayerSpecification, Map as MapLibreMap } from 'maplibre-gl';
import type { FakeLayer, FakeMap } from '../fakeMap.types';

/** The GeoJSON geometries a source may hold. */
const GEOMETRIES = new Set(['Point', 'MultiPoint', 'LineString', 'MultiLineString', 'Polygon', 'MultiPolygon']);

/**
 * The feature properties an expression reads, `['get', name]`, however deep.
 *
 * @param expression - A layer's paint or layout value, or its filter.
 * @returns The names.
 */
const propertiesRead = (expression: unknown): string[] => {
  if (!Array.isArray(expression)) return [];
  const [operator, name] = expression;
  if (operator === 'get' && typeof name === 'string' && expression.length === 2) return [name];
  return expression.flatMap(propertiesRead);
};

/**
 * Refuses what MapLibre could not draw: anything but a collection of features with a geometry each.
 *
 * @param id - The source.
 * @param data - Its data.
 * @returns The features.
 */
const featuresOf = (id: string, data: unknown): { properties?: Record<string, unknown> }[] => {
  const collection = data as { type?: string; features?: { type?: string; geometry?: { type?: string }; properties?: Record<string, unknown> }[] };
  if (collection.type !== 'FeatureCollection' || !Array.isArray(collection.features)) throw new Error(`source ${id}: not a FeatureCollection`);
  for (const feature of collection.features)
    if (feature.type !== 'Feature' || !GEOMETRIES.has(feature.geometry?.type ?? '')) throw new Error(`source ${id}: not a feature with a geometry`);
  return collection.features;
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
  const view: FakeMap['view'] = { center: [0, 51.5], zoom: 10, width: 1000, height: 600, cover: { top: 0, right: 0, bottom: 0, left: 0 } };
  const data = new Map<string, unknown>();
  const images = new Map<string, { url: string; coordinates: unknown }>();
  const sends = new Map<string, number>();
  const layers = new Map<string, FakeLayer>(style.map(layer => [layer.id, { paint: {}, layout: {}, ...layer } as FakeLayer]));
  const moves: FakeMap['moves'] = [];
  const rendered: FakeMap['rendered'] = [];
  // MapLibre refuses a layer the style spec does not allow (an expression it cannot read, a value not
  // among its options): checked as each is added or changed. A basemap layer's own tiles are a stand-in.
  const assertValid = (layer: FakeLayer): void => {
    const source = 'source' in layer ? layer.source : undefined;
    const sources = Object.fromEntries([
      ...[...data.keys()].map(id => [id, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } }]),
      ...[...images].map(([id, image]) => [id, { type: 'image', ...image }]),
      ...(source && !data.has(source) && !images.has(source) ? [[source, { type: 'vector', tiles: ['https://tiles.invalid/{z}/{x}/{y}.pbf'] }]] : []),
    ]);
    const errors = validateStyleMin({ version: 8, sources, layers: [layer as LayerSpecification] });
    if (errors.length > 0) throw new Error(`layer ${layer.id}: ${errors.map(error => error.message).join('; ')}`);
  };
  // A layer reading a property its source's features never carry draws nothing, or its default: each
  // name it reads must be on one of them, once the source holds any.
  const assertPropertiesHeld = (layer: FakeLayer): void => {
    const source = 'source' in layer ? layer.source : undefined;
    if (!source || !data.has(source)) return;
    const features = featuresOf(source, data.get(source));
    if (features.length === 0) return;
    const held = new Set(features.flatMap(feature => Object.keys(feature.properties ?? {})));
    const read = propertiesRead([Object.values(layer.paint), Object.values(layer.layout), 'filter' in layer ? layer.filter : []]);
    const missing = read.filter(name => !held.has(name));
    if (missing.length > 0) throw new Error(`layer ${layer.id} reads ${missing.join(', ')}, which no feature of ${source} has`);
  };
  const layerOf = (id: string): FakeLayer => {
    const layer = layers.get(id);
    if (!layer) throw new Error(`no layer ${id}`);
    return layer;
  };
  const map = {
    addSource: (id: string, source: { type: string; data?: unknown; url?: string; coordinates?: unknown }) => {
      if (data.has(id) || images.has(id)) throw new Error(`source ${id} already added`);
      if (source.type === 'image') {
        images.set(id, { url: source.url ?? '', coordinates: source.coordinates });
        return;
      }
      featuresOf(id, source.data);
      data.set(id, source.data);
    },
    getSource: (id: string) => {
      if (images.has(id)) return { updateImage: (image: { url: string; coordinates: unknown }) => images.set(id, image) };
      // A basemap's own source: one its layers read.
      if (!data.has(id)) return style.some(layer => 'source' in layer && layer.source === id) ? { type: 'vector' } : undefined;
      return {
        setData: (next: unknown) => {
          featuresOf(id, next);
          data.set(id, next);
          sends.set(id, (sends.get(id) ?? 0) + 1);
          for (const layer of layers.values()) assertPropertiesHeld(layer);
        },
      };
    },
    addLayer: (layer: LayerSpecification) => {
      if (layers.has(layer.id)) throw new Error(`layer ${layer.id} already added`);
      const added = { paint: {}, layout: {}, ...layer } as FakeLayer;
      assertValid(added);
      assertPropertiesHeld(added);
      layers.set(layer.id, added);
    },
    getLayer: (id: string) => layers.get(id),
    getStyle: () => ({ layers: [...layers.values()] }),
    setPaintProperty: (id: string, property: string, value: unknown) => {
      const layer = layerOf(id);
      layer.paint[property] = value;
      assertValid(layer);
    },
    setLayoutProperty: (id: string, property: string, value: unknown) => {
      const layer = layerOf(id);
      layer.layout[property] = value;
      assertValid(layer);
    },
    setFilter: (id: string, filter: unknown) => {
      const layer = layerOf(id);
      Object.assign(layer, { filter });
      assertValid(layer);
    },
    queryRenderedFeatures: () => rendered,
    getZoom: () => view.zoom,
    getBearing: () => 0,
    getPadding: () => view.cover,
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
  return { map: map as unknown as MapLibreMap, data, images, sends, layers, moves, rendered, view };
};
