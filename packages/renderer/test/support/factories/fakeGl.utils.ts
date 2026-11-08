import type { FakeGl } from '../fakeGl.types';

/**
 * A stand-in WebGL2 context: it hands out a handle for each thing asked of it, compiles and links
 * whatever it is given unless told to fail, and keeps every upload and every draw with the uniforms
 * set when it was asked for, so what a layer draws can be looked at in node.
 *
 * @returns The stand-in and what it keeps.
 */
export const fakeGl = (): FakeGl => {
  const draws: FakeGl['draws'] = [];
  const uploads: number[] = [];
  const deleted: string[] = [];
  const uniforms: Record<string, unknown> = {};
  const failing = { compile: false };
  let handles = 0;
  /**
   * A new handle, named for what it is.
   *
   * @param kind - What it is.
   * @returns The handle.
   */
  const handle = (kind: string) => {
    handles += 1;
    return { kind, id: handles };
  };
  /**
   * Sets a uniform by its location, which is its name.
   *
   * @param location - The location.
   * @param value - Its value.
   */
  const set = (location: { name: string } | null, value: unknown): void => {
    if (location) uniforms[location.name] = value;
  };
  const context = {
    ARRAY_BUFFER: 0x88_92,
    FLOAT: 0x14_06,
    TRIANGLES: 0x00_04,
    STREAM_DRAW: 0x88_e0,
    VERTEX_SHADER: 0x8b_31,
    FRAGMENT_SHADER: 0x8b_30,
    COMPILE_STATUS: 0x8b_81,
    LINK_STATUS: 0x8b_82,
    createProgram: () => handle('program'),
    createShader: () => handle('shader'),
    shaderSource: () => {},
    compileShader: () => {},
    getShaderParameter: () => {
      const compiled = !failing.compile;
      failing.compile = false;
      return compiled;
    },
    getShaderInfoLog: () => 'refused',
    attachShader: () => {},
    deleteShader: () => {},
    linkProgram: () => {},
    getProgramParameter: () => true,
    getProgramInfoLog: () => '',
    createBuffer: () => handle('buffer'),
    createVertexArray: () => handle('vertexArray'),
    bindVertexArray: () => {},
    bindBuffer: () => {},
    getAttribLocation: () => 0,
    enableVertexAttribArray: () => {},
    vertexAttribPointer: () => {},
    getUniformLocation: (_program: unknown, name: string) => ({ name }),
    useProgram: () => {},
    bufferData: (_target: number, data: Float32Array) => {
      uploads.push(data.length);
    },
    uniformMatrix4fv: (location: { name: string } | null, _transpose: boolean, value: Float32Array) => set(location, [...value]),
    uniform1f: set,
    uniform1fv: (location: { name: string } | null, value: number[]) => set(location, [...value]),
    uniform3fv: (location: { name: string } | null, value: number[]) => set(location, [...value]),
    drawArraysInstanced: (_mode: number, first: number, count: number, instances: number) => {
      draws.push({ first, count, instances, uniforms: { ...uniforms } });
    },
    deleteProgram: () => {
      deleted.push('program');
    },
    deleteBuffer: () => {
      deleted.push('buffer');
    },
    deleteVertexArray: () => {
      deleted.push('vertexArray');
    },
  };
  return {
    context: context as unknown as WebGL2RenderingContext,
    draws,
    uploads,
    deleted,
    failNextCompile: () => {
      failing.compile = true;
    },
  };
};
