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

  test('holds an event back until flushed, in the order raised, and drops what is held on clear', () => {
    const events = new EventEmitter<{ tick: number }>();
    const heard: number[] = [];
    events.on('tick', value => {
      heard.push(value);
    });
    events.later('tick', 1);
    events.later('tick', 2);
    expect(heard).toEqual([]);
    events.flush();
    expect(heard).toEqual([1, 2]);
    events.later('tick', 3);
    events.clear();
    events.flush();
    expect(heard).toEqual([1, 2]);
  });

  test('keeps an event raised while flushing for the next flush', () => {
    const events = new EventEmitter<{ tick: number }>();
    const heard: number[] = [];
    events.on('tick', value => {
      heard.push(value);
      if (value === 1) events.later('tick', 2);
    });
    events.later('tick', 1);
    events.flush();
    expect(heard).toEqual([1]);
    events.flush();
    expect(heard).toEqual([1, 2]);
  });
});
