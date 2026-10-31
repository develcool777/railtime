import type { LngLat } from '@railtime/schema/network.types';
import type { LngLatBoundsLike, Map as MapLibreMap } from 'maplibre-gl';
import { clamp } from '../core/easing.utils';
import { boundsOf } from '../core/geometry.utils';
import type { Bounds } from '../core/geometry.types';
import type { StepAnimation } from '../steps/animation.service';
import type { CameraMode, Padding } from '../transitMap.types';
import { FOLLOW_MAX_ZOOM, MIN_MOVE_MS, OVERVIEW_MAX_ZOOM, STATION_MIN_ZOOM, ZOOM_SLACK } from './camera.constants';

/**
 * Moves the main map's camera for playback. `follow` frames just the change, so a single new
 * station gets a close-up; `overview` frames the change with the network already on the map;
 * `free` leaves the camera to the user.
 */
export class CameraDirector {
  /** How the camera follows playback. */
  public mode: CameraMode = 'follow';
  /** Room the app's panels take, kept clear when framing. */
  public padding: Padding;
  /** The map whose camera this moves. */
  private readonly map: MapLibreMap;

  public constructor(map: MapLibreMap, padding: Padding) {
    this.map = map;
    this.padding = padding;
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
   * Whether the camera already frames some points: each inside the view, clear of the panels, at
   * about the zoom they would be framed at.
   *
   * @param points - The points.
   * @param bounds - Their bounding box.
   * @param maxZoom - The closest a framing may go.
   * @returns Whether to leave the camera be.
   */
  private frames(points: LngLat[], bounds: Bounds, maxZoom: number): boolean {
    const { clientWidth, clientHeight } = this.map.getContainer();
    const inView = points.every(point => {
      const { x, y } = this.map.project(point);
      return x >= this.padding.left && x <= clientWidth - this.padding.right && y >= this.padding.top && y <= clientHeight - this.padding.bottom;
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
