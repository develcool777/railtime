/** A picture a link to a page shows. */
type SeoImage = {
  /** Its path, relative to the site's base URL. */
  path: string;
  width: number;
  height: number;
  alt: string;
};

/** What a page says about itself to search engines and link previews. */
export type PageSeo = {
  /** The page's path, relative to the site's base URL: '' for the landing page. */
  path: string;
  title: string;
  description: string;
  image?: SeoImage;
  /** Structured data (schema.org), as JSON-LD. */
  jsonLd?: Record<string, unknown>;
};
