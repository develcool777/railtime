import type { LngLat } from '@railtime/schema/network.types';
import type { Map as MapLibreMap, PointLike, SymbolLayerSpecification } from 'maplibre-gl';
import { clamp, easeOutBack } from '../playback/easing.utils';
import type { PointFeature, PulseProperties, StationProperties } from './features.types';
import { emptyCollection, pointFeature } from './features.utils';
import { byZoom } from './layerStyle.utils';
import { BACKDROP_STATION_OPACITY, LABEL_MIN_ZOOM, LAYERS, POP_IN_MS, PULSE_GROWTH, PULSE_MS, SOURCES } from './layers.constants';
import { MapLayer } from './mapLayer.service';
import type { StationFrame } from './stationLayer.types';
import type { Palette } from './theme.types';

/** A birth time far in the past: the station is shown fully, with no pop-in. */
const ALREADY_SHOWN = -1e9;

/**
 * Station dots, their labels, the pulse ring around new stations, and the ring around the selected
 * station. Keeps the timing state those animations need: when each dot appeared and when each pulse
 * started.
 */
export class StationLayer extends MapLayer {
  /** Where each station is. */
  private readonly coordOf: (station: string) => LngLat;
  /** A station's display name. */
  private readonly nameOf: (station: string) => string;
  /** Sorts line ids into side-by-side order: a dot takes its first line's colour. */
  private readonly compareLines: (first: string, second: string) => number;
  /** When each station on the map appeared, for its pop-in. */
  private readonly appearedAt = new Map<string, number>();
  /** When each new station's pulse started. */
  private readonly pulsedAt = new Map<string, number>();
  /** Whether stations are named on the map: kept, so a layer installed later starts the same. */
  private labelsShown = true;
  /** Whether the stations are a backdrop, faded and unnamed, behind a route. */
  private faded = false;
  /** Some dot was still popping in, or some pulse running, when last drawn: the next frame differs. */
  private moving = false;

  public constructor(
    map: MapLibreMap,
    coordOf: (station: string) => LngLat,
    nameOf: (station: string) => string,
    compareLines: (first: string, second: string) => number,
  ) {
    super(map);
    this.coordOf = coordOf;
    this.nameOf = nameOf;
    this.compareLines = compareLines;
  }

  /**
   * Adds pulse, selection, dot and label layers.
   *
   * @param font - A font stack the basemap's glyph server has.
   */
  public install(font: string[]): void {
    for (const source of [SOURCES.pulses, SOURCES.selection, SOURCES.stations]) this.addSource(source);
    this.map.addLayer({
      id: LAYERS.pulses,
      type: 'circle',
      source: SOURCES.pulses,
      paint: {
        'circle-color': 'rgba(0,0,0,0)',
        'circle-stroke-color': ['get', 'color'],
        'circle-stroke-width': 2.5,
        'circle-radius': byZoom(['*', ['get', 'radius'], 4], ['*', ['get', 'radius'], 9]),
        'circle-stroke-opacity': ['get', 'opacity'],
      },
    });
    this.map.addLayer({
      id: LAYERS.selection,
      type: 'circle',
      source: SOURCES.selection,
      paint: { 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-width': 3, 'circle-radius': byZoom(8, 15) },
    });
    this.map.addLayer({
      id: LAYERS.stations,
      type: 'circle',
      source: SOURCES.stations,
      paint: {
        'circle-radius': byZoom(
          ['*', ['get', 'scale'], ['case', ['get', 'interchange'], 3.6, 2.4]],
          ['*', ['get', 'scale'], ['case', ['get', 'interchange'], 9, 6]],
        ),
        'circle-color': '#ffffff',
        'circle-stroke-width': byZoom(1.2, 2.5),
      },
    });
    const label: SymbolLayerSpecification['layout'] = {
      'text-field': ['get', 'name'],
      'text-font': font,
      'text-anchor': 'left',
      visibility: this.labelsShown ? 'visible' : 'none',
    };
    this.map.addLayer({
      id: LAYERS.labels,
      type: 'symbol',
      source: SOURCES.stations,
      minzoom: LABEL_MIN_ZOOM,
      filter: ['!', ['get', 'highlighted']],
      layout: { ...label, 'text-size': byZoom(11, 14), 'text-offset': [0.9, 0] },
      paint: { 'text-halo-width': 1.5 },
    });
    this.map.addLayer({
      id: LAYERS.newLabels,
      type: 'symbol',
      source: SOURCES.stations,
      filter: ['get', 'highlighted'],
      layout: { ...label, 'text-size': byZoom(13, 16), 'text-offset': [1, 0], 'text-allow-overlap': true, 'text-ignore-placement': true },
      paint: { 'text-halo-width': 2 },
    });
    this.applyFade();
  }

  /**
   * Fades the stations to a backdrop behind a route, their names gone; or brings them back.
   *
   * @param faded - Whether they are a backdrop.
   */
  public fade(faded: boolean): void {
    this.faded = faded;
    if (this.map.getLayer(LAYERS.stations)) this.applyFade();
  }

  /** Sets the dots' and names' opacities, each frame's own times the backdrop's, if faded. */
  private applyFade(): void {
    const dots = this.faded ? BACKDROP_STATION_OPACITY : 1;
    // A planned station is a ring: its fill all but gone.
    this.map.setPaintProperty(LAYERS.stations, 'circle-opacity', ['*', dots, ['get', 'opacity'], ['case', ['get', 'planned'], 0.2, 1]]);
    this.map.setPaintProperty(LAYERS.stations, 'circle-stroke-opacity', ['*', dots, ['get', 'opacity']]);
    for (const layer of [LAYERS.labels, LAYERS.newLabels]) this.map.setPaintProperty(layer, 'text-opacity', ['*', this.faded ? 0 : 1, ['get', 'labelOpacity']]);
  }

  /**
   * Names the stations on the map, or leaves only their dots; new stations' names too.
   *
   * @param shown - Whether to name them.
   */
  public showLabels(shown: boolean): void {
    this.labelsShown = shown;
    for (const layer of [LAYERS.labels, LAYERS.newLabels]) {
      if (this.map.getLayer(layer)) this.map.setLayoutProperty(layer, 'visibility', shown ? 'visible' : 'none');
    }
  }

  /**
   * Recolours rings and labels for the theme.
   *
   * @param palette - The theme's colours.
   */
  public applyPalette(palette: Palette): void {
    this.map.setPaintProperty(LAYERS.stations, 'circle-stroke-color', ['case', ['get', 'interchange'], palette.interchangeRing, ['get', 'color']]);
    this.map.setPaintProperty(LAYERS.selection, 'circle-stroke-color', palette.label);
    for (const layer of [LAYERS.labels, LAYERS.newLabels]) {
      this.map.setPaintProperty(layer, 'text-color', palette.label);
      this.map.setPaintProperty(layer, 'text-halo-color', palette.labelHalo);
    }
  }

  /**
   * Whether the stations drawn last are still changing on their own: a dot popping in, a pulse
   * running. Once they are not, a frame with the same stations draws nothing new.
   *
   * @returns Whether the next frame needs drawing.
   */
  public get animating(): boolean {
    return this.moving;
  }

  /**
   * Draws this frame's stations and pulses.
   *
   * @param frame - The frame.
   */
  public update(frame: StationFrame): void {
    const stations = this.stationFeatures(frame);
    const pulses = this.pulseFeatures(frame);
    this.moving = pulses.length > 0 || this.pulsedAt.size > 0 || stations.some(station => station.properties.scale !== 1 || station.properties.opacity < 1);
    this.setData(SOURCES.stations, { type: 'FeatureCollection', features: stations });
    this.setData(SOURCES.pulses, { type: 'FeatureCollection', features: pulses });
  }

  /**
   * Rings a station, or clears the ring.
   *
   * @param station - The station id, or `null`.
   */
  public select(station: string | null): void {
    this.setData(SOURCES.selection, station ? { type: 'FeatureCollection', features: [pointFeature(this.coordOf(station), {})] } : emptyCollection());
  }

  /**
   * The station drawn at a point on screen.
   *
   * @param point - Pixel coordinates on the map.
   * @returns The station id, or `null`.
   */
  public stationAt(point: PointLike): string | null {
    const [hit] = this.map.queryRenderedFeatures(point, { layers: [LAYERS.stations] });
    return (hit?.properties?.id as string | undefined) ?? null;
  }

  /** Forgets running pulses: after a jump in time they would belong to nothing. */
  public resetPulses(): void {
    this.pulsedAt.clear();
  }

  /**
   * Builds the dots: each pops in when it first appears; new ones start a pulse.
   *
   * @param frame - The frame.
   * @returns The station features.
   */
  private stationFeatures(frame: StationFrame): PointFeature<StationProperties>[] {
    const features: PointFeature<StationProperties>[] = [];
    for (const [station, lines] of frame.stations) {
      if (lines.size === 0) continue;
      if (!this.appearedAt.has(station)) this.appearedAt.set(station, frame.instant ? ALREADY_SHOWN : frame.now);
      const highlighted = frame.highlighted.has(station);
      if (highlighted && !frame.instant && !this.pulsedAt.has(station)) this.pulsedAt.set(station, frame.now);
      const age = (frame.now - this.appearedAt.get(station)!) / POP_IN_MS;
      const opacity = clamp(age * 3, 0, 1) * (frame.fading.get(station) ?? 1);
      let firstLine = '';
      for (const line of lines.keys()) if (!firstLine || this.compareLines(line, firstLine) < 0) firstLine = line;
      features.push(
        pointFeature(this.coordOf(station), {
          id: station,
          name: this.nameOf(station),
          scale: age >= 1 ? 1 : Math.max(0, easeOutBack(clamp(age, 0, 1))),
          opacity,
          labelOpacity: highlighted ? opacity * frame.newLabelOpacity : opacity,
          interchange: lines.size > 1 || frame.linked.has(station),
          color: lines.get(firstLine) ?? '#ffffff',
          highlighted,
          planned: frame.planned.has(station),
        }),
      );
    }
    for (const station of [...this.appearedAt.keys()]) if (!frame.stations.get(station)?.size) this.appearedAt.delete(station);
    return features;
  }

  /**
   * Builds the pulse rings: each expands and fades once.
   *
   * @param frame - The frame.
   * @returns The pulse features.
   */
  private pulseFeatures(frame: StationFrame): PointFeature<PulseProperties>[] {
    const features: PointFeature<PulseProperties>[] = [];
    for (const [station, startedAt] of this.pulsedAt) {
      const age = (frame.now - startedAt) / PULSE_MS;
      const lines = frame.stations.get(station);
      const color = lines ? [...lines.values()][0] : undefined;
      if (age < 1 && color) {
        features.push(pointFeature(this.coordOf(station), { color, radius: 1 + age * PULSE_GROWTH, opacity: 1 - age }));
      } else if (age >= 1 && !frame.stepPlaying) {
        // Kept until its step ends, so a station does not pulse twice in one step.
        this.pulsedAt.delete(station);
      }
    }
    return features;
  }
}
