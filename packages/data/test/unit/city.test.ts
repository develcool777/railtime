import { keysOf } from '@railtime/core/collection.utils';
import { toTimestamp } from '@railtime/core/date.utils';
import { NetworkFacts } from '@railtime/network/facts.service';
import { tightestHeadway } from '@railtime/network/testing/trains';
import type { TrainRun } from '@railtime/network/trains.types';
import { playbackOf } from '@railtime/renderer/testing/playback';
import type { CityIndex } from '@railtime/schema/cityIndex.types';
import type { PlanId, StationId } from '@railtime/schema/network.types';
import { globSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { cities, citiesNamed, SUMMARIES_PATH } from '../../src/city.utils.ts';
import { SUMMARY_DAY } from '../../src/summary/summary.constants.ts';
import { cityNetwork } from '../support/history.utils';

/** The repository's root. */
const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

/** The shortest time two of a line's trains may run apart on the same track, the same way, seconds: about the closest real signalling allows. */
const TIGHTEST_HEADWAY_SECONDS = 90;

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
      return facts.asOf(facts.playheads.rest()).trains();
    };

    /**
     * Whether a route runs through a station twice, but for going round a loop at one of its ends.
     *
     * @param run - The route.
     * @returns Whether it doubles back.
     */
    const doublesBack = ({ legs, ends }: TrainRun): boolean => {
      const stations = [...legs.map(({ segment, forward }) => (forward ? segment.stationA : segment.stationB)), ends[1]];
      const repeats = (some: StationId[]) => new Set(some).size < some.length;
      return repeats(stations.slice(1)) && repeats(stations.slice(0, -1));
    };

    /** Every network a city shows: as built, if it was, and with each of its plans. */
    const SHOWN = cities().flatMap(({ id }) => {
      const network = cityNetwork(id);
      return [...(NetworkFacts.create(network).planOnly ? [] : [{ id, plan: undefined }]), ...keysOf(network.plans ?? {}).map(plan => ({ id, plan }))];
    });

    test.each(SHOWN)(
      '$id $plan runs trains as a real line does: as far apart as signals keep them on shared track, never doubling back, and some in sight',
      ({ id, plan }) => {
        const service = trainsOf(id, plan);
        expect(service.timetables.length).toBeGreaterThan(0);
        expect(tightestHeadway(service)).toBeGreaterThanOrEqual(TIGHTEST_HEADWAY_SECONDS);
        expect(service.timetables.filter(({ run }) => doublesBack(run))).toEqual([]);
        expect(service.placesAt(600).length).toBeGreaterThan(0);
      },
    );
  });

  describe('every city, summed up', () => {
    /** Today, for the sums: the list's own, so a date passing changes none of them. */
    const TODAY = toTimestamp(SUMMARY_DAY);

    test.each(cities().map(({ id }) => ({ id })))('$id sums up as its timeline counts it', ({ id }) => {
      const facts = NetworkFacts.create(cityNetwork(id), { today: TODAY });
      const planOnly = NetworkFacts.create(cityNetwork(id), { today: TODAY, ...(facts.planOnly && { plan: keysOf(cityNetwork(id).plans ?? {})[0]! }) });
      const { lines, stations } = planOnly.asOf(facts.planOnly ? planOnly.playheads.end() : planOnly.playheads.today()).stats();
      expect(facts.summary()).toMatchObject({ lines, stations });
    });

    test.each(cities().flatMap(({ id }) => keysOf(cityNetwork(id).plans ?? {}).map(plan => ({ id, plan }))))(
      '$id $plan adds the stations its timeline does',
      ({ id, plan }) => {
        const today = NetworkFacts.create(cityNetwork(id), { today: TODAY });
        const built = NetworkFacts.create(cityNetwork(id), { today: TODAY, plan });
        const added = built.asOf(built.playheads.end()).stats().stations - today.today().stats().stations;
        expect(today.plans().find(each => each.id === plan)?.facts.stations).toBe(added);
      },
    );
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
