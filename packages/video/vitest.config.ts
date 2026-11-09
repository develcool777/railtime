import { defineConfig } from 'vitest/config';
import { projectsOf } from '../../vitest.shared.ts';

/** The videos made of the app (`test/unit/` mirrors `src/`): recording a page of it frame by frame. */
export default defineConfig({ test: { projects: projectsOf('video') } });
