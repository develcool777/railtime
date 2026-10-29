import { z } from 'zod';
import type { Network } from './network.types';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');
const lngLat = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'expected #rrggbb');

const lineSchema = z.object({
  name: z.string().min(1),
  network: z.string().min(1),
  mode: z.enum(['metro', 'light-metro', 'tram', 'suburban-rail', 'rail', 'cable']),
  color,
  darkColor: color.optional(),
  aliases: z.array(z.object({ until: isoDate, as: z.string(), text: z.string() })).optional(),
  pseudo: z.boolean().optional(),
});

const stationSchema = z.object({
  name: z.string().min(1),
  coordinate: lngLat,
  infill: z.record(z.string(), isoDate).optional(),
  closed: z.record(z.string(), isoDate).optional(),
  formerNames: z.array(z.object({ name: z.string().min(1), until: isoDate })).optional(),
});

const segmentSchema = z.object({
  stationA: z.string(),
  stationB: z.string(),
  coordinates: z.array(lngLat).min(2),
  lines: z.record(
    z.string(),
    z.object({ open: isoDate, close: isoDate.optional(), suspended: z.array(z.object({ from: isoDate, until: isoDate })).optional() }),
  ),
});

/** The network's shape, plus the references between its parts. */
const networkSchema = z
  .object({
    meta: z.object({ city: z.string(), start: isoDate, built: isoDate, attribution: z.string() }),
    networks: z.record(z.string(), z.object({ name: z.string() })),
    lines: z.record(z.string(), lineSchema),
    stations: z.record(z.string(), stationSchema),
    segments: z.array(segmentSchema),
  })
  .superRefine((network, context) => {
    const problem = (message: string) => context.addIssue({ code: 'custom', message });
    for (const [lineId, line] of Object.entries(network.lines)) {
      if (!network.networks[line.network]) problem(`line ${lineId}: unknown network ${line.network}`);
      for (const alias of line.aliases ?? []) if (!network.lines[alias.as]) problem(`line ${lineId}: alias to unknown line ${alias.as}`);
    }
    for (const [stationId, station] of Object.entries(network.stations)) {
      for (const [lineId, date] of Object.entries(station.closed ?? {})) {
        if (!network.lines[lineId]) problem(`station ${stationId}: closed on unknown line ${lineId}`);
        const opened = station.infill?.[lineId];
        if (opened && date <= opened) problem(`station ${stationId}: closes on ${lineId} before it opens`);
      }
      const until = (station.formerNames ?? []).map(former => former.until);
      if (until.some((date, position) => position > 0 && date <= until[position - 1]!)) problem(`station ${stationId}: former names out of order`);
    }
    network.segments.forEach((segment, position) => {
      for (const station of [segment.stationA, segment.stationB]) if (!network.stations[station]) problem(`segment ${position}: unknown station ${station}`);
      for (const [lineId, dates] of Object.entries(segment.lines)) {
        if (!network.lines[lineId]) problem(`segment ${position}: unknown line ${lineId}`);
        if (dates.close && dates.close <= dates.open) problem(`segment ${position}: ${lineId} closes before it opens`);
        // Open, then each spell's start and end, then close: each after the one before.
        const changes = [dates.open, ...(dates.suspended ?? []).flatMap(spell => [spell.from, spell.until]), ...(dates.close ? [dates.close] : [])];
        if (changes.some((date, order) => order > 0 && date <= changes[order - 1]!)) problem(`segment ${position}: ${lineId} suspended out of order`);
      }
    });
  });

/**
 * Validates importer output before it is written.
 *
 * @param input - A parsed network JSON.
 * @returns The network, typed.
 * @throws {z.ZodError} With every problem listed.
 */
export const parseNetwork = (input: unknown): Network => networkSchema.parse(input);
