import { describe, expect, test } from 'vitest';
import { EventEmitter } from '../../../src/support/eventEmitter.service';

describe('EventEmitter', () => {
  test("calls an event's listeners in the order they subscribed, and only that event's", () => {
    const emitter = new EventEmitter<{ tick: number; tock: string }>();
    const heard: string[] = [];
    emitter.on('tick', value => {
      heard.push(`first ${value}`);
    });
    emitter.on('tick', value => {
      heard.push(`second ${value}`);
    });
    emitter.on('tock', value => {
      heard.push(`tock ${value}`);
    });
    emitter.emit('tick', 1);
    expect(heard).toEqual(['first 1', 'second 1']);
  });

  test('stops calling a listener once it unsubscribes, or once every listener is dropped', () => {
    const emitter = new EventEmitter<{ tick: number }>();
    const heard: number[] = [];
    const unsubscribe = emitter.on('tick', value => {
      heard.push(value);
    });
    emitter.emit('tick', 1);
    unsubscribe();
    emitter.emit('tick', 2);
    emitter.on('tick', value => {
      heard.push(value);
    });
    emitter.clear();
    emitter.emit('tick', 3);
    expect(heard).toEqual([1]);
  });
});
