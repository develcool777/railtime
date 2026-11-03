import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { assertTestsMirrorSource, projectsOf } from '../../vitest.shared.ts';

const ROOT = fileURLToPath(new URL('.', import.meta.url));

assertTestsMirrorSource(ROOT, 'test/unit', 'src');

/**
 * The renderer's tests (`test/unit/` mirrors `src/`): its pure logic and its layers on the stand-in map
 * in node; the minimap, `BasemapStill` and `TransitMap` with its minimap, which add elements of their
 * own, in happy-dom (`*.spec.ts`).
 */
export default defineConfig({ test: { projects: projectsOf('renderer') } });
