// https://nuxt.com/docs/api/configuration/nuxt-config
import { fileURLToPath } from 'node:url';
import { CITIES } from './src/constants/city.constants';

/** Where the site is published: GitHub Pages, under `/railtime/` (`NUXT_APP_BASE_URL`). */
const siteUrl = process.env.NUXT_PUBLIC_SITE_URL ?? 'https://develcool777.github.io';

export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',
  // The investors site's layout: shared code at the top of src/, each product surface in features/<name>/.
  srcDir: 'src/',
  modules: ['@nuxt/ui', '@nuxtjs/sitemap', '@nuxtjs/robots'],
  css: ['~/css/main.css', '@railtime/renderer/transitMap.css'],
  // The map follows the system theme until the user picks one.
  colorMode: { preference: 'system', fallback: 'dark' },
  // Components are used by tag, without an import: the shared ones in components/, and each feature's
  // own in features/<name>/components/. A feature's other code is imported by its path, so what one
  // feature takes from another can be searched for.
  components: [
    { path: '~/components', pathPrefix: false },
    { path: '~/features', pathPrefix: false, pattern: '*/components/**' },
  ],
  // Tests are type-checked with the app, and reach their shared factories as @test/.
  typescript: {
    strict: true,
    tsConfig: { compilerOptions: { paths: { '@test/*': ['../test/*'] } }, include: ['../test/**/*'] },
  },
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      title: 'Railtime',
      meta: [
        {
          name: 'description',
          content: 'Metro networks on the real map, on any day since they opened: play their history, or open a plan for what they could become.',
        },
        { property: 'og:site_name', content: 'Railtime' },
        { property: 'og:type', content: 'website' },
      ],
    },
  },
  // Every page's canonical address and the sitemap start here; the base URL is added to it. GitHub
  // Pages serves a page's folder at its address with a slash (it redirects /railtime/kyiv to /kyiv/).
  site: { url: siteUrl, name: 'Railtime', trailingSlash: true },
  // Written at build time from the prerendered pages: no runtime endpoint. Its images would lose the
  // base URL, and add nothing a page's own social card does not.
  sitemap: { zeroRuntime: true, discoverImages: false },
  // A robots.txt is read at a domain's root only, and on GitHub Pages under /railtime/ that is not
  // ours: the module keeps to each page's robots meta tag.
  robots: { robotsTxt: false },
  // Each city's dataset, packages/data/cities/<country>/<city>/<city>.json, served as it is kept
  // (/data/united-kingdom/london/london.json), with its pictures beside it.
  // `nuxt generate` (GitHub Pages) prerenders the landing page and every city's page.
  nitro: {
    publicAssets: [{ dir: fileURLToPath(new URL('../packages/data/cities', import.meta.url)), baseURL: '/data' }],
    prerender: {
      // Every page is listed here, so nothing is found by following links.
      crawlLinks: false,
      routes: ['/', ...CITIES.map(city => `/${city.value}`)],
    },
  },
  // Links end with a slash, as the pages' canonical addresses do: no redirect on the way.
  experimental: { defaults: { nuxtLink: { trailingSlash: 'append' } } },
  // Off: on `nuxt dev` it makes an empty server/ (for server routes this site has none of) and .data/.
  devtools: { enabled: false },
});
