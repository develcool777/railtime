import type { StillRequest } from '@railtime/renderer/basemapStill.types';

/** A preview's colour theme, as the site's. */
export type PreviewTheme = 'dark' | 'light';

/** A preview's size, in CSS pixels. */
export type PreviewSize = { width: number; height: number };

/** The preview page's window: what it offers the script driving it. */
export type PreviewWindow = Window & { takePreview?: (theme: PreviewTheme, request: StillRequest) => Promise<string> };

/** What the preview page's server serves, by path. */
export type Served = Record<string, { type: string; body: string }>;
