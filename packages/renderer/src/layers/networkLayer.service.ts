import type { Map as MapLibreMap } from 'maplibre-gl';
import { byZoom, sideBySideOffset } from './layerStyle.utils';
import { LAYERS, LINE_LAYOUT, SOURCES } from './layers.constants';
import { MapLayer } from './mapLayer.service';
import type { NetworkSnapshot } from './networkSnapshot.types';
import type { Palette } from './theme.types';

/** The network already on the map: every open line, with a soft glow beneath, and closed track as dashed ghosts. */
export class NetworkLayer extends MapLayer {
  public constructor(map: MapLibreMap) {
    super(map);
  }

  /** Adds the ghost, glow and line layers. */
  public install(): void {
    this.addSource(SOURCES.ghosts);
    this.addSource(SOURCES.lines);
    this.map.addLayer({
      id: LAYERS.ghosts,
      type: 'line',
      source: SOURCES.ghosts,
      layout: LINE_LAYOUT,
      paint: { 'line-color': ['get', 'color'], 'line-width': byZoom(1.2, 3), 'line-opacity': 0.35, 'line-dasharray': [1.5, 2] },
    });
    this.map.addLayer({
      id: LAYERS.glow,
      type: 'line',
      source: SOURCES.lines,
      layout: LINE_LAYOUT,
      paint: { 'line-color': ['get', 'color'], 'line-width': byZoom(6, 18), 'line-blur': byZoom(5, 14), 'line-offset': sideBySideOffset() },
    });
    this.map.addLayer({
      id: LAYERS.lines,
      type: 'line',
      source: SOURCES.lines,
      layout: LINE_LAYOUT,
      paint: { 'line-color': ['get', 'color'], 'line-width': byZoom(2.2, 5.5), 'line-offset': sideBySideOffset() },
    });
  }

  /**
   * Sets the glow's strength for the theme.
   *
   * @param palette - The theme's colours.
   */
  public applyPalette(palette: Palette): void {
    this.map.setPaintProperty(LAYERS.glow, 'line-opacity', palette.glowOpacity);
  }

  /**
   * Draws a snapshot of the network.
   *
   * @param snapshot - What is on the map.
   */
  public update(snapshot: NetworkSnapshot): void {
    this.setData(SOURCES.lines, snapshot.lines);
    this.setData(SOURCES.ghosts, snapshot.ghosts);
  }
}
