import type { Map as MapLibreMap } from 'maplibre-gl';
import { byZoom, sideBySideOffset } from './layerStyle.utils';
import { LAYERS, LINE_LAYOUT, SOURCES } from './layers.constants';
import { MapLayer } from './mapLayer.service';
import type { NetworkSnapshot } from './networkSnapshot.types';
import type { Palette } from './theme.types';

/**
 * The network already on the map: every open line, with a soft glow beneath, closed track as dashed
 * ghosts, planned track dashed in its line's colour, and transfers between stations as links drawn like an interchange's ring.
 */
export class NetworkLayer extends MapLayer {
  public constructor(map: MapLibreMap) {
    super(map);
  }

  /** Adds the ghost, glow, line, planned and transfer layers. */
  public install(): void {
    this.addSource(SOURCES.ghosts);
    this.addSource(SOURCES.lines);
    this.addSource(SOURCES.planned);
    this.addSource(SOURCES.transfers);
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
    // Not built yet: the line's colour, broken, and no glow.
    this.map.addLayer({
      id: LAYERS.planned,
      type: 'line',
      source: SOURCES.planned,
      layout: { 'line-join': 'round' },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': byZoom(2.2, 5.5),
        'line-offset': sideBySideOffset(),
        'line-opacity': 0.85,
        'line-dasharray': [1.2, 1],
      },
    });
    // A link between two interchange dots: the dots' ring colour round their white fill.
    this.map.addLayer({ id: LAYERS.transferCasing, type: 'line', source: SOURCES.transfers, layout: LINE_LAYOUT, paint: { 'line-width': byZoom(5, 11) } });
    this.map.addLayer({
      id: LAYERS.transferCore,
      type: 'line',
      source: SOURCES.transfers,
      layout: LINE_LAYOUT,
      paint: { 'line-color': '#ffffff', 'line-width': byZoom(2.5, 6) },
    });
  }

  /**
   * Sets the glow's strength for the theme.
   *
   * @param palette - The theme's colours.
   */
  public applyPalette(palette: Palette): void {
    this.map.setPaintProperty(LAYERS.glow, 'line-opacity', palette.glowOpacity);
    this.map.setPaintProperty(LAYERS.transferCasing, 'line-color', palette.interchangeRing);
  }

  /**
   * Draws a snapshot of the network.
   *
   * @param snapshot - What is on the map.
   */
  public update(snapshot: NetworkSnapshot): void {
    this.setData(SOURCES.lines, snapshot.lines);
    this.setData(SOURCES.ghosts, snapshot.ghosts);
    this.setData(SOURCES.planned, snapshot.planned);
    this.setData(SOURCES.transfers, snapshot.transfers);
  }
}
