import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');
const lngLat = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'expected #rrggbb');
/** A BCP 47 language code: `uk`, `pt-BR`. */
const LANGUAGE_CODE = /^[a-z]{2,3}(-[A-Z][A-Za-z0-9]{1,7})?$/;

/** Names by language code. The keys are checked here: zod reports a record's bad key only as "Invalid key in record". */
const names = z.record(z.string(), z.string().min(1)).superRefine((byLanguage, context) => {
  for (const code of Object.keys(byLanguage))
    if (!LANGUAGE_CODE.test(code)) context.addIssue({ code: 'custom', message: `expected a language code: uk, pt-BR, not ${code}` });
});

const lineSchema = z.object({
  name: z.string().min(1),
  names: names.optional(),
  network: z.string().min(1),
  mode: z.enum(['metro', 'light-metro', 'tram', 'suburban-rail', 'rail', 'cable']),
  color,
  darkColor: color.optional(),
  aliases: z.array(z.object({ until: isoDate, as: z.string(), text: z.string() })).optional(),
  pseudo: z.boolean().optional(),
});

const stationSchema = z.object({
  name: z.string().min(1),
  names: names.optional(),
  coordinate: lngLat,
  infill: z.record(z.string(), isoDate).optional(),
  closed: z.record(z.string(), isoDate).optional(),
  formerNames: z.array(z.object({ name: z.string().min(1), names: names.optional(), until: isoDate })).optional(),
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

const transferSchema = z.object({ stationA: z.string(), stationB: z.string() });

const planSchema = z.object({
  name: z.string().min(1),
  names: names.optional(),
  status: z.enum(['under-construction', 'planned', 'proposed', 'concept', 'abandoned']),
  description: z.string().min(1).optional(),
  lines: z.record(z.string(), lineSchema).optional(),
  stations: z.record(z.string(), stationSchema).optional(),
  sections: z.array(z.object({ line: z.string(), stations: z.array(z.string()).min(2) })),
  transfers: z.array(transferSchema).optional(),
});

/** The network's shape, its references between parts unchecked. */
export const networkShape = z.object({
  meta: z.object({ city: z.string(), start: isoDate, built: isoDate, attribution: z.string() }),
  networks: z.record(z.string(), z.object({ name: z.string(), names: names.optional() })),
  lines: z.record(z.string(), lineSchema),
  stations: z.record(z.string(), stationSchema),
  segments: z.array(segmentSchema),
  transfers: z.array(transferSchema).optional(),
  plans: z.record(z.string(), planSchema).optional(),
});
