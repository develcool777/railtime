/** Where the map stands when it is asked about the network: the cursor, the clock, and the theme's colours. */
export type NetworkMoment = {
  /** Steps that have happened. */
  cursor: number;
  /** The date shown, as a timestamp: names are the ones stations had then. */
  clock: number;
  /** A line's own colour in the current theme. */
  colorOf: (line: string) => string;
};
