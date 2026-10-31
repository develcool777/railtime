// Fetches a city's outline from OpenStreetMap, which the Coverage section measures within, and writes
// it beside the dataset (cities/<country>/<city>/<city>.boundary.json), simplified.
//
//   pnpm data:boundary                     every city, again from the relation its outline names
//   pnpm data:boundary london              one
//   pnpm data:boundary london 175342       one, from another relation: a new city's, or a wider area
//
// A relation is found on openstreetmap.org: search the city, pick its administrative boundary, and
// take the number from its address (/relation/175342). An outline is written only if the schema takes
// it and it holds most of the city's stations, so a wrong relation changes nothing.
import { parseBoundary } from '@railtime/schema/boundary.schema';
import type { CityBoundary } from '@railtime/schema/boundary.types';
import { parseNetwork } from '@railtime/schema/network.schema';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { MIN_STATIONS_HELD, NOMINATIM_PAUSE_MS, USER_AGENT } from './boundary/boundary.constants.ts';
import type { NominatimPlace } from './boundary/boundary.types.ts';
import { boundaryOf, formatBoundary, lookupUrlOf, relationOf, stationsHeld } from './boundary/boundary.utils.ts';
import { boundaryPathOf, datasets } from './dataset/city.utils.ts';

const [only, relationArgument] = process.argv.slice(2);
const chosen = datasets().filter(dataset => !only || dataset.city === only);
const relationGiven = relationArgument === undefined ? null : Number(relationArgument);
if (chosen.length === 0 || (relationGiven !== null && (!only || !Number.isInteger(relationGiven) || relationGiven <= 0))) {
  console.error('usage: pnpm data:boundary [city [relation]], where cities/<country>/<city>/<city>.json exists and relation is an OpenStreetMap id');
  process.exit(1);
}

let failed = 0;
for (const [position, dataset] of chosen.entries()) {
  const path = boundaryPathOf(dataset);
  const kept: CityBoundary | null = existsSync(path) ? parseBoundary(JSON.parse(readFileSync(path, 'utf8'))) : null;
  const relation = relationGiven ?? (kept && relationOf(kept));
  if (!relation) {
    console.error(`${dataset.city}: no outline yet: give its relation, pnpm data:boundary ${dataset.city} <relation>`);
    failed++;
    continue;
  }
  // Nominatim's usage policy: a request a second at most.
  if (position > 0) await sleep(NOMINATIM_PAUSE_MS);
  const response = await fetch(lookupUrlOf(relation), { headers: { 'User-Agent': USER_AGENT } });
  const [place] = response.ok ? ((await response.json()) as NominatimPlace[]) : [];
  if (!place) {
    const why = response.ok ? 'not found on OpenStreetMap' : `not fetched: Nominatim answered ${response.status}`;
    console.error(`${dataset.city}: relation ${relation} ${why}`);
    failed++;
    continue;
  }
  try {
    // A name chosen by hand (Greater London) stays while the relation does.
    const boundary = parseBoundary(boundaryOf(place, kept && relationOf(kept) === relation ? kept.name : undefined));
    const held = stationsHeld(boundary, parseNetwork(JSON.parse(readFileSync(dataset.path, 'utf8'))));
    if (held <= MIN_STATIONS_HELD) throw new Error(`it holds ${Math.round(held * 100)}% of the city's stations: is it the city's own?`);
    const text = formatBoundary(boundary);
    const changed = !existsSync(path) || readFileSync(path, 'utf8') !== text;
    writeFileSync(path, text);
    const points = boundary.polygons.flat(2).length;
    console.log(
      `${dataset.city}: ${boundary.name}, relation ${relation}, ${points} points, ${Math.round(held * 100)}% of its stations, ${changed ? 'written' : 'unchanged'}`,
    );
  } catch (error) {
    console.error(`${dataset.city}: relation ${relation} not written: ${error instanceof Error ? error.message : String(error)}`);
    failed++;
  }
}
if (failed > 0) process.exit(1);
