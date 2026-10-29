/** A line as a city card shows it: a swatch in each theme. */
type SummaryLine = {
  id: string;
  name: string;
  color: string;
  darkColor: string;
};

/** What a city card says about a network. */
export type CitySummary = {
  lines: SummaryLine[];
  stations: number;
  /** The brands its lines run under ("Underground", "Overground"). */
  networks: string[];
  /** The year its first line opened, or `null` for an empty network. */
  openedYear: number | null;
};

/** One segment of a network sketch, as an SVG path in each theme's colour. */
export type PreviewPath = {
  path: string;
  color: string;
  darkColor: string;
};
