import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import type { CustomLayerInterface, CustomRenderMethodInput, LayerSpecification, Map as MapLibreMap } from 'maplibre-gl';
import { fakeGl } from './fakeGl.utils';
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

/** The closest MapLibre's map goes unless told. */
const MOST_ZOOM = 22;

/**
 * A stand-in for a MapLibre map: it keeps the sources' data, the layers and their properties, and the
 * camera's moves, so a layer group or the camera can be run in node and what it sent looked at. Its
 * camera is a flat projection of a `view` in a 1000 × 600 container; a fit does MapLibre's sums on it:
 * as close as puts the box inside what the map's padding and its own leave, up to its `maxZoom`, the
 * box in the middle of that room.
 *
 * @param style - The basemap's layers, as a loaded style has them.
 * @returns The stand-in and what it keeps.
 */
export const fakeMap = (style: LayerSpecification[] = []): FakeMap => {
  const view: FakeMap['view'] = {
    center: [0, 51.5],
    zoom: 10,
    width: 1000,
    height: 600,
    cover: { top: 0, right: 0, bottom: 0, left: 0 },
    moving: false,
    tilesLoaded: true,
    styleLoaded: true,
  };
  const data = new Map<string, unknown>();
  const images = new Map<string, { url: string; coordinates: unknown }>();
  const sends = new Map<string, number>();
  const states = new Map<string, Record<string, number>>();
  const layers = new Map<string, FakeLayer>(style.map(layer => [layer.id, { paint: {}, layout: {}, ...layer }]));
  const moves: FakeMap['moves'] = [];
  const rendered: FakeMap['rendered'] = [];
  const handlers = new Map<string, ((payload: unknown) => void)[]>();
  const life = { removed: false, resizes: 0, repaints: 0 };
  const custom = new Map<string, CustomLayerInterface>();
  const context = fakeGl();
  // A projection taking the world's Mercator units straight to the screen's, as a frame's would at some view.
  const frameArgs = { defaultProjectionData: { mainMatrix: [2, 0, 0, 0, 0, -2, 0, 0, 0, 0, 1, 0, -1, 1, 0, 1] } } as unknown as CustomRenderMethodInput;
  const canvas: FakeMap['canvas'] = { style: {}, toDataURL: (format, quality) => `data:${format};quality=${quality}` };
  // MapLibre refuses a layer the style spec does not allow (an expression it cannot read, a value not
  // among its options): checked as each is added or changed. A basemap layer's own tiles are a stand-in.
  const assertValid = (layer: FakeLayer): void => {
    const source = 'source' in layer ? layer.source : undefined;
    const sources = Object.fromEntries([
      ...[...data.keys()].map(id => [id, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } }]),
      ...[...images].map(([id, image]) => [id, { type: 'image', ...image }]),
      ...(source && !data.has(source) && !images.has(source) ? [[source, { type: 'vector', tiles: ['https://tiles.invalid/{z}/{x}/{y}.pbf'] }]] : []),
    ]);
    const errors = validateStyleMin({ version: 8, sources, layers: [layer] });
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
  const fire = (event: string, payload?: unknown) => {
    for (const handler of handlers.get(event) ?? []) handler(payload);
  };
  /** What a fit is asked for: padding round the box, and the closest it may go. */
  type FitOptions = { padding?: number | { top: number; right: number; bottom: number; left: number }; maxZoom?: number };
  // MapLibre's sums for a fit: a padding of one number is that on every side, and adds to the map's own.
  const fit = ([[west, south], [east, north]]: [[number, number], [number, number]], options: FitOptions) => {
    const given =
      typeof options.padding === 'number' ? { top: options.padding, right: options.padding, bottom: options.padding, left: options.padding } : options.padding;
    const { cover } = view;
    const padding = {
      top: cover.top + (given?.top ?? 0),
      right: cover.right + (given?.right ?? 0),
      bottom: cover.bottom + (given?.bottom ?? 0),
      left: cover.left + (given?.left ?? 0),
    };
    const across = (view.width - padding.left - padding.right) / (east - west);
    const down = (view.height - padding.top - padding.bottom) / ((north - south) * LATITUDE_STRETCH);
    const zoom = Math.min(options.maxZoom ?? MOST_ZOOM, Math.log2(Math.min(across, down) / PIXELS_PER_DEGREE));
    const scale = PIXELS_PER_DEGREE * 2 ** zoom;
    return {
      center: [
        (west + east) / 2 + (padding.right - padding.left) / 2 / scale,
        (south + north) / 2 + (padding.top - padding.bottom) / 2 / (scale * LATITUDE_STRETCH),
      ],
      zoom,
    };
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
    addLayer: (layer: LayerSpecification | CustomLayerInterface) => {
      if (layers.has(layer.id)) throw new Error(`layer ${layer.id} already added`);
      // A layer that draws itself is no style's: MapLibre adds it to its context as it is added.
      if (layer.type === 'custom') {
        layers.set(layer.id, { id: layer.id, type: 'custom', paint: {}, layout: {} } as unknown as FakeLayer);
        custom.set(layer.id, layer);
        layer.onAdd?.(map as unknown as MapLibreMap, context.context);
        return;
      }
      // MapLibre keeps its own copy of a layer's paint and layout: one layer's change never reaches another sharing a constant.
      const added = { ...layer, paint: { ...('paint' in layer && layer.paint) }, layout: { ...('layout' in layer && layer.layout) } } as FakeLayer;
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
    setFeatureState: (target: { source: string; id: string }, state: Record<string, number>) => {
      if (!data.has(target.source)) throw new Error(`no source ${target.source}`);
      states.set(`${target.source}|${target.id}`, { ...states.get(`${target.source}|${target.id}`), ...state });
    },
    queryRenderedFeatures: () => rendered,
    getZoom: () => view.zoom,
    getBearing: () => 0,
    getPitch: () => 0,
    getPadding: () => view.cover,
    getContainer: () => ({ clientWidth: view.width, clientHeight: view.height }),
    project: ([lng, lat]: [number, number]) => {
      const scale = PIXELS_PER_DEGREE * 2 ** view.zoom;
      return { x: view.width / 2 + (lng - view.center[0]) * scale, y: view.height / 2 - (lat - view.center[1]) * scale * LATITUDE_STRETCH };
    },
    cameraForBounds: fit,
    fitBounds: ([[west, south], [east, north]]: [[number, number], [number, number]], options: FitOptions) => {
      moves.push({
        kind: 'fit',
        target: [
          [west, south],
          [east, north],
        ],
        options,
      });
      Object.assign(
        view,
        fit(
          [
            [west, south],
            [east, north],
          ],
          options,
        ),
      );
    },
    easeTo: (options: Record<string, unknown>) => {
      moves.push({ kind: 'ease', target: options.center, options });
    },
    jumpTo: (options: Record<string, unknown>) => {
      moves.push({ kind: 'jump', target: options.center, options });
    },
    isMoving: () => view.moving,
    areTilesLoaded: () => view.tilesLoaded,
    isStyleLoaded: () => view.styleLoaded,
    // What the renderer needs of a whole map: its events, its canvas, and where it looks.
    on: (event: string, ...rest: unknown[]) => {
      const handler = rest.at(-1) as (payload: unknown) => void;
      handlers.set(event, [...(handlers.get(event) ?? []), handler]);
    },
    once: (event: string, handler: (payload: unknown) => void) => {
      const once = (payload: unknown) => {
        handlers.set(
          event,
          (handlers.get(event) ?? []).filter(held => held !== once),
        );
        handler(payload);
      };
      handlers.set(event, [...(handlers.get(event) ?? []), once]);
    },
    // A repaint leaves the map idle once its tiles are in.
    triggerRepaint: () => {
      life.repaints += 1;
      if (view.tilesLoaded) fire('idle');
    },
    resize: () => (life.resizes += 1),
    getCanvas: () => canvas,
    getCenter: () => ({ lng: view.center[0], lat: view.center[1] }),
    getBounds: () => ({
      getWest: () => view.center[0] - 1,
      getEast: () => view.center[0] + 1,
      getSouth: () => view.center[1] - 1,
      getNorth: () => view.center[1] + 1,
    }),
    unproject: ([x, y]: [number, number]) => {
      const scale = PIXELS_PER_DEGREE * 2 ** view.zoom;
      return [view.center[0] + (x - view.width / 2) / scale, view.center[1] - (y - view.height / 2) / (scale * LATITUDE_STRETCH)];
    },
    setPadding: (padding: FakeMap['view']['cover']) => (view.cover = padding),
    zoomIn: () => (view.zoom += 1),
    zoomOut: () => (view.zoom -= 1),
    remove: () => {
      life.removed = true;
      for (const layer of custom.values()) layer.onRemove?.(map as unknown as MapLibreMap, context.context);
    },
  };
  return {
    map: map as unknown as MapLibreMap,
    data,
    featuresIn: <Feature>(source: string) => (data.get(source) as { features?: Feature[] } | undefined)?.features ?? [],
    images,
    sends,
    states,
    layers,
    custom,
    webgl: context,
    paint: () => {
      for (const layer of custom.values()) layer.render(context.context, frameArgs);
    },
    repaints: () => life.repaints,
    moves,
    rendered,
    view,
    canvas,
    fire,
    isRemoved: () => life.removed,
    resizes: () => life.resizes,
  };
};
