import type { StillRequest } from '@railtime/renderer/basemapStill.types';
import { build } from 'esbuild';
import { type Browser, chromium, type Page } from 'playwright-core';
import { readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { PREVIEW_TIMEOUT_MS } from './preview.constants.ts';
import type { PreviewTheme, PreviewWindow } from './preview.types.ts';

/** What the preview page's server serves, by path. */
type Served = Record<string, { type: string; body: string }>;

/**
 * Draws previews in Chrome: the renderer's `BasemapStill`, bundled for the browser, in a page of the
 * Chrome installed on this machine (Playwright drives it; it downloads no browser). A small local
 * server gives the page its script and MapLibre its worker. Each picture is the map's own basemap in a
 * theme's colours, with the track over it.
 */
export class PreviewRenderer {
  /** The local server the page loads from. */
  private server: Server | null = null;
  /** The browser, once started. */
  private browser: Browser | null = null;
  /** The page the previews are drawn in. */
  private page: Page | null = null;

  /** Bundles the preview page, serves it, starts Chrome and loads it. */
  public async start(): Promise<void> {
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
   * @returns The picture, WebP.
   */
  public async render(theme: PreviewTheme, request: StillRequest): Promise<Buffer> {
    if (!this.page) throw new Error('PreviewRenderer.start() first');
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
  public async close(): Promise<void> {
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
        contents: "import { installPreviewPage } from './previewPage.utils.ts'; installPreviewPage(new URL('/worker.mjs', location.href).href);",
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
