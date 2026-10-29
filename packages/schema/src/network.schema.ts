import { z } from 'zod';
import type { Network, Plan } from './network.types';
import { buildPlan } from './plan.utils.ts';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');
const lngLat = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'expected #rrggbb');
/** Names by BCP 47 language code: `uk`, `pt-BR`. */
const names = z.record(z.string().regex(/^[a-z]{2,3}(-[A-Z][A-Za-z0-9]{1,7})?$/, 'expected a language code: uk, pt-BR'), z.string().min(1));

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
  description: z.string().min(1).optional(),
  lines: z.record(z.string(), lineSchema).optional(),
  stations: z.record(z.string(), stationSchema).optional(),
  sections: z.array(z.object({ line: z.string(), stations: z.array(z.string()).min(2) })),
  transfers: z.array(transferSchema).optional(),
});

/** The network's shape, its references between parts unchecked. */
const networkShape = z.object({
  meta: z.object({ city: z.string(), start: isoDate, built: isoDate, attribution: z.string() }),
  networks: z.record(z.string(), z.object({ name: z.string(), names: names.optional() })),
  lines: z.record(z.string(), lineSchema),
  stations: z.record(z.string(), stationSchema),
  segments: z.array(segmentSchema),
  transfers: z.array(transferSchema).optional(),
  plans: z.record(z.string(), planSchema).optional(),
});

/**
 * Checks the stations' references and dates, and the transfers between them.
 *
 * @param network - The network, its shape already valid.
 * @param problem - Reports one problem.
 */
const checkStations = (network: Network, problem: (message: string) => void): void => {
  for (const [stationId, station] of Object.entries(network.stations)) {
    for (const [lineId, date] of Object.entries(station.closed ?? {})) {
      if (!network.lines[lineId]) problem(`station ${stationId}: closed on unknown line ${lineId}`);
      const opened = station.infill?.[lineId];
      if (opened && date <= opened) problem(`station ${stationId}: closes on ${lineId} before it opens`);
    }
    const until = (station.formerNames ?? []).map(former => former.until);
    if (until.some((date, position) => position > 0 && date <= until[position - 1]!)) problem(`station ${stationId}: former names out of order`);
  }
  for (const { stationA, stationB } of network.transfers ?? []) {
    for (const station of [stationA, stationB]) if (!network.stations[station]) problem(`transfer ${stationA} – ${stationB}: unknown station ${station}`);
    if (stationA === stationB) problem(`transfer ${stationA}: to itself`);
  }
};

/**
 * Checks the references between a network's parts, and its dates.
 *
 * @param network - The network, its shape already valid.
 * @param problem - Reports one problem.
 */
const checkNetwork = (network: Network, problem: (message: string) => void): void => {
  for (const [lineId, line] of Object.entries(network.lines)) {
    if (!network.networks[line.network]) problem(`line ${lineId}: unknown network ${line.network}`);
    for (const alias of line.aliases ?? []) if (!network.lines[alias.as]) problem(`line ${lineId}: alias to unknown line ${alias.as}`);
  }
  checkStations(network, problem);
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
};

/**
 * A plan's ids that are already the network's, and its sections' lines and stations that are no one's.
 *
 * @param network - The network.
 * @param plan - One of its plans.
 * @returns A problem for each.
 */
const planReferenceProblems = (network: Network, plan: Plan): string[] => [
  ...Object.keys(plan.lines ?? {})
    .filter(line => network.lines[line])
    .map(line => `line ${line} is already in the network`),
  ...Object.keys(plan.stations ?? {})
    .filter(station => network.stations[station])
    .map(station => `station ${station} is already in the network`),
  ...plan.sections.flatMap((section, position) => [
    ...(network.lines[section.line] || plan.lines?.[section.line] ? [] : [`section ${position}: unknown line ${section.line}`]),
    ...section.stations
      .filter(station => !network.stations[station] && !plan.stations?.[station])
      .map(station => `section ${position}: unknown station ${station}`),
  ]),
];

/**
 * Checks each plan as the network it would build: its own ids new, its references and dates sound.
 * A problem the network already has is reported once, not again for every plan.
 *
 * @param network - The network, its shape already valid.
 * @param problem - Reports one problem.
 */
const checkPlans = (network: Network, problem: (message: string) => void): void => {
  const known = new Set<string>();
  checkNetwork(network, message => known.add(message));
  for (const [planId, plan] of Object.entries(network.plans ?? {})) {
    const references = planReferenceProblems(network, plan);
    for (const message of references) problem(`plan ${planId}: ${message}`);
    // Built only once its ids are sound: building needs every station's place.
    if (references.length > 0) continue;
    checkNetwork(buildPlan(network, planId).network, message => {
      if (!known.has(message)) problem(`plan ${planId}: ${message}`);
    });
  }
};

/** The network's shape, plus the references between its parts and its plans'. */
const networkSchema = networkShape.superRefine((network, context) => {
  const problem = (message: string) => context.addIssue({ code: 'custom', message });
  checkNetwork(network, problem);
  checkPlans(network, problem);
});

/**
 * Validates importer output before it is written.
 *
 * @param input - A parsed network JSON.
 * @returns The network, typed.
 * @throws {z.ZodError} With every problem listed.
 */
export const parseNetwork = (input: unknown): Network => networkSchema.parse(input);
