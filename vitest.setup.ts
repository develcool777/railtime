import { afterEach, beforeEach, expect, vi } from 'vitest';

/*
 * A warning or an error logged during a test is a failure: the code it came from was unhappy, and a
 * passing test should not hide it. A test that expects one spies on `console` itself.
 */
beforeEach(() => {
  vi.spyOn(console, 'warn');
  vi.spyOn(console, 'error');
});

afterEach(() => {
  expect(console.warn, 'unexpected console.warn').not.toHaveBeenCalled();
  expect(console.error, 'unexpected console.error').not.toHaveBeenCalled();
});
