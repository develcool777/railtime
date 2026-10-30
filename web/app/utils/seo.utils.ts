import type { CityIndexEntry } from '@railtime/schema/cityIndex.types';
import { cityNameOf, networkUrlOf } from './city.utils';
import type { PageSeo } from './seo.types';

/** The site's name, as titles end with it. */
const SITE_NAME = 'Railtime';

/** A social card's size, as `pnpm data:previews` draws it. */
const SOCIAL_CARD = { width: 1200, height: 630 };

/**
 * A page's absolute address, as the site serves it: a page with a slash (a static host serves its
 * folder there), a file without.
 *
 * @param siteUrl - The site's origin (`https://example.org`).
 * @param baseUrl - The site's base URL, ending with a slash (`/railtime/`).
 * @param path - The page's or file's path under it, no leading slash.
 * @returns The address.
 */
export const pageUrl = (siteUrl: string, baseUrl: string, path: string): string => {
  const slash = path === '' || /\.\w+$/.test(path) ? '' : '/';
  return `${siteUrl.replace(/\/$/, '')}${baseUrl}${path}${slash}`;
};

/**
 * The number of something, with its noun: "1 line", "20 lines".
 *
 * @param count - How many.
 * @param noun - The noun, singular.
 * @returns The phrase.
 */
const counted = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? '' : 's'}`;

/**
 * What the landing page says about itself.
 *
 * @param cities - How many cities there are.
 * @returns Its SEO.
 */
export const landingSeo = (cities: number): PageSeo => ({
  path: '',
  title: `${SITE_NAME}: metro networks on the real map, on any day since they opened`,
  description: `Explore the metro of ${cities} cities as it is today or on any day since it opened, play its history one opening at a time, or open a plan for what it could become.`,
  jsonLd: { '@context': 'https://schema.org', '@type': 'WebSite', name: SITE_NAME },
});

/**
 * What a city's page says about itself: its network in a sentence, and its social card.
 *
 * @param city - The city's id.
 * @param entry - Its entry in the index of cities.
 * @returns Its SEO.
 */
export const citySeo = (city: string, entry: CityIndexEntry): PageSeo => {
  const name = cityNameOf(city);
  const networks = entry.networks.join(', ');
  const size = `${counted(entry.lines, 'line')} and ${counted(entry.stations, 'station')}`;
  const plans = entry.plans > 0 ? `, or open one of its ${counted(entry.plans, 'plan')} for the future` : '';
  const description = entry.planOnly
    ? `${name} never built a metro: see ${networks} as planned, ${size}, on the real map, and play it section by section.`
    : `${networks} on the real map: ${size}, on any day since ${entry.openedYear}. Play its history one opening at a time${plans}.`;
  const title = entry.planOnly ? `${name} metro that never was | ${SITE_NAME}` : `${name} metro history map since ${entry.openedYear} | ${SITE_NAME}`;
  return {
    path: city,
    title,
    description,
    image: { path: networkUrlOf(city).replace(/\.json$/, '.social.jpg'), ...SOCIAL_CARD, alt: `Map of the ${name} network` },
    jsonLd: { '@context': 'https://schema.org', '@type': 'Map', name: `${name} metro`, description, mapType: 'https://schema.org/TransitMap' },
  };
};
