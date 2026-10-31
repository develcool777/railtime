import { describe, expect, test } from 'vitest';
import { PriorityQueue } from '../../../src/core/priorityQueue.service';

describe('PriorityQueue', () => {
  test('gives items back cheapest first, whatever order they came in', () => {
    const queue = new PriorityQueue<string>();
    const costs = [5, 1, 9, 3, 7, 2, 8, 0, 6, 4];
    for (const cost of costs) queue.push(`item ${cost}`, cost);
    expect(queue.size).toBe(costs.length);
    const out: number[] = [];
    for (let next = queue.pop(); next; next = queue.pop()) out.push(next.cost);
    expect(out).toEqual([...costs].sort((first, second) => first - second));
  });

  test('is empty once every item is out', () => {
    const queue = new PriorityQueue<string>();
    queue.push('only', 1);
    expect(queue.pop()).toEqual({ cost: 1, item: 'only' });
    expect(queue.pop()).toBeUndefined();
    expect(queue.size).toBe(0);
  });
});
