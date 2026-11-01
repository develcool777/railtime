import type { DataDrivenPropertyValueSpecification, FilterSpecification, Map as MapLibreMap } from 'maplibre-gl';
import { GROWING_SOURCE_MAX_ZOOM, LAYERS, LINE_LAYOUT, PLANNED_DASHES, SOURCES, UNFOCUSED_OPACITY } from './ids.constants';
import { MapLayer } from './layer.service';
import type { NetworkSnapshot } from './snapshot.types';
import type { Palette } from './theme.types';
import type { StepDrawing } from '../steps/animation.types';
import { byZoom, highlightedWidth, sideBySideOffset } from './style.utils';

/** How opaque each of the layer's line layers is with every line in focus; the glow's is the theme's. */
const FULL_OPACITY = { [LAYERS.ghosts]: 0.35, [LAYERS.lines]: 1, [LAYERS.planned]: 0.85, [LAYERS.transferCasing]: 1, [LAYERS.transferCore]: 1 } as const;

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
        'line-dasharray': PLANNED_DASHES,
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
      // A transfer's link belongs to no line: it fades whenever some lines are brought forward.
      [LAYERS.transferCasing, FULL_OPACITY[LAYERS.transferCasing]],
      [LAYERS.transferCore, FULL_OPACITY[LAYERS.transferCore]],
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

/**
 * What the playing step draws: track growing or retracting, wider while new, with a glowing head at
 * each growing tip, and the transfers it links as it reaches them, drawn as the network's are.
 */
export class ActiveStepLayer extends MapLayer {
  /** What each source was sent last: a source whose data is the same is not sent again, so MapLibre cuts none of its tiles. */
  private readonly sent = new Map<string, string>();
  /** The highlight's fade the layers were last set to, to a hundredth. */
  private fade = -1;

  public constructor(map: MapLibreMap) {
    super(map);
  }

  /** Adds the layers: the track drawn whole, the track growing and its heads, the links. */
  public install(): void {
    this.addSource(SOURCES.active);
    this.addSource(SOURCES.growing, { maxzoom: GROWING_SOURCE_MAX_ZOOM });
    this.addSource(SOURCES.activeTransfers);
    // New sources are empty: what is sent next is anything but nothing; the fade is set afresh.
    for (const source of [SOURCES.active, SOURCES.growing, SOURCES.activeTransfers]) this.sent.set(source, '[]');
    this.fade = -1;
    // Built track glows; a plan's is drawn as the network draws it, broken, with no glow.
    const built: FilterSpecification = ['all', ['==', ['geometry-type'], 'LineString'], ['!', ['get', 'planned']]];
    const planned: FilterSpecification = ['all', ['==', ['geometry-type'], 'LineString'], ['get', 'planned']];
    for (const [source, glow, line, plannedLine] of [
      [SOURCES.active, LAYERS.activeGlow, LAYERS.activeLines, LAYERS.activePlanned],
      [SOURCES.growing, LAYERS.growingGlow, LAYERS.growingLines, LAYERS.growingPlanned],
    ] as const) {
      this.map.addLayer({
        id: glow,
        type: 'line',
        source,
        filter: built,
        layout: LINE_LAYOUT,
        paint: { 'line-color': ['get', 'color'], 'line-width': highlightedWidth(6, 18), 'line-blur': byZoom(5, 14), 'line-offset': sideBySideOffset() },
      });
      this.map.addLayer({
        id: line,
        type: 'line',
        source,
        filter: built,
        layout: LINE_LAYOUT,
        paint: { 'line-color': ['get', 'color'], 'line-width': highlightedWidth(2.2, 5.5), 'line-offset': sideBySideOffset() },
      });
      this.map.addLayer({
        id: plannedLine,
        type: 'line',
        source,
        filter: planned,
        layout: { 'line-join': 'round' },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': highlightedWidth(2.2, 5.5),
          'line-offset': sideBySideOffset(),
          'line-opacity': FULL_OPACITY[LAYERS.planned],
          'line-dasharray': PLANNED_DASHES,
        },
      });
    }
    const point: FilterSpecification = ['==', ['geometry-type'], 'Point'];
    this.map.addLayer({
      id: LAYERS.headGlow,
      type: 'circle',
      source: SOURCES.growing,
      filter: point,
      paint: { 'circle-color': ['get', 'color'], 'circle-radius': byZoom(8, 16), 'circle-blur': 1, 'circle-opacity': 0.9 },
    });
    this.map.addLayer({
      id: LAYERS.headCore,
      type: 'circle',
      source: SOURCES.growing,
      filter: point,
      paint: { 'circle-color': '#ffffff', 'circle-radius': byZoom(2, 4) },
    });
    this.map.addLayer({
      id: LAYERS.activeTransferCasing,
      type: 'line',
      source: SOURCES.activeTransfers,
      layout: LINE_LAYOUT,
      paint: { 'line-width': byZoom(5, 11) },
    });
    this.map.addLayer({
      id: LAYERS.activeTransferCore,
      type: 'line',
      source: SOURCES.activeTransfers,
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
    for (const glow of [LAYERS.activeGlow, LAYERS.growingGlow]) this.map.setPaintProperty(glow, 'line-opacity', palette.glowOpacity);
    this.map.setPaintProperty(LAYERS.activeTransferCasing, 'line-color', palette.interchangeRing);
  }

  /**
   * Draws this frame of the playing step: each source sent only when what it holds changed, so MapLibre
   * re-cuts no tiles for the rest, nor between steps. Each frame the growing piece and its head move,
   * a few metres sent; the track drawn whole only when a segment is done; the highlight's fade a paint value.
   *
   * @param drawing - What the step draws now.
   */
  public update(drawing: StepDrawing): void {
    const fade = Math.round(drawing.highlight * 100) / 100;
    if (fade !== this.fade) {
      this.fade = fade;
      for (const [glow, line] of [
        [LAYERS.activeGlow, LAYERS.activeLines],
        [LAYERS.growingGlow, LAYERS.growingLines],
      ] as const)
        this.setWidths(glow, line, fade);
      for (const planned of [LAYERS.activePlanned, LAYERS.growingPlanned]) this.map.setPaintProperty(planned, 'line-width', highlightedWidth(2.2, 5.5, fade));
    }
    const growing = { type: 'FeatureCollection', features: [...drawing.growing.features, ...drawing.heads.features] };
    for (const [source, data] of [
      [SOURCES.active, drawing.lines],
      [SOURCES.growing, growing],
      [SOURCES.activeTransfers, drawing.links],
    ] as const) {
      const key = JSON.stringify(data.features);
      if (this.sent.get(source) === key) continue;
      this.sent.set(source, key);
      this.setData(source, data);
    }
  }

  /**
   * Sets how wide new track stands out, on a glow layer and its line layer.
   *
   * @param glow - The glow layer.
   * @param line - The line layer.
   * @param fade - How much of the highlight is left, 0..1.
   */
  private setWidths(glow: string, line: string, fade: number): void {
    this.map.setPaintProperty(glow, 'line-width', highlightedWidth(6, 18, fade));
    this.map.setPaintProperty(line, 'line-width', highlightedWidth(2.2, 5.5, fade));
  }
}
