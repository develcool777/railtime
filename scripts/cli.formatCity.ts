// Checks a city's dataset against the schema and rewrites it in its kept layout, after a hand edit.
//
//   pnpm data:format london
//
// data/<city>/<city>.json is the city's source of truth: fix a date there, then run this.
import { parseNetwork } from '@railtime/schema/network.schema';
import { readFileSync, writeFileSync } from 'node:fs';
import { cityArgument, datasetPath } from './lib/dataset/city.utils.ts';
import { formatNetwork } from './lib/dataset/dataset.utils.ts';

const city = cityArgument('format');
const path = datasetPath(city);
const before = readFileSync(path, 'utf8');
const after = formatNetwork(parseNetwork(JSON.parse(before)));
writeFileSync(path, after);
console.log(before === after ? `${path}: valid, already tidy` : `${path}: valid, rewritten`);
