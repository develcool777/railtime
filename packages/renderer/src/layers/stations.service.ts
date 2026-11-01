import type { LngLat } from '@railtime/core/geometry.types';
import type { ExpressionSpecification, Map as MapLibreMap, PointLike, SymbolLayerSpecification } from 'maplibre-gl';
import { clamp } from '@railtime/core/number.utils';
import { easeOutBack } from '../support/drawing.utils';
import type { PointFeature, PulseLook, PulseProperties, StationLook, StationProperties } from './snapshot.types';
import { emptyCollection, pointFeature } from './snapshot.utils';
import { byZoom } from './style.utils';
import { BACKDROP_STATION_OPACITY, LABEL_MIN_ZOOM, LAYERS, POP_IN_MS, PULSE_GROWTH, PULSE_MS, SOURCES } from './ids.constants';
import { MapLayer } from './layer.service';
import type { StationFrame } from './stations.types';
import type { Palette } from './theme.types';

/** A birth time far in the past: the station is shown fully, with no pop-in. */
const ALREADY_SHOWN = -1e9;

/**
 * Some values as text: two alike, to a hundredth (finer than an eye sees in a frame), have the same.
 *
 * @param values - The values: a feature's properties, or its look.
 * @returns The key.
 */
const keyOf = (values: object): string =>
  Object.values(values)
    .map(value => (typeof value === 'number' ? value.toFixed(2) : String(value)))
    .join('|');

/**
 * A feature-state value, as the layers read it: what the look says, or, before it is set, as if settled.
 *
 * @param name - The look's field.
 * @returns The expression.
 */
const lookOf = (name: string): ExpressionSpecification => ['coalesce', ['feature-state', name], 1];

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
  /** When each closing station's ring started closing in on it. */
  private readonly closedAt = new Map<string, number>();
  /** The colour a note under a label is in ("closed", a former name): the basemap's own labels'. */
  private noteColor = '#888888';
  /** Whether stations are named on the map: kept, so a layer installed later starts the same. */
  private labelsShown = true;
  /** Whether the stations are a backdrop, faded and unnamed, behind a route. */
  private faded = false;
  /** Some dot was still popping in, or some pulse running, when last drawn: the next frame differs. */
  private moving = false;
  /**
   * What the dots and rings sent last were, and how each looked: a frame whose dots are the same sends
   * MapLibre no data, which would have it cut their tiles and place every label again; one that only
   * moves their look (a pop-in, a fade, a ring growing) sets their feature state.
   */
  private sent = { stations: '', pulses: '', looks: new Map<string, string>() };

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
    this.addSource(SOURCES.pulses, { promoteId: 'id' });
    this.addSource(SOURCES.selection);
    this.addSource(SOURCES.stations, { promoteId: 'id' });
    // New sources are empty, and their features have no state: whatever comes next is sent.
    this.sent = { stations: '', pulses: '', looks: new Map() };
    this.map.addLayer({
      id: LAYERS.pulses,
      type: 'circle',
      source: SOURCES.pulses,
      paint: {
        'circle-color': 'rgba(0,0,0,0)',
        'circle-stroke-color': ['get', 'color'],
        'circle-stroke-width': 2.5,
        'circle-radius': byZoom(['*', lookOf('radius'), 4], ['*', lookOf('radius'), 9]),
        'circle-stroke-opacity': lookOf('opacity'),
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
          ['*', lookOf('scale'), ['case', ['get', 'interchange'], 3.6, 2.4]],
          ['*', lookOf('scale'), ['case', ['get', 'interchange'], 9, 6]],
        ),
        'circle-color': '#ffffff',
        'circle-stroke-width': byZoom(1.2, 2.5),
      },
    });
    const label: SymbolLayerSpecification['layout'] = {
      'text-field': this.labelText(),
      'text-font': font,
      'text-anchor': 'left',
      visibility: this.labelsShown ? 'visible' : 'none',
    };
    this.map.addLayer({
      id: LAYERS.labels,
      type: 'symbol',
      source: SOURCES.stations,
      minzoom: LABEL_MIN_ZOOM,
      filter: ['!', ['any', ['get', 'highlighted'], ['get', 'closing']]],
      layout: { ...label, 'text-size': byZoom(11, 14), 'text-offset': [0.9, 0] },
      paint: { 'text-halo-width': 1.5 },
    });
    this.map.addLayer({
      id: LAYERS.newLabels,
      type: 'symbol',
      source: SOURCES.stations,
      filter: ['any', ['get', 'highlighted'], ['get', 'closing']],
      layout: { ...label, 'text-size': byZoom(13, 16), 'text-offset': [1, 0], 'text-allow-overlap': true, 'text-ignore-placement': true },
      paint: { 'text-halo-width': 2 },
    });
    this.applyFade();
  }

  /**
   * A station's label: its name, and under it, smaller and quieter, what the step playing does to it:
   * the name it had while it takes a new one, that it closes (for now, for a spell), or that it opens
   * (a plan's, planned; after a spell, reopened).
   *
   * @returns The label's text, as MapLibre formats it.
   */
  private labelText(): NonNullable<SymbolLayerSpecification['layout']>['text-field'] {
    const note = { 'font-scale': 0.8, 'text-color': this.noteColor };
    return [
      'case',
      ['!=', ['get', 'former'], ''],
      ['format', ['get', 'name'], {}, '\n', {}, ['concat', 'formerly ', ['get', 'former']], note],
      ['get', 'closing'],
      ['format', ['get', 'name'], {}, '\n', {}, ['case', ['get', 'spell'], 'closed for now', 'closed'], note],
      ['get', 'highlighted'],
      ['format', ['get', 'name'], {}, '\n', {}, ['case', ['get', 'planned'], 'planned', ['get', 'spell'], 'reopened', 'opened'], note],
      ['get', 'name'],
    ];
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
    this.map.setPaintProperty(LAYERS.stations, 'circle-opacity', ['*', dots, lookOf('opacity'), ['case', ['get', 'planned'], 0.2, 1]]);
    this.map.setPaintProperty(LAYERS.stations, 'circle-stroke-opacity', ['*', dots, lookOf('opacity')]);
    for (const layer of [LAYERS.labels, LAYERS.newLabels]) this.map.setPaintProperty(layer, 'text-opacity', ['*', this.faded ? 0 : 1, lookOf('labelOpacity')]);
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
    this.noteColor = palette.basemapText;
    for (const layer of [LAYERS.labels, LAYERS.newLabels]) {
      this.map.setPaintProperty(layer, 'text-color', palette.label);
      this.map.setPaintProperty(layer, 'text-halo-color', palette.labelHalo);
      this.map.setLayoutProperty(layer, 'text-field', this.labelText());
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
    this.moving = pulses.length > 0 || this.pulsedAt.size > 0 || this.closedAt.size > 0 || stations.some(({ look }) => look.scale !== 1 || look.opacity < 1);
    const sent = {
      stations: stations.map(({ feature }) => keyOf(feature.properties)).join('\n'),
      pulses: pulses.map(({ feature }) => keyOf(feature.properties)).join('\n'),
      looks: new Map<string, string>(),
    };
    if (sent.stations !== this.sent.stations) this.setData(SOURCES.stations, { type: 'FeatureCollection', features: stations.map(({ feature }) => feature) });
    if (sent.pulses !== this.sent.pulses) this.setData(SOURCES.pulses, { type: 'FeatureCollection', features: pulses.map(({ feature }) => feature) });
    for (const [source, drawn] of [
      [SOURCES.stations, stations],
      [SOURCES.pulses, pulses],
    ] as const) {
      for (const { feature, look } of drawn) {
        const key = `${source}|${feature.properties.id}`;
        const looks = keyOf(look);
        sent.looks.set(key, looks);
        if (this.sent.looks.get(key) !== looks) this.setState(source, feature.properties.id, look);
      }
    }
    this.sent = sent;
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
    this.closedAt.clear();
  }

  /**
   * Builds the dots, and how each looks: each pops in when it first appears; new ones start a pulse.
   *
   * @param frame - The frame.
   * @returns Each station's feature and look.
   */
  private stationFeatures(frame: StationFrame): { feature: PointFeature<StationProperties>; look: StationLook }[] {
    const features: { feature: PointFeature<StationProperties>; look: StationLook }[] = [];
    for (const [station, lines] of frame.stations) {
      if (lines.size === 0) continue;
      if (!this.appearedAt.has(station)) this.appearedAt.set(station, frame.instant ? ALREADY_SHOWN : frame.now);
      const highlighted = frame.highlighted.has(station);
      const closing = frame.fading.has(station);
      this.startRing(frame, station, highlighted, closing);
      const age = (frame.now - this.appearedAt.get(station)!) / POP_IN_MS;
      const opacity = clamp(age * 3, 0, 1) * (frame.fading.get(station) ?? 1);
      let firstLine = '';
      for (const line of lines.keys()) if (!firstLine || this.compareLines(line, firstLine) < 0) firstLine = line;
      features.push({
        feature: pointFeature(this.coordOf(station), {
          id: station,
          name: this.nameOf(station),
          interchange: lines.size > 1 || frame.linked.has(station),
          color: lines.get(firstLine) ?? '#ffffff',
          highlighted,
          former: frame.renamed.get(station) ?? '',
          closing,
          planned: frame.planned.has(station),
          spell: frame.spells.has(station),
        }),
        look: {
          scale: age >= 1 ? 1 : Math.max(0, easeOutBack(clamp(age, 0, 1))),
          opacity,
          labelOpacity: this.labelOpacityOf(frame, opacity, highlighted, closing),
        },
      });
    }
    for (const station of [...this.appearedAt.keys()]) if (!frame.stations.get(station)?.size) this.appearedAt.delete(station);
    return features;
  }

  /**
   * Starts a station's ring the first frame its step marks it: a new one's, or a closing one's.
   *
   * @param frame - The frame.
   * @param station - The station.
   * @param highlighted - It is new, or renamed, in the step playing.
   * @param closing - It closes in the step playing.
   */
  private startRing(frame: StationFrame, station: string, highlighted: boolean, closing: boolean): void {
    if (frame.instant) return;
    if (highlighted && !this.pulsedAt.has(station)) this.pulsedAt.set(station, frame.now);
    if (closing && !this.closedAt.has(station)) this.closedAt.set(station, frame.now);
  }

  /**
   * How clearly a station's name shows: as its dot, but a step's stations' fade as the step ends, and
   * a closing station's stays while its dot goes.
   *
   * @param frame - The frame.
   * @param opacity - Its dot's.
   * @param highlighted - It is new, or renamed, in the step playing.
   * @param closing - It closes in the step playing.
   * @returns The label's opacity.
   */
  private labelOpacityOf(frame: StationFrame, opacity: number, highlighted: boolean, closing: boolean): number {
    if (closing) return frame.newLabelOpacity;
    return highlighted ? opacity * frame.newLabelOpacity : opacity;
  }

  /**
   * Builds the pulse rings: a new station's expands and fades once; a closing station's closes in on
   * it, the other way.
   *
   * @param frame - The frame.
   * @returns Each ring's feature and look.
   */
  private pulseFeatures(frame: StationFrame): { feature: PointFeature<PulseProperties>; look: PulseLook }[] {
    return [
      ...this.ringsOf(frame, 'pulse', this.pulsedAt, age => 1 + age * PULSE_GROWTH),
      ...this.ringsOf(frame, 'closing', this.closedAt, age => 1 + (1 - age) * PULSE_GROWTH),
    ];
  }

  /**
   * The rings of one kind running this frame; a ring done is forgotten once its step ends, so a
   * station rings at most once a step.
   *
   * @param frame - The frame.
   * @param kind - Which rings: a station's two kinds are two features.
   * @param startedAt - When each station's ring started.
   * @param radiusAt - Its radius, in dots, by how far it has run, 0..1.
   * @returns Each ring's feature and look.
   */
  private ringsOf(
    frame: StationFrame,
    kind: string,
    startedAt: Map<string, number>,
    radiusAt: (age: number) => number,
  ): { feature: PointFeature<PulseProperties>; look: PulseLook }[] {
    const features: { feature: PointFeature<PulseProperties>; look: PulseLook }[] = [];
    for (const [station, started] of startedAt) {
      const age = (frame.now - started) / PULSE_MS;
      const lines = frame.stations.get(station);
      const color = lines ? [...lines.values()][0] : undefined;
      if (age < 1 && color)
        features.push({ feature: pointFeature(this.coordOf(station), { id: `${kind}|${station}`, color }), look: { radius: radiusAt(age), opacity: 1 - age } });
      else if (age >= 1 && !frame.stepPlaying) startedAt.delete(station);
    }
    return features;
  }
}
