import type { DataDrivenPropertyValueSpecification, Map as MapLibreMap } from 'maplibre-gl';
import { byZoom, sideBySideOffset } from './layerStyle.utils';
import { LAYERS, LINE_LAYOUT, SOURCES, UNFOCUSED_OPACITY } from './layers.constants';
import { MapLayer } from './mapLayer.service';
import type { NetworkSnapshot } from './networkSnapshot.types';
import type { Palette } from './theme.types';

/** How opaque each of the layer's line layers is with every line in focus; the glow's is the theme's. */
const FULL_OPACITY = { [LAYERS.ghosts]: 0.35, [LAYERS.lines]: 1, [LAYERS.planned]: 0.85 } as const;

/**
 * The network already on the map: every open line, with a soft glow beneath, closed track as dashed
 * ghosts, planned track dashed in its line's colour, and transfers between stations as links drawn like an interchange's ring.
 */
export class NetworkLayer extends MapLayer {
  /** The lines in focus, the rest faded; `null` when every line is. */
  private focused: string[] | null = null;
  /** The glow's opacity in the current theme. */
  private glowOpacity = 0;

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
      paint: { 'line-color': ['get', 'color'], 'line-width': byZoom(1.2, 3), 'line-opacity': FULL_OPACITY[LAYERS.ghosts], 'line-dasharray': [1.5, 2] },
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
        'line-opacity': FULL_OPACITY[LAYERS.planned],
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
    this.glowOpacity = palette.glowOpacity;
    this.map.setPaintProperty(LAYERS.transferCasing, 'line-color', palette.interchangeRing);
    this.applyFocus();
  }

  /**
   * Brings some lines forward and fades the rest, or shows every line alike.
   *
   * @param lineIds - The lines in focus; `null` for every line.
   */
  public focus(lineIds: string[] | null): void {
    this.focused = lineIds;
    this.applyFocus();
  }

  /** Sets each line layer's opacity: full for the lines in focus, faded for the rest. */
  private applyFocus(): void {
    const opacities = [
      [LAYERS.ghosts, FULL_OPACITY[LAYERS.ghosts]],
      [LAYERS.glow, this.glowOpacity],
      [LAYERS.lines, FULL_OPACITY[LAYERS.lines]],
      [LAYERS.planned, FULL_OPACITY[LAYERS.planned]],
    ] as const;
    for (const [layer, full] of opacities) this.map.setPaintProperty(layer, 'line-opacity', this.opacityFor(full));
  }

  /**
   * A layer's opacity, given how opaque it is in focus.
   *
   * @param full - Its opacity in focus.
   * @returns A constant with every line in focus; else an expression on each feature's line.
   */
  private opacityFor(full: number): DataDrivenPropertyValueSpecification<number> {
    if (this.focused === null) return full;
    return ['case', ['in', ['get', 'line'], ['literal', this.focused]], full, full * UNFOCUSED_OPACITY];
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
