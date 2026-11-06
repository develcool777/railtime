import { keysOf } from '@railtime/core/collection.utils';
import { tightestHeadway } from '@railtime/network/testing/trains';
import { playbackOf } from '@railtime/renderer/testing/playback';
import type { CityIndex } from '@railtime/schema/cityIndex.types';
import type { PlanId } from '@railtime/schema/network.types';
import { isPlanOnly } from '@railtime/schema/plan.utils';
import { globSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { cities, citiesNamed, SUMMARIES_PATH } from '../../src/city.utils.ts';
import { cityNetwork } from '../support/history.utils';

/** The repository's root. */
const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

/** The shortest time two of a line's trains may run apart on the same track, the same way, seconds. */
const TIGHTEST_HEADWAY_SECONDS = 5;

/** The most trains a city may show at once: about a fleet, and a train at the least each way on its routes. */
const MOST_TRAINS = 110;

describe('CityUtils', () => {
  describe('citiesNamed', () => {
    test('gives every city for none named', () => {
      expect(citiesNamed(undefined)).toEqual(cities());
    });

    test('gives the city named, where its files are', () => {
      expect(citiesNamed('kyiv')).toEqual([
        expect.objectContaining({ country: 'ukraine', id: 'kyiv', networkPath: expect.stringMatching(/\/cities\/ukraine\/kyiv\/kyiv\.json$/) }),
      ]);
    });

    test('gives none for a city it does not know', () => {
      expect(citiesNamed('atlantis')).toEqual([]);
    });
  });

  describe('every city', () => {
    /**
     * A city's trains, as built or with a plan laid on it.
     *
     * @param id - The city.
     * @param plan - The plan; none for the network as built.
     * @returns Its trains where the map rests.
     */
    const trainsOf = (id: string, plan?: PlanId) => {
      const { facts } = playbackOf(cityNetwork(id), plan ? { plan } : {});
      return facts.engine.trainService(facts.playheads.rest().cursor);
    };

    /** Every network a city shows: as built, if it was, and with each of its plans. */
    const SHOWN = cities().flatMap(({ id }) => {
      const network = cityNetwork(id);
      return [...(isPlanOnly(network) ? [] : [{ id, plan: undefined }]), ...keysOf(network.plans ?? {}).map(plan => ({ id, plan }))];
    });

    test.each(SHOWN)("$id $plan runs trains by the network's rule: apart on shared track, some in sight, and no more than a fleet", ({ id, plan }) => {
      const service = trainsOf(id, plan);
      expect(service.timetables.length).toBeGreaterThan(0);
      expect(tightestHeadway(service)).toBeGreaterThan(TIGHTEST_HEADWAY_SECONDS);
      expect(service.placesAt(600).length).toBeLessThan(MOST_TRAINS);
      expect(service.placesAt(600).length).toBeGreaterThan(0);
    });
  });

  describe('SUMMARIES_PATH', () => {
    // The packages beneath the data know no city: they draw, play and answer for any network.
    test('names cities no package beneath the data names, in its code or its tests', () => {
      const summaries = JSON.parse(readFileSync(SUMMARIES_PATH, 'utf8')) as CityIndex;
      const names = Object.entries(summaries).flatMap(([id, entry]) => [id, entry.name]);
      const named = new RegExp(String.raw`\b(${names.map(name => RegExp.escape(name)).join('|')})\b`, 'i');
      const found = globSync('packages/{core,schema,network,renderer}/{src,test}/**/*.ts', { cwd: ROOT }).flatMap(path =>
        readFileSync(`${ROOT}${path}`, 'utf8')
          .split('\n')
          .flatMap((line, index) => (named.test(line) ? [`${path}:${index + 1}: ${line.trim()}`] : [])),
      );
      expect(found).toEqual([]);
    });
  });
});
