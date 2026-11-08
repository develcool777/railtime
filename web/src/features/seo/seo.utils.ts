import { SOCIAL_SIZE } from '@railtime/data/preview.constants';
import { STILL_PIXEL_RATIO } from '@railtime/renderer/basemapStill.constants';
import type { CityIndexEntry } from '@railtime/schema/cityIndex.types';
import { cityNameOf, socialUrlOf } from '~/utils/city.utils';
import { counted } from '~/utils/format.utils';
import type { PageSeo } from './seo.types';

/** The site's name, as titles end with it. */
const SITE_NAME = 'RailLineage';

/** A social card's size in the picture's own pixels, as `pnpm data:previews` draws it. */
const SOCIAL_CARD = { width: SOCIAL_SIZE.width * STILL_PIXEL_RATIO, height: SOCIAL_SIZE.height * STILL_PIXEL_RATIO };

/**
 * A page's absolute address, as the site serves it: a page with a slash (a static host serves its
 * folder there), a file without.
 *
 * @param siteUrl - The site's origin (`https://example.org`).
 * @param baseUrl - The site's base URL, ending with a slash (`/`).
 * @param path - The page's or file's path under it, no leading slash.
 * @returns The address.
 */
export const pageUrl = (siteUrl: string, baseUrl: string, path: string): string => {
  const slash = path === '' || /\.\w+$/.test(path) ? '' : '/';
  return `${siteUrl.replace(/\/$/, '')}${baseUrl}${path}${slash}`;
};

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
 * What the About page says about itself.
 *
 * @returns Its SEO.
 */
export const aboutSeo = (): PageSeo => ({
  path: 'about',
  title: `About ${SITE_NAME}: a city's rail network on any day since it opened`,
  description: `What ${SITE_NAME} is, what you can do with it, and whose maps and data it is built on.`,
});

/**
 * What the Privacy page says about itself.
 *
 * @returns Its SEO.
 */
export const privacySeo = (): PageSeo => ({
  path: 'privacy',
  title: `Privacy policy | ${SITE_NAME}`,
  description: `What ${SITE_NAME} stores in your browser, which services see your visit, and how advertising cookies work.`,
});

/**
 * What the Terms page says about itself.
 *
 * @returns Its SEO.
 */
export const termsSeo = (): PageSeo => ({
  path: 'terms',
  title: `Terms of use | ${SITE_NAME}`,
  description: `What you can rely on when you use ${SITE_NAME}, and what is only an estimate.`,
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
  const plans = entry.plans > 0 ? `, or open one of its ${counted(entry.plans, 'plan')}` : '';
  const description = entry.planOnly
    ? `${name} never built a metro: see ${networks} as planned, ${size}, on the real map, and play it section by section.`
    : `${networks} on the real map: ${size}, on any day since ${entry.openedYear}. Play its history one opening at a time${plans}.`;
  const title = entry.planOnly ? `${name} metro that never was | ${SITE_NAME}` : `${name} metro history map since ${entry.openedYear} | ${SITE_NAME}`;
  return {
    path: city,
    title,
    description,
    image: { path: socialUrlOf(city), ...SOCIAL_CARD, alt: `Map of the ${name} network` },
    jsonLd: { '@context': 'https://schema.org', '@type': 'Map', name: `${name} metro`, description, mapType: 'https://schema.org/TransitMap' },
  };
};
