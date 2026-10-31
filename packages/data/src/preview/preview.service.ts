import type { StillRequest } from '@railtime/renderer/basemapStill.types';
import { build } from 'esbuild';
import { type Browser, chromium, type Page } from 'playwright-core';
import { readFileSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { citiesNamed, readNetwork } from '../city.utils.ts';
import { PREVIEW_PAGE_SCRIPT, PREVIEW_SIZE, PREVIEW_THEMES, PREVIEW_TIMEOUT_MS, SOCIAL_SIZE, SOCIAL_THEME } from './preview.constants.ts';
import type { PreviewTheme, PreviewWindow, Served } from './preview.types.ts';
import { previewPathOf, previewRequestOf, socialPathOf } from './preview.utils.ts';

/**
 * Draws cities' pictures and writes them beside each city's network: its card's preview in each
 * theme, the map's own basemap in the theme's colours with the track over it, as WebP; and its social
 * card, the picture a link to its page shows, as JPEG. They are drawn by the renderer's
 * `BasemapStill`, bundled for the browser, in a page of the Chrome installed on this machine
 * (Playwright drives it; it downloads no browser); a small local server gives the page its script and
 * MapLibre its worker.
 */
export class PreviewRenderer {
  /** The local server the page loads from. */
  private server: Server | null = null;
  /** The browser, once started. */
  private browser: Browser | null = null;
  /** The page the previews are drawn in. */
  private page: Page | null = null;

  /**
   * Draws cities' pictures and writes them beside each one's network.
   *
   * @param cityId - The city's id; none for every city.
   * @throws {Error} For no such city, or a picture Chrome did not draw; Chrome and the server are closed either way.
   */
  public async draw(cityId: string | undefined): Promise<void> {
    const chosen = citiesNamed(cityId);
    if (chosen.length === 0) throw new Error(`no city ${cityId}: usage: pnpm data:previews [city]`);
    try {
      await this.start();
      for (const city of chosen) {
        const network = readNetwork(city);
        for (const theme of PREVIEW_THEMES) {
          const request = previewRequestOf(network, theme, PREVIEW_SIZE);
          if (!request) continue;
          const picture = await this.render(theme, request);
          writeFileSync(previewPathOf(city.networkPath, theme), picture);
          console.log(`${city.id} ${theme}: ${Math.round(picture.length / 1024)} KB`);
        }
        const social = previewRequestOf(network, SOCIAL_THEME, SOCIAL_SIZE);
        if (!social) continue;
        const card = await this.render(SOCIAL_THEME, { ...social, format: 'image/jpeg' });
        writeFileSync(socialPathOf(city.networkPath), card);
        console.log(`${city.id} social: ${Math.round(card.length / 1024)} KB`);
      }
    } finally {
      // Whatever started, Chrome or only the server, is closed, or the command would never end.
      await this.close();
    }
  }

  /** Bundles the preview page, serves it, starts Chrome and loads it. */
  private async start(): Promise<void> {
    const origin = await this.serve(await this.pageFiles());
    this.browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    this.page = await this.browser.newPage();
    this.page.setDefaultTimeout(PREVIEW_TIMEOUT_MS);
    // What goes wrong in the page is said here: a preview drawn without its tiles looks blank.
    this.page.on('pageerror', error => console.error(`preview page: ${error.message}`));
    this.page.on('console', message => {
      if (message.type() === 'error') console.error(`preview page: ${message.text()}`);
    });
    await this.page.goto(`${origin}/`);
    await this.page.waitForFunction(() => 'takePreview' in window);
  }

  /**
   * Draws one preview.
   *
   * @param theme - Its theme.
   * @param request - Where to look, its size, and the track to draw.
   * @returns The picture, WebP unless the request asks for another format.
   */
  private async render(theme: PreviewTheme, request: StillRequest): Promise<Buffer> {
    if (!this.page) throw new Error('the preview page has not started');
    const dataUrl = await this.page.evaluate(
      async ([pictureTheme, pictureRequest]) => {
        const take = (window as PreviewWindow).takePreview;
        if (!take) throw new Error('the preview page has not loaded');
        return take(pictureTheme, pictureRequest);
      },
      [theme, request] as const,
    );
    return Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
  }

  /** Closes Chrome and the server. */
  private async close(): Promise<void> {
    await this.browser?.close();
    await new Promise(resolve => (this.server ? this.server.close(resolve) : resolve(undefined)));
    this.browser = null;
    this.page = null;
    this.server = null;
  }

  /**
   * The page's files: a blank page, the bundled preview script, and MapLibre's worker.
   *
   * @returns Them, by path.
   */
  private async pageFiles(): Promise<Served> {
    const bundled = await build({
      stdin: {
        contents: PREVIEW_PAGE_SCRIPT,
        resolveDir: fileURLToPath(new URL('.', import.meta.url)),
        loader: 'ts',
      },
      bundle: true,
      format: 'iife',
      write: false,
      logLevel: 'error',
    });
    // MapLibre is the renderer's: its worker is found from there.
    const fromRenderer = createRequire(fileURLToPath(import.meta.resolve('@railtime/renderer/basemapStill.service')));
    return {
      '/': { type: 'text/html', body: '<!doctype html><html><body><script src="/preview.js"></script></body></html>' },
      '/preview.js': { type: 'text/javascript', body: bundled.outputFiles[0]?.text ?? '' },
      '/worker.mjs': { type: 'text/javascript', body: readFileSync(fromRenderer.resolve('maplibre-gl/dist/maplibre-gl-worker.mjs'), 'utf8') },
      // Asked for by every page; there is none.
      '/favicon.ico': { type: 'image/x-icon', body: '' },
    };
  }

  /**
   * Serves files on a free local port.
   *
   * @param files - What to serve, by path.
   * @returns The server's origin.
   */
  private serve(files: Served): Promise<string> {
    this.server = createServer((request, response) => {
      const file = files[new URL(request.url ?? '/', 'http://localhost').pathname];
      response.writeHead(file ? 200 : 404, { 'content-type': file?.type ?? 'text/plain' });
      response.end(file?.body ?? '');
    });
    return new Promise(resolve => this.server?.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${(this.server?.address() as AddressInfo).port}`)));
  }
}
