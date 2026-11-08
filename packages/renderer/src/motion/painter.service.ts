import { required } from '@railtime/core/required.utils';
import { STROKE_ATTRIBUTES, STROKE_FRAGMENT_SHADER, STROKE_VERTEX_FLOATS, STROKE_VERTEX_SHADER } from './motion.constants';
import type { StrokeDrawing } from './motion.types';

/** The uniforms the stroke shaders read: the projection, a slot's pixels, and each stroke's settings, one an instance. */
const UNIFORMS = ['u_matrix', 'u_slot_px', 'u_half_widths', 'u_rises', 'u_blurs', 'u_colors', 'u_owns', 'u_shades', 'u_shade_amounts', 'u_opacities'] as const;

/** A uniform of the stroke shaders. */
type Uniform = (typeof UNIFORMS)[number];

/**
 * Draws strokes along moving things with WebGL, in MapLibre's own context, as it draws a frame: the
 * one program, compiled once, and one buffer, filled anew each frame. Knows nothing of what moves.
 */
export class StrokePainter {
  /** MapLibre's context. */
  private readonly context: WebGL2RenderingContext;
  /** The stroke shaders. */
  private readonly program: WebGLProgram;
  /** The vertices. */
  private readonly buffer: WebGLBuffer;
  /** How the vertices are read. */
  private readonly layout: WebGLVertexArrayObject;
  /** Where each uniform is. */
  private readonly uniforms: Map<Uniform, WebGLUniformLocation | null>;

  public constructor(context: WebGL2RenderingContext) {
    this.context = context;
    this.program = this.link();
    this.buffer = context.createBuffer();
    this.layout = context.createVertexArray();
    context.bindVertexArray(this.layout);
    context.bindBuffer(context.ARRAY_BUFFER, this.buffer);
    for (const { name, size, offset } of STROKE_ATTRIBUTES) {
      const location = context.getAttribLocation(this.program, name);
      context.enableVertexAttribArray(location);
      context.vertexAttribPointer(location, size, context.FLOAT, false, STROKE_VERTEX_FLOATS * 4, offset * 4);
    }
    context.bindVertexArray(null);
    this.uniforms = new Map(UNIFORMS.map(name => [name, context.getUniformLocation(this.program, name)]));
  }

  /**
   * Draws a kind's strokes over what the map has drawn so far: each run of vertices in its turn, in
   * one draw, an instance a stroke, from the bottom up.
   *
   * @param drawing - The strokes, and the order of their runs.
   * @param matrix - The projection from pixels of the map's zoom about their anchor (`anchoredMatrix`).
   */
  public draw({ vertices, order, passes, slotPx }: StrokeDrawing, matrix: Float32Array): void {
    const { context } = this;
    if (order.length === 0 || passes.length === 0) return;
    context.useProgram(this.program);
    context.bindVertexArray(this.layout);
    context.bindBuffer(context.ARRAY_BUFFER, this.buffer);
    context.bufferData(context.ARRAY_BUFFER, vertices, context.STREAM_DRAW);
    context.uniformMatrix4fv(this.locationOf('u_matrix'), false, matrix);
    context.uniform1f(this.locationOf('u_slot_px'), slotPx);
    context.uniform1fv(
      this.locationOf('u_half_widths'),
      passes.map(pass => pass.widthPx / 2),
    );
    context.uniform1fv(
      this.locationOf('u_rises'),
      passes.map(pass => pass.risePx),
    );
    context.uniform1fv(
      this.locationOf('u_blurs'),
      passes.map(pass => pass.blurPx),
    );
    context.uniform3fv(
      this.locationOf('u_colors'),
      passes.flatMap(pass => (pass.color === 'own' ? [0, 0, 0] : pass.color)),
    );
    context.uniform1fv(
      this.locationOf('u_owns'),
      passes.map(pass => (pass.color === 'own' ? 1 : 0)),
    );
    context.uniform3fv(
      this.locationOf('u_shades'),
      passes.flatMap(pass => pass.shade),
    );
    context.uniform1fv(
      this.locationOf('u_shade_amounts'),
      passes.map(pass => pass.shadeAmount),
    );
    context.uniform1fv(
      this.locationOf('u_opacities'),
      passes.map(pass => pass.opacity),
    );
    for (const { first, count } of order) context.drawArraysInstanced(context.TRIANGLES, first, count, passes.length);
    context.bindVertexArray(null);
  }

  /** Lets the context's program, buffer and vertex array go: the map is done with the layer. */
  public destroy(): void {
    this.context.deleteProgram(this.program);
    this.context.deleteBuffer(this.buffer);
    this.context.deleteVertexArray(this.layout);
  }

  /**
   * Where a uniform is.
   *
   * @param name - The uniform.
   * @returns Its location.
   */
  private locationOf(name: Uniform): WebGLUniformLocation | null {
    return this.uniforms.get(name) ?? null;
  }

  /**
   * Compiles and links the stroke shaders.
   *
   * @returns The program.
   * @throws What the context says, if a shader does not compile or the program does not link.
   */
  private link(): WebGLProgram {
    const { context } = this;
    const program = context.createProgram();
    for (const [kind, source] of [
      [context.VERTEX_SHADER, STROKE_VERTEX_SHADER],
      [context.FRAGMENT_SHADER, STROKE_FRAGMENT_SHADER],
    ] as const) {
      const shader = required(context.createShader(kind) ?? undefined, 'a shader');
      context.shaderSource(shader, source);
      context.compileShader(shader);
      if (context.getShaderParameter(shader, context.COMPILE_STATUS) !== true)
        throw new Error(`A stroke shader does not compile: ${context.getShaderInfoLog(shader) ?? ''}`);
      context.attachShader(program, shader);
      context.deleteShader(shader);
    }
    context.linkProgram(program);
    if (context.getProgramParameter(program, context.LINK_STATUS) !== true)
      throw new Error(`The stroke shaders do not link: ${context.getProgramInfoLog(program)}`);
    return program;
  }
}
