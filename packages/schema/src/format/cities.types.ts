/**
 * The index of every city's network: what a list of cities shows of each without loading its whole
 * network. It is written from the networks, beside them.
 */

/** One city, as the index sums it up. */
export type CityIndexEntry = {
  /** The city's name, as its network gives it. */
  name: string;
  /** Its country, as its network names it: its folder, beside the city's own, is this as a slug. */
  country: string;
  /** The brands its lines run under. */
  networks: string[];
  /** The year its first line opened, or `null` for a network never built. */
  openedYear: number | null;
  /** Nothing built: its lines and stations are its first plan's. */
  planOnly: boolean;
  /** How many plans it has. */
  plans: number;
  /** How many lines it has (or its first plan, for a network never built). */
  lines: number;
  stations: number;
};

/** Every city, by the id of its folder, in the order a list shows them: the one list of cities. */
export type CityIndex = Record<string, CityIndexEntry>;
