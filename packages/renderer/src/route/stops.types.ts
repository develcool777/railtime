/** How a route marks a stop: one it passes, one where a ride begins (its start, or a change), or its end. */
export type RouteStopKind = 'pass' | 'board' | 'end';

/** A stop on a route, as the map marks it. */
export type RouteStopMark = {
  station: string;
  name: string;
  kind: RouteStopKind;
  /** The colour of the line it is on: for a change, the line boarded there. */
  color: string;
};
