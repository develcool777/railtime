import type { CityBoundary } from '@railtime/schema/boundary.types';
import { coverageDrawing } from '../coverage/layer.utils';
import { boundsOf } from '@railtime/network/engine/geometry.utils';
import { reachStops, reachTrack } from '../reach/layer.utils';
import { routeStops, routeTrack } from '../route/layer.utils';
import { OPENING_MAX_ZOOM, ROUTE_NAME_ROOM, SELECTED_STATION_ZOOM, SELECT_FLY_MS } from '../transitMap.constants';
import type { OverlayRequest } from '../transitMap.types';
import type { OverlayParts } from './controller.types';
import { overlaySubjectOf } from './controller.utils';

/**
 * What is drawn over the network: a route, a reach or the city's coverage, as the props ask. Works it
 * out at the moment shown, draws it (clearing the others), frames it when it is of something new, and
 * reports what it came to; again whenever the moment moves on, the theme or the outline changes.
 */
export class OverlayController {
  /** The layers, the camera, the network's facts, and where the moment and theme are read. */
  private readonly parts: OverlayParts;
  /** The cursor it was last worked out at: it is worked out again when the moment moves on. */
  private drawnAt = -1;
  /** What the overlay the camera last framed was of: a new one is framed, the same one left be. */
  private framed: string | null = null;
  /** The outline it was last drawn with: a new one frames coverage again. */
  private boundary: CityBoundary | null = null;

  public constructor(parts: OverlayParts) {
    this.parts = parts;
  }

  /** Whether the network is a backdrop behind the overlay: a route or a reach is drawn. */
  public get backdrop(): boolean {
    return this.parts.route.shown || this.parts.reach.shown;
  }

  /**
   * Works out the overlay at the moment shown, draws it, frames a new one and reports it.
   *
   * @param request - What the props ask for.
   * @param boundary - The city's outline, for coverage.
   */
  public draw(request: OverlayRequest | null, boundary: CityBoundary | null): void {
    const { facts, route: routeLayer, reach: reachLayer, coverage: coverageLayer, camera } = this.parts;
    const moment = this.parts.moment();
    const theme = this.parts.theme();
    const then = facts.asOf(moment);
    this.drawnAt = moment.cursor;
    if (boundary !== this.boundary && request?.kind === 'coverage') this.framed = null;
    this.boundary = boundary;

    const route = request?.kind === 'route' ? then.route(request.from, request.to, request.preference) : null;
    const reach = request?.kind === 'reach' ? then.reach(request.from) : null;
    const coverage = request?.kind === 'coverage' && boundary ? facts.coverage(boundary) : null;
    const routeLine = routeTrack(facts.index, route, theme);
    const reachStations = reachStops(facts.index, reach);
    routeLayer.update(routeLine, routeStops(facts.index, route, theme));
    reachLayer.update(reachTrack(facts.index, reach), reachStations);
    coverageLayer.update(coverage ? coverageDrawing(coverage.cells(moment.cursor), coverage.boundary) : null);

    const subject = overlaySubjectOf(request);
    if (subject !== this.framed) {
      // A route keeps room for its names; coverage frames the whole city, as a reach frames what it gets to.
      const routeBounds = route && boundsOf(routeLine.flatMap(feature => feature.geometry.coordinates));
      const reachBounds = reach && boundsOf(reachStations.map(stop => stop.geometry.coordinates));
      if (routeBounds) camera.fit(routeBounds, SELECTED_STATION_ZOOM, SELECT_FLY_MS, ROUTE_NAME_ROOM);
      else if (reachBounds) camera.fit(reachBounds, SELECTED_STATION_ZOOM, SELECT_FLY_MS);
      else if (coverage) camera.fit(coverage.bounds, OPENING_MAX_ZOOM, SELECT_FLY_MS);
      // Framed once there is something to frame: coverage waits for the outline, a route for the date to have one.
      if (route || reach || coverage || !request) this.framed = subject;
    }

    if (request?.kind === 'route') this.parts.report({ kind: 'route', route });
    else if (request?.kind === 'reach') this.parts.report({ kind: 'reach', reach });
    else if (request?.kind === 'coverage') this.parts.report({ kind: 'coverage', coverage: coverage?.info(moment.cursor) ?? null });
    else this.parts.report(null);
  }

  /**
   * Draws the overlay again if the moment moved on since it was drawn: called each frame.
   *
   * @param request - What the props ask for.
   * @param boundary - The city's outline.
   */
  public follow(request: OverlayRequest | null, boundary: CityBoundary | null): void {
    if (request && this.parts.moment().cursor !== this.drawnAt) this.draw(request, boundary);
  }
}
