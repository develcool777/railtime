import { describe, expect, test } from 'vitest';
import { titleInLine } from '~/features/explorer/lines/line.utils';

describe('LineUtils', () => {
  describe('titleInLine', () => {
    test('drops the line’s name, with " line" after it or not', () => {
      expect(titleInLine('Red line extended', 'Red')).toBe('Extended');
      expect(titleInLine('Red opens', 'Red')).toBe('Opens');
    });

    test('drops it before a colon', () => {
      expect(titleInLine('Red line: section closes', 'Red')).toBe('Section closes');
    });

    test('reads a name with signs in it as written', () => {
      expect(titleInLine('Hammersmith & City (east) line extended', 'Hammersmith & City (east)')).toBe('Extended');
    });

    test('leaves a title about something else as it is', () => {
      expect(titleInLine('Baker Street opens', 'Red')).toBe('Baker Street opens');
      expect(titleInLine('Redbridge opens', 'Red')).toBe('Redbridge opens');
    });
  });
});
