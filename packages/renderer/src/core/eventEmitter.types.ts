/** A subscriber to one event, called with that event's payload. */
export type EventListener<Payload> = (payload: Payload) => void;

/** Removes the listener it was returned for. */
export type Unsubscribe = () => void;
