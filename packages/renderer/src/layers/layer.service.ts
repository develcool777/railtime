import { required } from '@railtime/core/required.utils';
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import { OVERLAY_SOURCE_MAX_ZOOM } from './ids.constants';
import { emptyCollection } from './snapshot.utils';
import type { Palette } from './theme.types';

/**
 * A group of overlay layers drawn from sources it owns. Each subclass adds its sources and layers
 * once the basemap has loaded (`install`), recolours them per theme (`applyPalette`), and pushes new
 * data through `setData`. Nothing reaches it before it is installed (`PropsReconciler` holds every
 * effect until then), so it keeps nothing to draw later.
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
   * Adds an empty GeoJSON source, cut into tiles no closer than `OVERLAY_SOURCE_MAX_ZOOM`.
   *
   * @param id - The source id.
   * @param options - The property its features are known by, for feature state; a closest zoom of its own.
   * @param options.promoteId - The property.
   * @param options.maxzoom - The zoom.
   */
  protected addSource(id: string, options: { promoteId?: string; maxzoom?: number } = {}): void {
    this.map.addSource(id, { type: 'geojson', data: emptyCollection(), maxzoom: OVERLAY_SOURCE_MAX_ZOOM, ...options });
  }

  /**
   * Sets how one feature looks this frame, with no data sent: MapLibre redraws it, re-cutting no tile.
   *
   * @param sourceId - The source.
   * @param id - The feature's id (its `promoteId` property).
   * @param state - What it looks like.
   */
  protected setState(sourceId: string, id: string, state: Record<string, number>): void {
    this.map.setFeatureState({ source: sourceId, id }, state);
  }

  /**
   * Replaces a source's data.
   *
   * @param sourceId - The source.
   * @param data - A GeoJSON feature collection.
   */
  protected setData(sourceId: string, data: object): void {
    void required(this.map.getSource<GeoJSONSource>(sourceId), `source ${sourceId}`).setData(data as Parameters<GeoJSONSource['setData']>[0]);
  }
}
