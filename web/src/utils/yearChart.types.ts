/** One year of a measure, on a chart. */
export type YearPoint = { year: number; value: number };

/** One year as the chart plots it, in the series named. */
export type YearChartRow = { x: number; value: number; category: string };

/** What a chart of a measure year by year is made from. */
export type YearChartInput = {
  /** The measure, year by year. */
  points: YearPoint[];
  /** What it is called. */
  label: string;
  /** How a value of it is written in the readout. */
  format: (value: number) => string;
  /** How its axis writes a value, where the readout's way would not suit round ones; the same if not given. */
  axisFormat?: (value: number) => string;
};
