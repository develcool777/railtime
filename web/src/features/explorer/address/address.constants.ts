/**
 * The least time between two writes of the address, ms. Playing, the playhead moves every frame, and a
 * browser refuses a page that rewrites its address that often (Safari: 100 times in 30 s); the last
 * one is always written.
 */
export const ADDRESS_WRITE_MS = 500;
