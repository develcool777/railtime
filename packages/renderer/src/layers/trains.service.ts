import type { LineId } from '@railtime/schema/network.types';
import type { FilterSpecification, Map as MapLibreMap } from 'maplibre-gl';
import { LAYERS, LINE_LAYOUT, SOURCES } from './ids.constants';
import { MapLayer } from './layer.service';
import type { FeatureCollection, LineFeature } from './snapshot.types';
import { emptyCollection } from './snapshot.utils';
import { byZoom, sideBySideOffset } from './style.utils';
import type { Palette } from './theme.types';
import { TRAIN_UPDATE_MS } from './trains.constants';

/** The layers a train is drawn on, bottom to top: its shadow, its line's colour, its body. */
const TRAIN_LAYERS = [LAYERS.trainShadow, LAYERS.trainCasing, LAYERS.trains];

/**
 * Trains running on the lines: a light body edged in its line's colour, which alone would vanish on
 * its own line, over a soft shadow. It sits as the lines do, side by side on shared track. Knows
 * nothing of where they are: the frames send it their track, as often as it says they are due.
 */
export class TrainLayer extends MapLayer {
  /** When trains were last drawn; `null` while none are on the map. */
  private drawnAt: number | null = null;

  public constructor(map: MapLibreMap) {
    super(map);
  }

  /**
   * Adds the source and its layers, empty.
   *
   * @param _font - Unused: nothing here is labelled.
   */
  public install(_font: string[]): void {
    this.addSource(SOURCES.trains);
    const offset = sideBySideOffset();
    this.map.addLayer({
      id: LAYERS.trainShadow,
      type: 'line',
      source: SOURCES.trains,
      layout: LINE_LAYOUT,
      paint: { 'line-width': byZoom(11, 22), 'line-blur': byZoom(5, 10), 'line-opacity': 0.35, 'line-offset': offset },
    });
    this.map.addLayer({
      id: LAYERS.trainCasing,
      type: 'line',
      source: SOURCES.trains,
      layout: LINE_LAYOUT,
      paint: { 'line-color': ['get', 'color'], 'line-width': byZoom(7, 14), 'line-offset': offset },
    });
    this.map.addLayer({
      id: LAYERS.trains,
      type: 'line',
      source: SOURCES.trains,
      layout: LINE_LAYOUT,
      paint: { 'line-width': byZoom(4, 8.5), 'line-offset': offset },
    });
  }

  /**
   * Colours the trains for a theme.
   *
   * @param palette - The theme's colours.
   */
  public applyPalette(palette: Palette): void {
    this.map.setPaintProperty(LAYERS.trainShadow, 'line-color', palette.trainShadow);
    this.map.setPaintProperty(LAYERS.trains, 'line-color', palette.trainBody);
  }

  /**
   * Whether the trains are due to move: at most so often, however fast the frames.
   *
   * @param now - The frame time.
   * @returns True if they are.
   */
  public dueAt(now: number): boolean {
    return this.drawnAt === null || now - this.drawnAt >= TRAIN_UPDATE_MS;
  }

  /**
   * Draws the trains.
   *
   * @param trains - Their track.
   * @param now - The frame time.
   */
  public update(trains: FeatureCollection<LineFeature>, now: number): void {
    this.setData(SOURCES.trains, trains);
    this.drawnAt = now;
  }

  /** Takes the trains off the map, if any are on it. */
  public clear(): void {
    if (this.drawnAt === null) return;
    this.setData(SOURCES.trains, emptyCollection());
    this.drawnAt = null;
  }

  /**
   * Runs only the trains of the lines brought forward: the others' lines have faded.
   *
   * @param lineIds - The lines; `null` for every line.
   */
  public focus(lineIds: LineId[] | null): void {
    const filter: FilterSpecification = lineIds ? ['in', ['get', 'line'], ['literal', lineIds]] : ['all'];
    for (const layer of TRAIN_LAYERS) this.map.setFilter(layer, filter);
  }
}
