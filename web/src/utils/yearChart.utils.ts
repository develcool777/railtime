import { areaY, defineChart, lineY } from '@tanstack/charts';
import type { DomChartDefinition } from '@tanstack/charts';
import { crosshair } from '@tanstack/charts/crosshair';
import { decorative } from '@tanstack/charts/mark/decorative';
import { scaleLinear } from '@tanstack/charts/scales/linear';
import { scaleOrdinal } from '@tanstack/charts/scales/ordinal';
import { scalePoint } from '@tanstack/charts/scales/point';
import { MOST_YEAR_TICKS, YEAR_TICK_STEPS } from '~/constants/chart.constants';
import type { YearChartInput, YearChartRow } from '~/utils/yearChart.types';

/** The area's fill, by the id the chart gives it: its series' colour, fading down. */
const AREA_GRADIENT = {
  id: 'year-area',
  x1: 0,
  y1: 0,
  x2: 0,
  y2: 1,
  stops: [
    { offset: 0, color: 'var(--ts-chart-1)', opacity: 0.4 },
    { offset: 1, color: 'var(--ts-chart-1)', opacity: 0.05 },
  ],
};

/**
 * The years a chart labels: round ones, at the finest step that leaves few enough.
 *
 * @param years - The years it plots, in order.
 * @returns Those it labels.
 */
export const yearTicksOf = (years: number[]): number[] => {
  const span = (years.at(-1) ?? 0) - (years[0] ?? 0);
  const step = YEAR_TICK_STEPS.find(candidate => span / candidate < MOST_YEAR_TICKS) ?? Math.max(...YEAR_TICK_STEPS);
  return years.filter(year => year % step === 0);
};

/**
 * A measure year by year as an area, as `UChart` draws one, but labelled at round years, which its own
 * options cannot say.
 *
 * @param input - What it plots, what the measure is called, and how a value is written, in the readout and on its axis.
 * @returns The chart's definition.
 */
export const yearChartOf = ({ points, label, format, axisFormat = format }: YearChartInput): DomChartDefinition<YearChartRow, number, number> => {
  const rows = points.map((point): YearChartRow => ({ x: point.year, value: point.value, category: label }));
  return defineChart({
    marks: [
      decorative(areaY(rows, { x: 'x', y: 'value', z: 'category', color: 'category', fill: `url(#${AREA_GRADIENT.id})`, fillOpacity: 1 })),
      lineY(rows, { x: 'x', y: 'value', z: 'category', color: 'category', strokeWidth: 2 }),
      crosshair({ x: true, y: false }),
    ],
    scales: {
      x: { scale: () => scalePoint().padding(0), axis: { ticks: { values: yearTicksOf(points.map(point => point.year)) } } },
      y: { scale: scaleLinear, nice: true, grid: true, side: 'left', axis: { ticks: { format: axisFormat } } },
    },
    color: { scale: scaleOrdinal().domain([label]).range(['var(--ts-chart-1)']) },
    gradients: [AREA_GRADIENT],
    focus: 'group-x',
    // A year is always under the pointer: the default focuses only a point within 48 pixels.
    maxFocusDistance: Infinity,
  });
};
