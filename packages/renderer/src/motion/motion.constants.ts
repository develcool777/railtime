/** How wide a tile of the map is, pixels: a zoom's whole world is this many times two to its power wide. */
export const MAP_TILE_PX = 512;

/** How much of a standing mover's side stroke, as the camera sees it, overlaps the next up: enough that no gap shows between them. */
export const SIDE_OVERLAP = 0.75;

/** The most strokes a standing mover's sides take, the camera tilted all but flat: each one more instance of every mover's draw. */
export const MAX_SIDE_STEPS = 16;

/**
 * The numbers of one vertex of a stroke: the segment it is a corner of (its ends, about the anchor,
 * in pixels of the map's zoom), which corner (along: 0 its start, 1 its end; across: -1 left, 1 right), the
 * mover's colour (0..1) and its side-by-side slot.
 */
export const STROKE_ATTRIBUTES = [
  { name: 'a_from', size: 2, offset: 0 },
  { name: 'a_to', size: 2, offset: 2 },
  { name: 'a_corner', size: 2, offset: 4 },
  { name: 'a_color', size: 3, offset: 6 },
  { name: 'a_slot', size: 1, offset: 9 },
] as const;

/** How many numbers a vertex of a stroke is: its attributes', each after the last. */
export const STROKE_VERTEX_FLOATS = 10;

/** The corners of a segment's quad, two triangles: along (0 its start, 1 its end) and across (-1, 1). */
export const SEGMENT_CORNERS: readonly (readonly [number, number])[] = [
  [0, -1],
  [1, -1],
  [1, 1],
  [0, -1],
  [1, 1],
  [0, 1],
];

/** The most strokes a kind of mover is drawn with: its shadow, its sides' every step and its body (`passesOf`). */
export const MAX_PASSES = MAX_SIDE_STEPS + 3;

/**
 * Places each corner of a segment's quad on the ground, in pixels of the map's zoom about its anchor,
 * as MapLibre lays its own lines: both ends moved across to the mover's slot, then out round them as
 * far as the stroke is wide, and a pixel more for its edge; raised as high as the stroke stands. The
 * map's projection does the rest: smaller further off in 3D, the ground foreshortened, the height up.
 * Each instance is one stroke, its settings the instance's of the uniforms': GL draws them in order,
 * so one draw lays a mover's strokes from the bottom up.
 */
export const STROKE_VERTEX_SHADER = `#version 300 es
precision highp float;
uniform mat4 u_matrix;
uniform float u_slot_px;
uniform float u_half_widths[${MAX_PASSES}];
uniform float u_rises[${MAX_PASSES}];
uniform float u_blurs[${MAX_PASSES}];
uniform vec3 u_colors[${MAX_PASSES}];
uniform float u_owns[${MAX_PASSES}];
uniform vec3 u_shades[${MAX_PASSES}];
uniform float u_shade_amounts[${MAX_PASSES}];
uniform float u_opacities[${MAX_PASSES}];
in vec2 a_from;
in vec2 a_to;
in vec2 a_corner;
in vec3 a_color;
in float a_slot;
out vec2 v_pos;
out vec2 v_from;
out vec2 v_to;
flat out vec3 v_color;
flat out float v_half_width;
flat out float v_blur;
flat out float v_opacity;
void main() {
  int pass = gl_InstanceID;
  float half_width = u_half_widths[pass];
  vec2 along = a_to - a_from;
  float span = length(along);
  vec2 dir = span > 0.0 ? along / span : vec2(1.0, 0.0);
  vec2 right = vec2(-dir.y, dir.x);
  vec2 shift = right * a_slot * u_slot_px;
  vec2 start = a_from + shift;
  vec2 end = a_to + shift;
  float reach = half_width + 1.0;
  vec2 corner = (a_corner.x < 0.5 ? start - dir * reach : end + dir * reach) + right * a_corner.y * reach;
  v_pos = corner;
  v_from = start;
  v_to = end;
  v_color = mix(mix(u_colors[pass], a_color, u_owns[pass]), u_shades[pass], u_shade_amounts[pass]);
  v_half_width = half_width;
  v_blur = u_blurs[pass];
  v_opacity = u_opacities[pass];
  gl_Position = u_matrix * vec4(corner, u_rises[pass], 1.0);
}`;

/**
 * Colours a stroke: as far from its segment as it is wide, round at its ends and joins, its edge
 * smoothed over a pixel or as soft as asked; premultiplied, as MapLibre blends.
 */
export const STROKE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 v_pos;
in vec2 v_from;
in vec2 v_to;
flat in vec3 v_color;
flat in float v_half_width;
flat in float v_blur;
flat in float v_opacity;
out vec4 fragColor;
void main() {
  vec2 segment = v_to - v_from;
  float along = clamp(dot(v_pos - v_from, segment) / max(dot(segment, segment), 0.000001), 0.0, 1.0);
  float distance = length(v_pos - v_from - segment * along);
  float edge = max(v_blur, 1.0);
  float alpha = (1.0 - smoothstep(v_half_width - edge * 0.5, v_half_width + edge * 0.5, distance)) * v_opacity;
  if (alpha <= 0.0) discard;
  fragColor = vec4(v_color * alpha, alpha);
}`;
