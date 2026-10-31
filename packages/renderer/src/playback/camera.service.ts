import type { LngLat } from '@railtime/schema/network.types';
import type { LngLatBoundsLike, Map as MapLibreMap } from 'maplibre-gl';
import { clamp } from '../core/easing.utils';
import { boundsOf, distanceKm } from '@railtime/network/geometry.utils';
import type { Bounds } from '@railtime/network/geometry.types';
import type { StepAnimation } from '../steps/animation.service';
import type { Padding, ViewMode } from '../transitMap.types';
import { NO_COVER } from '../transitMap.constants';
import {
  FOLLOW_MAX_ZOOM,
  MIN_MOVE_MS,
  OVERVIEW_MAX_ZOOM,
  STATION_MIN_ZOOM,
  VIEW_3D_BEARING,
  VIEW_3D_ENTRY_ZOOM,
  VIEW_3D_PITCH,
  VIEW_TILT_MS,
  ZOOM_SLACK,
} from './camera.constants';
import type { CameraSettings, Chase } from './camera.types';
import { chaseStartOf, chaseZoomOf, followOf } from './camera.utils';

/**
 * Moves the main map's camera for playback. `follow` frames just the change, so a single new
 * station gets a close-up; `overview` frames the change with the network already on the map;
 * `free` leaves the camera to the user. Seen in 3D, `follow` flies down to where a change starts
 * and then moves with it as it is drawn, frame by frame, as a drone following a new line.
 */
export class CameraDirector {
  /** The map whose camera this moves. */
  private readonly map: MapLibreMap;
  /** How it is set: the map's props, read each time, never kept. */
  private readonly settings: () => CameraSettings;
  /** What the camera last tilted the map to: it tilts again when the settings' view differs. */
  private tilted: ViewMode = '2d';
  /** In 3D, where the camera looks from as it follows the change playing; `null` between changes. */
  private chase: Chase | null = null;

  public constructor(map: MapLibreMap, settings: () => CameraSettings) {
    this.map = map;
    this.settings = settings;
  }

  /**
   * How the map is seen, as the settings say.
   *
   * @returns Flat, or in 3D.
   */
  public get viewMode(): ViewMode {
    return this.settings().viewMode;
  }

  /** Room the app's panels take, kept clear when framing. */
  private get padding(): Padding {
    return this.settings().padding;
  }

  /** How the camera follows playback. */
  private get mode(): CameraSettings['camera'] {
    return this.settings().camera;
  }

  /**
   * Tilts the map as the settings' view says, if it is not so already: into 3D, the camera tilts and
   * comes down to where the buildings stand; back, it lies flat and faces north, where it is.
   */
  public tilt(): void {
    const view = this.viewMode;
    if (view === this.tilted) return;
    this.tilted = view;
    this.chase = null;
    this.map.easeTo(
      view === '3d'
        ? { pitch: VIEW_3D_PITCH, bearing: VIEW_3D_BEARING, zoom: Math.max(this.map.getZoom(), VIEW_3D_ENTRY_ZOOM), duration: VIEW_TILT_MS }
        : { pitch: 0, bearing: 0, duration: VIEW_TILT_MS },
    );
  }

  /**
   * Flies to a point, at least so close, keeping the view's tilt: for a station picked.
   *
   * @param center - Where to.
   * @param minZoom - The farthest it stays.
   * @param durationMs - How long the move takes.
   */
  public flyTo(center: LngLat, minZoom: number, durationMs: number): void {
    const tilt = this.tilted === '3d' ? { pitch: VIEW_3D_PITCH } : { pitch: 0, bearing: 0 };
    this.map.easeTo({ center, zoom: Math.max(this.map.getZoom(), minZoom), ...tilt, duration: durationMs });
  }

  /**
   * Frames a step as it starts, if it needs framing: what it touches already in view, at about the
   * zoom it would be framed at, leaves the camera where it is. A lone station is panned to, keeping
   * the zoom, rather than dived into.
   *
   * @param animation - The step's animation.
   * @param stationsOnMap - Stations already on the map, for `overview`.
   * @param coordOf - Where a station is.
   * @param durationMs - How long the move should take; it takes at least `MIN_MOVE_MS`.
   * @returns How long the move takes, ms; 0 when the camera stays.
   */
  public focusStep(animation: StepAnimation, stationsOnMap: Set<string>, coordOf: (station: string) => LngLat, durationMs: number): number {
    if (this.mode === 'free') return 0;
    const points = animation.cameraPoints();
    if (this.mode === 'overview') for (const station of stationsOnMap) points.push(coordOf(station));
    const bounds = boundsOf(points);
    if (!bounds) return 0;
    if (this.viewMode === '3d' && this.mode === 'follow') return this.flyToStart(animation, bounds, Math.max(MIN_MOVE_MS, durationMs));
    const maxZoom = this.closestZoom(points.length);
    if (this.frames(points, bounds, maxZoom)) return 0;
    const moveMs = Math.max(MIN_MOVE_MS, durationMs);
    this.fit(bounds, maxZoom, moveMs);
    return moveMs;
  }

  /**
   * Frames a bounding box, whatever the mode.
   *
   * @param bounds - What to frame.
   * @param maxZoom - The closest the camera may go.
   * @param durationMs - How long the move takes.
   * @param room - Room to keep clear beyond the app's padding, pixels: for names drawn beside what is framed.
   */
  public fit(bounds: Bounds, maxZoom: number, durationMs: number, room: Partial<Padding> = {}): void {
    const padding = {
      top: this.padding.top + (room.top ?? 0),
      right: this.padding.right + (room.right ?? 0),
      bottom: this.padding.bottom + (room.bottom ?? 0),
      left: this.padding.left + (room.left ?? 0),
    };
    this.map.fitBounds(bounds as LngLatBoundsLike, { padding, maxZoom, duration: durationMs });
  }

  /**
   * In 3D, follows the change playing as it is drawn: called each frame with its growing tips. Leaves the
   * camera be on the flat map, in another mode, while it is moving (flying to the change, or dragged), or with no tip.
   *
   * @param tips - The growing tips this frame.
   * @param seconds - The time since the last frame.
   */
  public follow(tips: LngLat[], seconds: number): void {
    if (this.viewMode !== '3d' || this.mode !== 'follow' || !this.chase || tips.length === 0 || this.map.isMoving()) return;
    this.chase = followOf(this.chase, tips, seconds);
    this.map.jumpTo({ center: this.chase.center, bearing: this.chase.bearing });
  }

  /**
   * In 3D, flies down to where a change starts, facing the rest of it, close enough to see it drawn.
   *
   * @param animation - The change's animation.
   * @param bounds - The box round it.
   * @param durationMs - How long the move takes.
   * @returns How long the move takes, ms.
   */
  private flyToStart(animation: StepAnimation, bounds: Bounds, durationMs: number): number {
    const [southWest, northEast] = bounds;
    const middle: LngLat = [(southWest[0] + northEast[0]) / 2, (southWest[1] + northEast[1]) / 2];
    this.chase = chaseStartOf(animation.startPoint() ?? middle, middle, this.map.getBearing());
    const zoom = chaseZoomOf(distanceKm(southWest, northEast));
    this.map.easeTo({ center: this.chase.center, bearing: this.chase.bearing, zoom, pitch: VIEW_3D_PITCH, duration: durationMs });
    return durationMs;
  }

  /**
   * Whether the camera already frames some points: each inside the view, clear of the panels over it, at
   * about the zoom they would be framed at.
   *
   * @param points - The points.
   * @param bounds - Their bounding box.
   * @param maxZoom - The closest a framing may go.
   * @returns Whether to leave the camera be.
   */
  private frames(points: LngLat[], bounds: Bounds, maxZoom: number): boolean {
    const { clientWidth, clientHeight } = this.map.getContainer();
    // Clear of the app's panels over the map (its padding) as well as the room kept round a change.
    const cover = { ...NO_COVER, ...this.map.getPadding() };
    const [left, right, top, bottom] = [
      cover.left + this.padding.left,
      cover.right + this.padding.right,
      cover.top + this.padding.top,
      cover.bottom + this.padding.bottom,
    ];
    const inView = points.every(point => {
      const { x, y } = this.map.project(point);
      return x >= left && x <= clientWidth - right && y >= top && y <= clientHeight - bottom;
    });
    const framing = this.map.cameraForBounds(bounds as LngLatBoundsLike, { padding: this.padding, maxZoom });
    return inView && framing?.zoom !== undefined && Math.abs(this.map.getZoom() - framing.zoom) < ZOOM_SLACK;
  }

  /**
   * The closest the camera may go to frame a change.
   *
   * @param count - How many points it touches.
   * @returns A zoom.
   */
  private closestZoom(count: number): number {
    if (this.mode === 'overview') return OVERVIEW_MAX_ZOOM;
    // A lone station keeps the zoom, within reason.
    return count === 1 ? clamp(this.map.getZoom(), STATION_MIN_ZOOM, FOLLOW_MAX_ZOOM) : FOLLOW_MAX_ZOOM;
  }
}
