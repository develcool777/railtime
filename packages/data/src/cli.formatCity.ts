// Checks a city's dataset against the schema and rewrites it in its kept layout, after a hand edit;
// then writes the index of every city, cities/cities.json, which the landing page shows.
//
//   pnpm data:format london
//
// cities/<country>/<city>/<city>.json is the city's source of truth: fix a date there, then run this.
import { parseNetwork } from '@railtime/schema/network.schema';
import { readFileSync, writeFileSync } from 'node:fs';
import { CITY_INDEX_PATH, cityArgument, datasets } from './dataset/city.utils.ts';
import { formatCityIndex, indexEntryOf } from './dataset/cityIndex.utils.ts';
import { formatNetwork } from './dataset/dataset.utils.ts';

const { path } = cityArgument('format');
const before = readFileSync(path, 'utf8');
const after = formatNetwork(parseNetwork(JSON.parse(before)));
writeFileSync(path, after);
console.log(before === after ? `${path}: valid, already tidy` : `${path}: valid, rewritten`);

const index = Object.fromEntries(
  datasets().map(({ country, city, path: cityPath }) => [city, indexEntryOf(parseNetwork(JSON.parse(readFileSync(cityPath, 'utf8'))), country)]),
);
writeFileSync(CITY_INDEX_PATH, formatCityIndex(index));
console.log(`${CITY_INDEX_PATH}: ${Object.keys(index).length} cities`);
