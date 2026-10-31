import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import { emptyCollection } from './features.utils';
import type { Palette } from './theme.types';

/**
 * A group of overlay layers drawn from sources it owns. Each subclass adds its sources and layers
 * once the basemap has loaded (`install`), recolours them per theme (`applyPalette`), and pushes new
 * data through `setData`.
 */
export abstract class MapLayer {
  /** The map the layers are drawn on. */
  protected readonly map: MapLibreMap;

  protected constructor(map: MapLibreMap) {
    this.map = map;
  }

  /**
   * Adds the group's sources and layers on top of whatever is on the map.
   *
   * @param font - A font stack the basemap's glyph server has.
   */
  public abstract install(font: string[]): void;

  /**
   * Recolours the group's layers for a theme.
   *
   * @param palette - The theme's colours.
   */
  public abstract applyPalette(palette: Palette): void;

  /**
   * Adds an empty GeoJSON source.
   *
   * @param id - The source id.
   */
  protected addSource(id: string): void {
    this.map.addSource(id, { type: 'geojson', data: emptyCollection() });
  }

  /**
   * Replaces a source's data.
   *
   * @param sourceId - The source.
   * @param data - A GeoJSON feature collection.
   */
  protected setData(sourceId: string, data: object): void {
    (this.map.getSource(sourceId) as GeoJSONSource | undefined)?.setData(data as Parameters<GeoJSONSource['setData']>[0]);
  }
}
