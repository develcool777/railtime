import { describe, expect, test } from 'vitest';
import { NetworkEngine } from '../../../src/engine/engine.service';
import { engineOf } from '../../../src/engine/engine.utils';
import { NetworkFacts } from '../../../src/facts/facts.service';
import { tinyNetwork } from '../../support/factories/tinyNetwork.utils';

describe('EngineUtils', () => {
  describe('engineOf', () => {
    test("hands the renderer the raw network behind a network's facts, the one they answer from", () => {
      const facts = NetworkFacts.create(tinyNetwork());
      const engine = engineOf(facts);
      expect(engine).toBeInstanceOf(NetworkEngine);
      expect(facts.playheads).toBe(engine.playheads);
      expect(engineOf(facts)).toBe(engine);
    });
  });
});
