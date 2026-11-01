import type { EventListener, Unsubscribe } from './eventEmitter.types';

/**
 * Typed publish/subscribe, held by what raises the events: its events are a map of event name to
 * payload type. Kept private, it hands its owner `emit`, and its listeners come in as the owner says.
 *
 * @example
 * private readonly events = new EventEmitter<{ tick: number }>(); … this.events.emit('tick', now) …
 */
export class EventEmitter<Events extends object> {
  /** Listeners by event name. */
  private readonly listeners = new Map<keyof Events, Set<EventListener<never>>>();

  /**
   * Subscribes to an event.
   *
   * @param event - The event's name.
   * @param listener - Called with the event's payload every time it is emitted.
   * @returns A function that unsubscribes the listener.
   */
  public on<Name extends keyof Events>(event: Name, listener: EventListener<Events[Name]>): Unsubscribe {
    const forEvent = this.listeners.get(event) ?? new Set();
    forEvent.add(listener as EventListener<never>);
    this.listeners.set(event, forEvent);
    return () => forEvent.delete(listener as EventListener<never>);
  }

  /**
   * Calls every listener of an event, in the order they subscribed.
   *
   * @param event - The event's name.
   * @param payload - What the listeners receive.
   */
  public emit<Name extends keyof Events>(event: Name, payload: Events[Name]): void {
    for (const listener of this.listeners.get(event) ?? []) (listener as EventListener<Events[Name]>)(payload);
  }

  /** Drops every listener of every event. */
  public clear(): void {
    this.listeners.clear();
  }
}
