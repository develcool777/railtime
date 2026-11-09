import typescript from 'typescript';
import type { Type, TypeChecker } from 'typescript';
import { describe, expect, test } from 'vitest';
import { holdsBrand, isKeyedByBrand } from '../../../src/lint/brand.utils';

/** A brand, as `@railtime/core/brand.types` makes one, and values to try it on, each its type. */
const SOURCE = `
declare const brand: unique symbol;
type Brand<Base, Name extends string> = Base & { readonly [brand]: Name };
type StationId = Brand<string, 'StationId'>;
declare const id: StationId;
declare const maybe: StationId | null;
declare const list: StationId[];
declare const lookup: Map<StationId, number>;
declare const keyed: Record<StationId, string>;
declare const keyedOrNot: Record<StationId, string> | {};
declare const plain: string;
declare const holding: { id: StationId };
`;

/** The file the source is read as. */
const FILE = 'brands.ts';

/**
 * The source's values, each its type, as the lint rules' program types them.
 *
 * @returns The checker, and each value's type by its name.
 */
const typesOf = (): { checker: TypeChecker; types: Map<string, Type> } => {
  const options = { strict: true, target: typescript.ScriptTarget.ES2022 };
  const host = typescript.createCompilerHost(options);
  const read = host.getSourceFile.bind(host);
  host.getSourceFile = (file, language, ...rest) => (file === FILE ? typescript.createSourceFile(file, SOURCE, language) : read(file, language, ...rest));
  const program = typescript.createProgram([FILE], options, host);
  const checker = program.getTypeChecker();
  const types = new Map<string, Type>();
  for (const statement of program.getSourceFile(FILE)?.statements ?? [])
    if (typescript.isVariableStatement(statement))
      for (const declaration of statement.declarationList.declarations) types.set(declaration.name.getText(), checker.getTypeAtLocation(declaration.name));
  return { checker, types };
};

describe('BrandUtils', () => {
  const { checker, types } = typesOf();
  const typeOf = (name: string): Type => types.get(name)!;

  describe('holdsBrand', () => {
    test('finds a brand, alone or in what a type holds: a union, an array, a map, a record', () => {
      expect(['id', 'maybe', 'list', 'lookup', 'keyed'].map(name => holdsBrand(checker, typeOf(name)))).toEqual([true, true, true, true, true]);
    });

    test("finds none in a plain type, nor in an object's properties", () => {
      expect([holdsBrand(checker, typeOf('plain')), holdsBrand(checker, typeOf('holding'))]).toEqual([false, false]);
    });
  });

  describe('isKeyedByBrand', () => {
    test('finds a record keyed by a brand, or one of them in a union', () => {
      expect([isKeyedByBrand(checker, typeOf('keyed')), isKeyedByBrand(checker, typeOf('keyedOrNot'))]).toEqual([true, true]);
    });

    test('finds no record in a map, a brand alone or a plain type', () => {
      expect(['lookup', 'id', 'plain'].map(name => isKeyedByBrand(checker, typeOf(name)))).toEqual([false, false, false]);
    });
  });
});
