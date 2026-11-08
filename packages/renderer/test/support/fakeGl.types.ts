/** A draw the stand-in context was asked for: from which vertex, how many, how many instances, and every uniform as it was set then. */
type FakeDraw = { first: number; count: number; instances: number; uniforms: Record<string, unknown> };

/** A stand-in for a WebGL2 context in node, which has none: it compiles nothing and keeps what it is asked to draw. */
export type FakeGl = {
  /** The stand-in, typed as the context a layer takes. */
  context: WebGL2RenderingContext;
  /** Every draw, in order. */
  draws: FakeDraw[];
  /** How many numbers each buffer upload held, in order. */
  uploads: number[];
  /** What was let go: `program`, `buffer`, `vertexArray`. */
  deleted: string[];
  /** Makes the next shader compiled fail, as a context refusing it would. */
  failNextCompile: () => void;
};
