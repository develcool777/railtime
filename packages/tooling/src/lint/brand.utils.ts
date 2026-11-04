import typescript from 'typescript';
import type { ObjectType, Type, TypeChecker, TypeReference } from 'typescript';

/**
 * The tag `Brand` (`@railtime/core/brand.types`) puts on a type: a property keyed by its unique
 * symbol `brand`, which TypeScript names `__@brand@<id>`. Found by its tag, not by its name, so a
 * brand added later is one too.
 */
const BRAND_KEY = '__@brand@';

/** The flags that say what a type is. */
const { ObjectFlags, TypeFlags } = typescript;

/** How deep a brand is looked for inside a type: `Map<StationId, …>[]` is three down. */
const DEPTH = 3;

/**
 * Whether a type is a brand: a base type with the brand's tag (`StationId`, `LineId`).
 *
 * @param checker - The program's type checker.
 * @param type - The type.
 * @returns True for a brand.
 */
const isBrand = (checker: TypeChecker, type: Type): boolean =>
  type.isIntersection() && type.types.some(part => checker.getPropertiesOfType(part).some(property => String(property.escapedName).startsWith(BRAND_KEY)));

/**
 * Whether a type is a reference to a generic one, whose arguments say what it holds (`Map<K, V>`, `T[]`).
 *
 * @param type - The type.
 * @returns True for a reference.
 */
const isReference = (type: Type): type is TypeReference =>
  (type.flags & TypeFlags.Object) !== 0 && ((type as ObjectType).objectFlags & ObjectFlags.Reference) !== 0;

/**
 * The types a type holds, where a brand would say what kind of id: a union's members, a generic's
 * arguments (`Map<StationId, …>`, `LineId[]`, `[StationId, number]`), an alias's (`Record<LineId, …>`)
 * and its index signatures' keys.
 *
 * @param checker - The program's type checker.
 * @param type - The type.
 * @returns The types inside it, one level down.
 */
const partsOf = (checker: TypeChecker, type: Type): readonly Type[] => [
  ...(type.isUnion() ? type.types : []),
  ...(type.aliasTypeArguments ?? []),
  ...(isReference(type) ? checker.getTypeArguments(type) : []),
  ...checker.getIndexInfosOfType(type).map(info => info.keyType),
];

/**
 * Whether a type is a brand or holds one: `StationId`, `LineId[] | null`, `Map<StationId, number>`,
 * `Record<LineId, Line>`. An object's properties are not looked into: a `Network` holds ids, but is
 * made by `parseNetwork`, which checks them.
 *
 * @param checker - The program's type checker.
 * @param type - The type.
 * @param depth - How much deeper to look.
 * @returns True if a brand is in it.
 */
export const holdsBrand = (checker: TypeChecker, type: Type, depth = DEPTH): boolean =>
  isBrand(checker, type) || (depth > 0 && partsOf(checker, type).some(part => holdsBrand(checker, part, depth - 1)));

/**
 * Whether a type is a record keyed by a brand: an index signature whose key is one (`Record<StationId, Station>`),
 * or such a record or nothing (`Record<LineId, IsoDate> | {}`).
 *
 * @param checker - The program's type checker.
 * @param type - The type.
 * @returns True if its keys are ids.
 */
export const isKeyedByBrand = (checker: TypeChecker, type: Type): boolean =>
  type.isUnion() ? type.types.some(member => isKeyedByBrand(checker, member)) : checker.getIndexInfosOfType(type).some(info => isBrand(checker, info.keyType));
