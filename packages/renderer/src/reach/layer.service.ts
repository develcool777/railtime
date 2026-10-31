import type { Map as MapLibreMap } from 'maplibre-gl';
import type { PointFeature, ReachStopProperties, ReachTrackFeature } from '../layers/features.types';
import { emptyCollection } from '../layers/features.utils';
import { byZoom } from '../layers/style.utils';
import { LAYERS, LINE_LAYOUT, SOURCES } from '../layers/ids.constants';
import { MapLayer } from '../layers/layer.service';
import type { Palette } from '../layers/theme.types';

/**
 * How far one gets from a station, drawn over the faded network: the track and the stations in the
 * colour of how long they take, the start ringed. Each station is named with its time where there is
 * room, the nearest first.
 */
export class ReachLayer extends MapLayer {
  /** The track reached: kept, so installing draws a reach shown before the basemap loaded. */
  private track: ReachTrackFeature[] = [];
  /** The stations reached, the start among them. */
  private stops: PointFeature<ReachStopProperties>[] = [];

  public constructor(map: MapLibreMap) {
    super(map);
  }

  /**
   * Whether a reach is drawn.
   *
   * @returns True if one is.
   */
  public get shown(): boolean {
    return this.stops.length > 0;
  }

  /**
   * Adds the reach's track, stations and names.
   *
   * @param font - A font stack the basemap's glyph server has.
   */
  public install(font: string[]): void {
    this.addSource(SOURCES.reachTrack);
    this.addSource(SOURCES.reachStops);
    this.map.addLayer({
      id: LAYERS.reachTrack,
      type: 'line',
      source: SOURCES.reachTrack,
      layout: LINE_LAYOUT,
      paint: { 'line-color': ['get', 'color'], 'line-width': byZoom(3, 7) },
    });
    // A size by zoom must be the outermost expression, so the start is chosen inside it.
    this.map.addLayer({
      id: LAYERS.reachStops,
      type: 'circle',
      source: SOURCES.reachStops,
      paint: {
        'circle-radius': byZoom(['case', ['get', 'origin'], 6, 3.2], ['case', ['get', 'origin'], 11, 6]),
        'circle-color': ['get', 'color'],
        'circle-stroke-width': byZoom(['case', ['get', 'origin'], 3, 1.2], ['case', ['get', 'origin'], 5, 2]),
      },
    });
    // The nearest stations are named first, where there is room.
    this.map.addLayer({
      id: LAYERS.reachLabels,
      type: 'symbol',
      source: SOURCES.reachStops,
      filter: ['!', ['get', 'origin']],
      layout: {
        'text-field': ['get', 'label'],
        'text-font': font,
        'text-size': byZoom(10.5, 13),
        'text-anchor': 'left',
        'text-offset': [0.9, 0],
        'symbol-sort-key': ['get', 'minutes'],
      },
      paint: { 'text-halo-width': 1.5 },
    });
    // The start, always.
    this.map.addLayer({
      id: LAYERS.reachOriginLabel,
      type: 'symbol',
      source: SOURCES.reachStops,
      filter: ['get', 'origin'],
      layout: {
        'text-field': ['get', 'label'],
        'text-font': font,
        'text-size': byZoom(13, 16),
        'text-anchor': 'left',
        'text-offset': [1, 0],
        'text-allow-overlap': true,
      },
      paint: { 'text-halo-width': 2 },
    });
    this.draw();
  }

  /**
   * Colours the stations' rims and the names for the theme.
   *
   * @param palette - The theme's colours.
   */
  public applyPalette(palette: Palette): void {
    this.map.setPaintProperty(LAYERS.reachStops, 'circle-stroke-color', palette.labelHalo);
    for (const layer of [LAYERS.reachLabels, LAYERS.reachOriginLabel]) {
      this.map.setPaintProperty(layer, 'text-color', palette.label);
      this.map.setPaintProperty(layer, 'text-halo-color', palette.labelHalo);
    }
  }

  /**
   * Draws a reach, or clears it.
   *
   * @param track - The track it reaches; none to clear it.
   * @param stops - The stations it reaches, the start among them; none to clear them.
   */
  public update(track: ReachTrackFeature[], stops: PointFeature<ReachStopProperties>[]): void {
    this.track = track;
    this.stops = stops;
    this.draw();
  }

  /** Puts the reach kept in the sources; before they are installed, nothing. */
  private draw(): void {
    this.setData(SOURCES.reachTrack, { ...emptyCollection<ReachTrackFeature>(), features: this.track });
    this.setData(SOURCES.reachStops, { ...emptyCollection<PointFeature<ReachStopProperties>>(), features: this.stops });
  }
}
