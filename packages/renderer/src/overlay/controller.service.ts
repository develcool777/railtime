import { boundsOf } from '@railtime/core/geometry.utils';
import type { Playhead } from '@railtime/network/facts.types';
import type { CityBoundary } from '@railtime/schema/boundary.types';
import { coverageDrawing, reachStops, reachTrack, routeStops, routeTrack } from './overlay.utils';
import { OPENING_MAX_ZOOM, ROUTE_NAME_ROOM, SELECTED_STATION_ZOOM, SELECT_FLY_MS } from '../transitMap.constants';
import type { OverlayRequest, OverlayResult } from '../transitMap.types';
import type { OverlayDrawing, OverlayParts } from './controller.types';
import type { PointFeature, ReachStopProperties, RouteFeature } from '../layers/snapshot.types';

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
    const { facts, route: routeLayer, reach: reachLayer, coverage: coverageLayer } = this.parts;
    const moment = this.parts.moment();
    const theme = this.parts.theme();
    this.drawnAt = moment.cursor;
    if (boundary !== this.boundary && request?.kind === 'coverage') this.framed = null;
    this.boundary = boundary;
    const drawing = this.workOut(request, boundary, moment);

    const { index } = facts.engine;
    const { route, reach, coverage } = drawing;
    const routeLine = routeTrack(index, route, theme);
    const reachStations = reachStops(index, reach);
    routeLayer.update(routeLine, routeStops(index, route, theme));
    reachLayer.update(reachTrack(index, reach), reachStations);
    coverageLayer.update(coverage ? coverageDrawing(coverage.measure.cells(moment.cursor, coverage.metres), coverage.measure.boundary) : null);
    this.frame(request, drawing, routeLine, reachStations);
    this.parts.report(this.resultOf(request, drawing, moment.cursor));
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

  /**
   * What the overlay asked for comes to at a moment.
   *
   * @param request - What the props ask for.
   * @param boundary - The city's outline, for coverage.
   * @param moment - The moment shown.
   * @returns The routes, the one shown, the reach and the coverage.
   */
  private workOut(request: OverlayRequest | null, boundary: CityBoundary | null, moment: Playhead): OverlayDrawing {
    const { facts } = this.parts;
    const then = facts.asOf(moment);
    const routes = request?.kind === 'route' ? then.routes(request.from, request.to) : [];
    // The option asked for, or the last there is on this date.
    const shown = request?.kind === 'route' && routes.length > 0 ? Math.min(request.option, routes.length - 1) : null;
    return {
      routes,
      shown,
      route: shown === null ? null : (routes[shown] ?? null),
      reach: request?.kind === 'reach' ? then.reach(request.from) : null,
      // Coverage is measured within the distance asked for, once the outline is in.
      coverage: request?.kind === 'coverage' && boundary ? { measure: facts.coverage(boundary), metres: request.metres } : null,
    };
  }

  /**
   * Frames the overlay drawn when it is of something new; the same one is left be.
   *
   * @param request - What the props ask for.
   * @param drawing - What it came to.
   * @param routeLine - The route's track as drawn.
   * @param reachStations - The stations the reach gets to, as drawn.
   */
  private frame(request: OverlayRequest | null, drawing: OverlayDrawing, routeLine: RouteFeature[], reachStations: PointFeature<ReachStopProperties>[]): void {
    const subject = overlaySubjectOf(request);
    if (subject === this.framed) return;
    const { route, reach, coverage } = drawing;
    const { camera } = this.parts;
    // A route keeps room for its names; coverage frames the whole city, as a reach frames what it gets to.
    const routeBounds = route && boundsOf(routeLine.flatMap(feature => feature.geometry.coordinates));
    const reachBounds = reach && boundsOf(reachStations.map(stop => stop.geometry.coordinates));
    if (routeBounds) camera.fit(routeBounds, SELECTED_STATION_ZOOM, SELECT_FLY_MS, ROUTE_NAME_ROOM);
    else if (reachBounds) camera.fit(reachBounds, SELECTED_STATION_ZOOM, SELECT_FLY_MS);
    else if (coverage) camera.fit(coverage.measure.bounds, OPENING_MAX_ZOOM, SELECT_FLY_MS);
    // Framed once there is something to frame: coverage waits for the outline, a route for the date to have one.
    if (route || reach || coverage || !request) this.framed = subject;
  }

  /**
   * What the overlay came to, as it is reported.
   *
   * @param request - What the props ask for.
   * @param drawing - What it came to.
   * @param cursor - The cursor shown, for coverage's figures.
   * @returns The result; `null` for no overlay.
   */
  private resultOf(request: OverlayRequest | null, drawing: OverlayDrawing, cursor: number): OverlayResult | null {
    switch (request?.kind) {
      case 'route': {
        return { kind: 'route', routes: drawing.routes, shown: drawing.shown };
      }
      case 'reach': {
        return { kind: 'reach', reach: drawing.reach };
      }
      case 'coverage': {
        return { kind: 'coverage', coverage: drawing.coverage?.measure.info(cursor, drawing.coverage.metres) ?? null };
      }
      default: {
        return null;
      }
    }
  }
}

/**
 * What an overlay is of, for the camera: it frames an overlay when this changes (new ends, another way
 * between them, a new start, coverage opened), and leaves the view be as the date, the theme or
 * coverage's distance changes it.
 *
 * @param request - The overlay asked for, or `null`.
 * @returns Its subject, or `null` for none.
 */
export const overlaySubjectOf = (request: OverlayRequest | null): string | null => {
  if (!request) return null;
  if (request.kind === 'route') return `route|${request.from}|${request.to}|${request.option}`;
  if (request.kind === 'reach') return `reach|${request.from}`;
  return 'coverage';
};
