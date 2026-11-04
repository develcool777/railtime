import { z } from 'zod';

/** A date, `YYYY-MM-DD`. */
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');
/** A point: its longitude, then its latitude. */
export const lngLat = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);
/** A colour, `#rrggbb`. */
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'expected #rrggbb');
/** A BCP 47 language code: `uk`, `pt-BR`. */
const LANGUAGE_CODE = /^[a-z]{2,3}(-[A-Z][A-Za-z0-9]{1,7})?$/;

/** Names by language code. The keys are checked here: zod reports a record's bad key only as "Invalid key in record". */
const names = z.record(z.string(), z.string().min(1)).superRefine((byLanguage, context) => {
  for (const code of Object.keys(byLanguage))
    if (!LANGUAGE_CODE.test(code)) context.addIssue({ code: 'custom', message: `expected a language code: uk, pt-BR, not ${code}` });
});

/** A line: its names, its network, its mode and colours, and what it was drawn as for a while. */
const lineSchema = z.object({
  name: z.string().min(1),
  fullName: z.string().min(1).exactOptional(),
  names: names.exactOptional(),
  network: z.string().min(1),
  mode: z.enum(['metro', 'light-metro', 'tram', 'suburban-rail', 'rail', 'cable']),
  color,
  darkColor: color.exactOptional(),
  aliases: z.array(z.object({ until: isoDate, as: z.string(), text: z.string() })).exactOptional(),
  pseudo: z.boolean().exactOptional(),
});

/** A spell a station or a stretch of track was closed, reopened after. */
const suspension = z.object({ from: isoDate, until: isoDate });

/** A station: its names, where it stands, and how each line's calls there changed. */
const stationSchema = z.object({
  name: z.string().min(1),
  names: names.exactOptional(),
  coordinate: lngLat,
  infill: z.record(z.string(), isoDate).exactOptional(),
  closed: z.record(z.string(), isoDate).exactOptional(),
  suspended: z.record(z.string(), z.array(suspension)).exactOptional(),
  reverses: z.array(z.string()).exactOptional(),
  passes: z.array(z.string()).exactOptional(),
  formerNames: z.array(z.object({ name: z.string().min(1), names: names.exactOptional(), until: isoDate })).exactOptional(),
});

/** Track between two stations, and when each line ran on it. */
const segmentSchema = z.object({
  stationA: z.string(),
  stationB: z.string(),
  coordinates: z.array(lngLat).min(2),
  lines: z.record(z.string(), z.object({ open: isoDate, close: isoDate.exactOptional(), suspended: z.array(suspension).exactOptional() })),
});

/** Two stations a change walks between. */
const transferSchema = z.object({ stationA: z.string(), stationB: z.string() });

/** A plan: its lines, stations and track of its own, and the sections it builds, in order. */
const planSchema = z.object({
  name: z.string().min(1),
  names: names.exactOptional(),
  status: z.enum(['under-construction', 'planned', 'proposed', 'concept', 'abandoned']),
  description: z.string().min(1).exactOptional(),
  lines: z.record(z.string(), lineSchema).exactOptional(),
  stations: z.record(z.string(), stationSchema).exactOptional(),
  sections: z.array(z.object({ line: z.string(), stations: z.array(z.string()).min(2) })),
  track: z.array(z.object({ stationA: z.string(), stationB: z.string(), coordinates: z.array(lngLat).min(2) })).exactOptional(),
  transfers: z.array(transferSchema).exactOptional(),
});

/** The network's shape, its references between parts unchecked. */
export const networkShape = z.object({
  meta: z.object({ city: z.string(), country: z.string(), start: isoDate, built: isoDate, attribution: z.string() }),
  networks: z.record(
    z.string(),
    z.object({ name: z.string(), names: names.exactOptional(), hidden: z.boolean().exactOptional(), start: isoDate.exactOptional() }),
  ),
  lines: z.record(z.string(), lineSchema),
  stations: z.record(z.string(), stationSchema),
  segments: z.array(segmentSchema),
  transfers: z.array(transferSchema).exactOptional(),
  plans: z.record(z.string(), planSchema).exactOptional(),
});
