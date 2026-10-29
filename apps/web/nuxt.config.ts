// https://nuxt.com/docs/api/configuration/nuxt-config
import { fileURLToPath } from 'node:url';

export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',
  modules: ['@nuxt/ui'],
  css: ['~/assets/css/main.css', '@railtime/renderer/transitMap.css'],
  // The map follows the system theme until the user picks one.
  colorMode: { preference: 'system', fallback: 'dark' },
  typescript: { strict: true },
  // Each city's dataset, data/<city>/<city>.json, served as it is kept: /data/london/london.json.
  nitro: { publicAssets: [{ dir: fileURLToPath(new URL('../../data', import.meta.url)), baseURL: '/data' }] },
  devtools: { enabled: true },
});
