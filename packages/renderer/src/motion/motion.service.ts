import { keysOf } from '@railtime/core/collection.utils';
import type { CustomRenderMethodInput, Map as MapLibreMap } from 'maplibre-gl';
import type { Mover, MoverStyle } from './motion.types';
import { anchoredMatrix, drawOrderOf, mercatorOf, passesOf, strokeVerticesOf, worldPixelsAt } from './motion.utils';
import { StrokePainter } from './painter.service';
import { LAYERS } from '../layers/ids.constants';
import { MapLayer } from '../layers/layer.service';
import { SIDE_BY_SIDE_PX } from '../layers/style.constants';
import { atZoom } from '../layers/style.utils';
import type { Palette } from '../layers/theme.types';

/**
 * What moves on the map, every frame: each kind (trains, and whatever else comes to move) as its
 * style says, side by side on shared track as its lines are, over the network and the buildings and
 * under the stations. Drawn by the map itself as it draws a frame, in its own WebGL, where they are
 * that frame: never a source sent to MapLibre, whose tiles would be cut again for every move. Knows
 * nothing of what moves or where: the frames give each kind's movers as they move.
 */
export class MotionLayer<Kind extends string> extends MapLayer {
  /** How each kind is drawn, in the order drawn, bottom to top. */
  private readonly styles: Record<Kind, MoverStyle>;
  /** Each kind's movers, as last given. */
  private readonly movers = new Map<Kind, readonly Mover[]>();
  /** The theme's colours; `null` until a theme is applied. */
  private palette: Palette | null = null;
  /** Whether they stand up, as the map is seen in 3D. */
  private standing = false;
  /** The groups brought forward; `null` for every one. */
  private focused: ReadonlySet<string> | null = null;
  /** Draws with the map's WebGL, once the map has added the layer. */
  private painter: StrokePainter | null = null;

  public constructor(map: MapLibreMap, styles: Record<Kind, MoverStyle>) {
    super(map);
    this.styles = styles;
  }

  /**
   * Adds the layer the map draws them on, as it draws a frame: over what is under it, the buildings in
   * 3D among them, as a lines' layer is drawn.
   *
   * @param _font - Unused: nothing here is labelled.
   */
  public install(_font: string[]): void {
    this.map.addLayer({
      id: LAYERS.motion,
      type: 'custom',
      renderingMode: '2d',
      onAdd: (_map, context) => {
        this.painter = new StrokePainter(context);
      },
      render: (_gl, args) => this.render(args),
      onRemove: () => {
        this.painter?.destroy();
        this.painter = null;
      },
    });
  }

  /**
   * Colours them for a theme.
   *
   * @param palette - The theme's colours.
   */
  public applyPalette(palette: Palette): void {
    this.palette = palette;
    this.map.triggerRepaint();
  }

  /**
   * Where a kind's movers are this frame: drawn as the map next draws.
   *
   * @param kind - The kind.
   * @param movers - Its movers; none to take it off the map.
   */
  public show(kind: Kind, movers: readonly Mover[]): void {
    if (movers.length === 0 && (this.movers.get(kind)?.length ?? 0) === 0) return;
    this.movers.set(kind, movers);
    this.map.triggerRepaint();
  }

  /**
   * Stands them up off the ground, as the map is seen in 3D, or lays them on it.
   *
   * @param standing - Whether they stand.
   */
  public stand(standing: boolean): void {
    this.standing = standing;
    this.map.triggerRepaint();
  }

  /**
   * Draws only the movers of the groups brought forward: the others' lines have faded.
   *
   * @param groups - The groups; `null` for every one.
   */
  public focus(groups: readonly string[] | null): void {
    this.focused = groups ? new Set(groups) : null;
    this.map.triggerRepaint();
  }

  /**
   * Draws them, as the map draws a frame.
   *
   * @param args - What the map says of the frame: its projection.
   */
  private render(args: CustomRenderMethodInput): void {
    const { painter, palette, focused } = this;
    if (!painter || !palette) return;
    const center = this.map.getCenter();
    const anchor = mercatorOf([center.lng, center.lat]);
    const zoom = this.map.getZoom();
    const view = { zoom, pitch: this.map.getPitch(), standing: this.standing };
    const matrix = anchoredMatrix(args.defaultProjectionData.mainMatrix, anchor, worldPixelsAt(zoom));
    for (const kind of keysOf(this.styles)) {
      const shown = (this.movers.get(kind) ?? []).filter(({ group }) => !focused || focused.has(group));
      if (shown.length === 0) continue;
      const strokes = strokeVerticesOf(shown, anchor, worldPixelsAt(zoom));
      painter.draw(
        {
          vertices: strokes.vertices,
          order: drawOrderOf(strokes, matrix, this.standing),
          passes: passesOf(this.styles[kind], palette, view),
          slotPx: atZoom(SIDE_BY_SIDE_PX, zoom),
        },
        matrix,
      );
    }
  }
}
