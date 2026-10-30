import { useHead, useRuntimeConfig, useSeoMeta, useSiteConfig } from '#imports';

import type { PageSeo } from './seo.types';
import { pageUrl } from './seo.utils';

/**
 * Says what a page is to search engines and link previews, in one call: its title and description,
 * its canonical address, its social card, and its structured data. Every page calls it once.
 *
 * @param seo - What the page says about itself.
 */
export const usePageSeo = (seo: PageSeo): void => {
  const siteUrl = useSiteConfig().url;
  const baseUrl = useRuntimeConfig().app.baseURL;
  const canonical = pageUrl(siteUrl, baseUrl, seo.path);
  const image = seo.image ? pageUrl(siteUrl, baseUrl, seo.image.path) : undefined;
  useSeoMeta({
    title: seo.title,
    description: seo.description,
    ogTitle: seo.title,
    ogDescription: seo.description,
    ogUrl: canonical,
    ogType: 'website',
    twitterTitle: seo.title,
    twitterDescription: seo.description,
    ...(image && seo.image
      ? {
          ogImage: image,
          ogImageWidth: seo.image.width,
          ogImageHeight: seo.image.height,
          ogImageAlt: seo.image.alt,
          twitterImage: image,
          twitterCard: 'summary_large_image',
        }
      : { twitterCard: 'summary' }),
  });
  useHead({
    link: [{ rel: 'canonical', href: canonical }],
    ...(seo.jsonLd ? { script: [{ type: 'application/ld+json', innerHTML: JSON.stringify({ ...seo.jsonLd, url: canonical }) }] } : {}),
  });
};
