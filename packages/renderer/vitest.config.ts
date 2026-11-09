import { defineConfig } from 'vitest/config';
import { projectsOf } from '../../vitest.shared.ts';

/**
 * The renderer's tests (`test/unit/` mirrors `src/`): its pure logic and its layers on the stand-in map
 * in node; the minimap, `BasemapStill` and `TransitMap` with its minimap, which add elements of their
 * own, in happy-dom (`*.spec.ts`).
 */
export default defineConfig({ test: { projects: projectsOf('renderer') } });
