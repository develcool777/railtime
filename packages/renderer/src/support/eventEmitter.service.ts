import type { EventListener, Unsubscribe } from './eventEmitter.types';

/**
 * A typed publish/subscribe base class. A subclass declares its events as a map of event name to
 * payload type, and gets `on` for its users and `emit` for itself.
 *
 * @example
 * class Clock extends EventEmitter<{ tick: number }> { … this.emit('tick', now) … }
 * clock.on('tick', now => …);
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
  protected emit<Name extends keyof Events>(event: Name, payload: Events[Name]): void {
    for (const listener of this.listeners.get(event) ?? []) (listener as EventListener<Events[Name]>)(payload);
  }

  /** Drops every listener of every event. */
  protected removeAllListeners(): void {
    this.listeners.clear();
  }
}
