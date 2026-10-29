/**
 * A binary min-heap: items come out cheapest first. What Dijkstra's search takes its next place
 * from, in log time.
 */
export class PriorityQueue<Item> {
  /** The items with their costs, as a heap: each parent costs no more than its children. */
  private readonly entries: { cost: number; item: Item }[] = [];

  /** How many items wait. */
  public get size(): number {
    return this.entries.length;
  }

  /**
   * Adds an item.
   *
   * @param item - The item.
   * @param cost - Its cost: the cheapest comes out first.
   */
  public push(item: Item, cost: number): void {
    this.entries.push({ cost, item });
    let child = this.entries.length - 1;
    while (child > 0) {
      const parent = (child - 1) >> 1;
      if (this.costAt(parent) <= this.costAt(child)) break;
      this.swap(parent, child);
      child = parent;
    }
  }

  /**
   * Takes the cheapest item out.
   *
   * @returns It and its cost, or `undefined` when empty.
   */
  public pop(): { cost: number; item: Item } | undefined {
    const top = this.entries[0];
    const last = this.entries.pop();
    if (!top || !last || this.entries.length === 0) return top;
    this.entries[0] = last;
    let parent = 0;
    while (parent * 2 + 1 < this.entries.length) {
      const left = parent * 2 + 1;
      const cheaper = left + 1 < this.entries.length && this.costAt(left + 1) < this.costAt(left) ? left + 1 : left;
      if (this.costAt(parent) <= this.costAt(cheaper)) break;
      this.swap(parent, cheaper);
      parent = cheaper;
    }
    return top;
  }

  /**
   * The cost of the entry at a position.
   *
   * @param position - A position in the heap.
   * @returns Its cost.
   */
  private costAt(position: number): number {
    return this.entries[position]?.cost ?? Infinity;
  }

  /**
   * Swaps two entries.
   *
   * @param first - A position in the heap.
   * @param second - Another.
   */
  private swap(first: number, second: number): void {
    // Within bounds: both are positions the caller took from the heap.
    [this.entries[first], this.entries[second]] = [this.entries[second]!, this.entries[first]!];
  }
}
