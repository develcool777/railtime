import type { LngLat } from '@railtime/schema/network.types';
import type { LngLatBoundsLike, Map as MapLibreMap } from 'maplibre-gl';
import { boundsOf } from '../model/geometry.utils';
import type { Bounds } from '../model/geometry.types';
import type { StepAnimation } from '../steps/stepAnimation.service';
import type { CameraMode, Padding } from '../transitMap.types';

/** Closest zoom when following one change, and when framing the network around it. */
const FOLLOW_MAX_ZOOM = 13.5;
const OVERVIEW_MAX_ZOOM = 12.5;

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
   * Frames a step as it starts.
   *
   * @param animation - The step's animation.
   * @param stationsOnMap - Stations already on the map, for `overview`.
   * @param coordOf - Where a station is.
   * @param durationMs - How long the move takes.
   */
  public focusStep(animation: StepAnimation, stationsOnMap: Set<string>, coordOf: (station: string) => LngLat, durationMs: number): void {
    if (this.mode === 'free') return;
    const points = animation.cameraPoints();
    if (this.mode === 'overview') for (const station of stationsOnMap) points.push(coordOf(station));
    const bounds = boundsOf(points);
    if (bounds) this.fit(bounds, this.mode === 'follow' ? FOLLOW_MAX_ZOOM : OVERVIEW_MAX_ZOOM, durationMs);
  }

  /**
   * Frames a bounding box, whatever the mode.
   *
   * @param bounds - What to frame.
   * @param maxZoom - The closest the camera may go.
   * @param durationMs - How long the move takes.
   */
  public fit(bounds: Bounds, maxZoom: number, durationMs: number): void {
    this.map.fitBounds(bounds as LngLatBoundsLike, { padding: this.padding, maxZoom, duration: durationMs });
  }
}
