import { describe, expect, test } from 'vitest';
import { citySeo, landingSeo, pageUrl } from '~/features/seo/seo.utils';

const BUILT = { name: 'Kyiv', country: 'ukraine', networks: ['Kyiv Metro'], openedYear: 1960, planOnly: false, plans: 2, lines: 3, stations: 52 };

describe('SeoUtils', () => {
  describe('pageUrl', () => {
    test('puts the base URL between the origin and the path, a page with a slash, a file without', () => {
      expect(pageUrl('https://example.org/', '/railtime/', 'kyiv')).toBe('https://example.org/railtime/kyiv/');
      expect(pageUrl('https://example.org', '/', '')).toBe('https://example.org/');
      expect(pageUrl('https://example.org', '/railtime/', 'data/kyiv.social.jpg')).toBe('https://example.org/railtime/data/kyiv.social.jpg');
    });
  });

  describe('landingSeo', () => {
    test('counts the cities, at the root', () => {
      expect(landingSeo(23)).toMatchObject({ path: '' });
      expect(landingSeo(23).description).toContain('23 cities');
    });
  });

  describe('citySeo', () => {
    test("says what a city's network is and since when, with its social card", () => {
      const seo = citySeo('kyiv', BUILT);
      expect(seo.title).toContain('since 1960');
      expect(seo.description).toContain('3 lines and 52 stations');
      expect(seo.description).toContain('one of its 2 plans');
      expect(seo.image).toMatchObject({ path: 'data/ukraine/kyiv/kyiv.social.jpg', width: 1200, height: 630 });
    });

    test('says a network never built never was', () => {
      const seo = citySeo('kyiv', { ...BUILT, planOnly: true, openedYear: null, plans: 1, lines: 1 });
      expect(seo.title).toContain('never was');
      expect(seo.description).toContain('1 line and 52 stations');
    });
  });
});
