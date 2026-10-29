// https://nuxt.com/docs/api/configuration/nuxt-config
import { fileURLToPath } from 'node:url';
import { CITIES } from './app/utils/explorer.constants';

export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',
  modules: ['@nuxt/ui'],
  css: ['~/assets/css/main.css', '@railtime/renderer/transitMap.css'],
  // The map follows the system theme until the user picks one.
  colorMode: { preference: 'system', fallback: 'dark' },
  typescript: { strict: true },
  // Each city's dataset, packages/data/cities/<country>/<city>/<city>.json, served as it is kept
  // (/data/united-kingdom/london/london.json), and the index of them, /data/cities.json.
  // `nuxt generate` (GitHub Pages) prerenders the landing page and every city's page.
  nitro: {
    publicAssets: [{ dir: fileURLToPath(new URL('../packages/data/cities', import.meta.url)), baseURL: '/data' }],
    prerender: { routes: ['/', ...CITIES.map(city => `/${city.value}`)] },
  },
  devtools: { enabled: true },
});
