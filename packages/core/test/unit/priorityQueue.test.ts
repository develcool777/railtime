import { describe, expect, test } from 'vitest';
import { PriorityQueue } from '../../src/priorityQueue.service';

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

  test('keeps cheapest first through many items, ties among them, taken out as more come in', () => {
    const queue = new PriorityQueue<number>();
    const out: number[] = [];
    // A spread of costs with repeats, half taken out before the rest arrive.
    const costs = Array.from({ length: 200 }, (_, position) => (position * 37) % 50);
    for (const cost of costs.slice(0, 100)) queue.push(cost, cost);
    for (let taken = 0; taken < 50; taken++) out.push(queue.pop()!.cost);
    for (const cost of costs.slice(100)) queue.push(cost, cost);
    for (let next = queue.pop(); next; next = queue.pop()) out.push(next.cost);
    const firstHalf = [...costs.slice(0, 100)].sort((first, second) => first - second);
    expect(out.slice(0, 50)).toEqual(firstHalf.slice(0, 50));
    expect(out.slice(50)).toEqual([...firstHalf.slice(50), ...costs.slice(100)].sort((first, second) => first - second));
  });
});
