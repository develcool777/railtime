import type { Map as MapLibreMap } from 'maplibre-gl';
import type { StepDrawing } from '../steps/stepAnimation.types';
import { byZoom, highlightedWidth, sideBySideOffset } from './layerStyle.utils';
import { LAYERS, LINE_LAYOUT, SOURCES } from './layers.constants';
import { MapLayer } from './mapLayer.service';
import type { Palette } from './theme.types';

/** What the playing step draws: track growing or retracting, wider while new, with a glowing head at each growing tip. */
export class ActiveStepLayer extends MapLayer {
  /** The map shows a drawing with something in it: an empty one clears it once, then sends nothing. */
  private drawn = false;

  public constructor(map: MapLibreMap) {
    super(map);
  }

  /** Adds the growing track and head layers. */
  public install(): void {
    this.addSource(SOURCES.active);
    this.addSource(SOURCES.heads);
    this.map.addLayer({
      id: LAYERS.activeGlow,
      type: 'line',
      source: SOURCES.active,
      layout: LINE_LAYOUT,
      paint: { 'line-color': ['get', 'color'], 'line-width': highlightedWidth(6, 18), 'line-blur': byZoom(5, 14), 'line-offset': sideBySideOffset() },
    });
    this.map.addLayer({
      id: LAYERS.activeLines,
      type: 'line',
      source: SOURCES.active,
      layout: LINE_LAYOUT,
      paint: { 'line-color': ['get', 'color'], 'line-width': highlightedWidth(2.2, 5.5), 'line-offset': sideBySideOffset() },
    });
    this.map.addLayer({
      id: LAYERS.headGlow,
      type: 'circle',
      source: SOURCES.heads,
      paint: { 'circle-color': ['get', 'color'], 'circle-radius': byZoom(8, 16), 'circle-blur': 1, 'circle-opacity': 0.9 },
    });
    this.map.addLayer({ id: LAYERS.headCore, type: 'circle', source: SOURCES.heads, paint: { 'circle-color': '#ffffff', 'circle-radius': byZoom(2, 4) } });
  }

  /**
   * Sets the glow's strength for the theme.
   *
   * @param palette - The theme's colours.
   */
  public applyPalette(palette: Palette): void {
    this.map.setPaintProperty(LAYERS.activeGlow, 'line-opacity', palette.glowOpacity);
  }

  /**
   * Draws this frame of the playing step. Between steps the frames are empty: the first clears the
   * map, the rest send nothing, so MapLibre has nothing to re-tile.
   *
   * @param drawing - What the step draws now.
   */
  public update(drawing: StepDrawing): void {
    const drawn = drawing.lines.features.length > 0 || drawing.heads.features.length > 0;
    if (!drawn && !this.drawn) return;
    this.drawn = drawn;
    this.setData(SOURCES.active, drawing.lines);
    this.setData(SOURCES.heads, drawing.heads);
  }
}
