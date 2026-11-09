import type { ModuleDescription } from "../module-description";

/**
 * TEMPORARY: the types of `rune`, written by hand from the declarations of the module (the
 * `Rune` type, the functions of functions.ts, and the functions that the plugin defines: `show`,
 * `anaglyph`, `hollusion`, `hollusion_magnitude`, `animate_rune`, `animate_anaglyph`). To be removed
 * when the module publishes its own description (source-academy/modules#996).
 */
export const RUNE: ModuleDescription = {
  version: 1,
  module: "rune",
  opaqueTypes: ["Rune"],
  functions: [
    {
      name: "anaglyph",
      params: [{ name: "rune", type: { opaque: "Rune" } }],
      returns: { opaque: "Rune" },
    },
    {
      name: "animate_anaglyph",
      params: [
        { name: "duration", type: "number" },
        { name: "fps", type: "number" },
        { name: "func", type: { function: { params: ["number"], returns: { opaque: "Rune" } } } },
      ],
      returns: { opaque: "Rune" },
    },
    {
      name: "animate_rune",
      params: [
        { name: "duration", type: "number" },
        { name: "fps", type: "number" },
        { name: "func", type: { function: { params: ["number"], returns: { opaque: "Rune" } } } },
      ],
      returns: { opaque: "Rune" },
    },
    {
      name: "beside",
      params: [
        { name: "rune1", type: { opaque: "Rune" } },
        { name: "rune2", type: { opaque: "Rune" } },
      ],
      returns: { opaque: "Rune" },
    },
    {
      name: "beside_frac",
      params: [
        { name: "frac", type: "number" },
        { name: "rune1", type: { opaque: "Rune" } },
        { name: "rune2", type: { opaque: "Rune" } },
      ],
      returns: { opaque: "Rune" },
    },
    {
      name: "black",
      params: [{ name: "rune", type: { opaque: "Rune" } }],
      returns: { opaque: "Rune" },
    },
    {
      name: "blue",
      params: [{ name: "rune", type: { opaque: "Rune" } }],
      returns: { opaque: "Rune" },
    },
    {
      name: "brown",
      params: [{ name: "rune", type: { opaque: "Rune" } }],
      returns: { opaque: "Rune" },
    },
    {
      name: "color",
      params: [
        { name: "rune", type: { opaque: "Rune" } },
        { name: "r", type: "number" },
        { name: "g", type: "number" },
        { name: "b", type: "number" },
      ],
      returns: { opaque: "Rune" },
    },
    {
      name: "colour_with_hue",
      params: [
        { name: "rune", type: { opaque: "Rune" } },
        { name: "hue", type: "number" },
      ],
      returns: { opaque: "Rune" },
    },
    {
      name: "flip_horiz",
      params: [{ name: "rune", type: { opaque: "Rune" } }],
      returns: { opaque: "Rune" },
    },
    {
      name: "flip_vert",
      params: [{ name: "rune", type: { opaque: "Rune" } }],
      returns: { opaque: "Rune" },
    },
    {
      name: "from_url",
      params: [{ name: "imageUrl", type: "string" }],
      returns: { opaque: "Rune" },
    },
    {
      name: "green",
      params: [{ name: "rune", type: { opaque: "Rune" } }],
      returns: { opaque: "Rune" },
    },
    {
      name: "hollusion",
      params: [{ name: "rune", type: { opaque: "Rune" } }],
      returns: { opaque: "Rune" },
    },
    {
      name: "hollusion_magnitude",
      params: [
        { name: "rune", type: { opaque: "Rune" } },
        { name: "magnitude", type: "number" },
      ],
      returns: { opaque: "Rune" },
    },
    {
      name: "indigo",
      params: [{ name: "rune", type: { opaque: "Rune" } }],
      returns: { opaque: "Rune" },
    },
    {
      name: "make_cross",
      params: [{ name: "rune", type: { opaque: "Rune" } }],
      returns: { opaque: "Rune" },
    },
    {
      name: "orange",
      params: [{ name: "rune", type: { opaque: "Rune" } }],
      returns: { opaque: "Rune" },
    },
    {
      name: "overlay",
      params: [
        { name: "rune1", type: { opaque: "Rune" } },
        { name: "rune2", type: { opaque: "Rune" } },
      ],
      returns: { opaque: "Rune" },
    },
    {
      name: "overlay_frac",
      params: [
        { name: "frac", type: "number" },
        { name: "rune1", type: { opaque: "Rune" } },
        { name: "rune2", type: { opaque: "Rune" } },
      ],
      returns: { opaque: "Rune" },
    },
    {
      name: "pink",
      params: [{ name: "rune", type: { opaque: "Rune" } }],
      returns: { opaque: "Rune" },
    },
    {
      name: "purple",
      params: [{ name: "rune", type: { opaque: "Rune" } }],
      returns: { opaque: "Rune" },
    },
    {
      name: "quarter_turn_left",
      params: [{ name: "rune", type: { opaque: "Rune" } }],
      returns: { opaque: "Rune" },
    },
    {
      name: "quarter_turn_right",
      params: [{ name: "rune", type: { opaque: "Rune" } }],
      returns: { opaque: "Rune" },
    },
    {
      name: "random_color",
      params: [{ name: "rune", type: { opaque: "Rune" } }],
      returns: { opaque: "Rune" },
    },
    {
      name: "red",
      params: [{ name: "rune", type: { opaque: "Rune" } }],
      returns: { opaque: "Rune" },
    },
    {
      name: "rotate",
      params: [
        { name: "rad", type: "number" },
        { name: "rune", type: { opaque: "Rune" } },
      ],
      returns: { opaque: "Rune" },
    },
    {
      name: "scale",
      params: [
        { name: "ratio", type: "number" },
        { name: "rune", type: { opaque: "Rune" } },
      ],
      returns: { opaque: "Rune" },
    },
    {
      name: "scale_independent",
      params: [
        { name: "ratio_x", type: "number" },
        { name: "ratio_y", type: "number" },
        { name: "rune", type: { opaque: "Rune" } },
      ],
      returns: { opaque: "Rune" },
    },
    {
      name: "show",
      params: [{ name: "rune", type: { opaque: "Rune" } }],
      returns: { opaque: "Rune" },
    },
    {
      name: "stack",
      params: [
        { name: "rune1", type: { opaque: "Rune" } },
        { name: "rune2", type: { opaque: "Rune" } },
      ],
      returns: { opaque: "Rune" },
    },
    {
      name: "stack_frac",
      params: [
        { name: "frac", type: "number" },
        { name: "rune1", type: { opaque: "Rune" } },
        { name: "rune2", type: { opaque: "Rune" } },
      ],
      returns: { opaque: "Rune" },
    },
    {
      name: "stackn",
      params: [
        { name: "n", type: "integer" },
        { name: "rune", type: { opaque: "Rune" } },
      ],
      returns: { opaque: "Rune" },
    },
    {
      name: "translate",
      params: [
        { name: "x", type: "number" },
        { name: "y", type: "number" },
        { name: "rune", type: { opaque: "Rune" } },
      ],
      returns: { opaque: "Rune" },
    },
    {
      name: "turn_upside_down",
      params: [{ name: "rune", type: { opaque: "Rune" } }],
      returns: { opaque: "Rune" },
    },
    {
      name: "white",
      params: [{ name: "rune", type: { opaque: "Rune" } }],
      returns: { opaque: "Rune" },
    },
    {
      name: "yellow",
      params: [{ name: "rune", type: { opaque: "Rune" } }],
      returns: { opaque: "Rune" },
    },
  ],
  constants: [
    { name: "blank", type: { opaque: "Rune" } },
    { name: "circle", type: { opaque: "Rune" } },
    { name: "corner", type: { opaque: "Rune" } },
    { name: "heart", type: { opaque: "Rune" } },
    { name: "nova", type: { opaque: "Rune" } },
    { name: "pentagram", type: { opaque: "Rune" } },
    { name: "rcross", type: { opaque: "Rune" } },
    { name: "ribbon", type: { opaque: "Rune" } },
    { name: "sail", type: { opaque: "Rune" } },
    { name: "square", type: { opaque: "Rune" } },
    { name: "triangle", type: { opaque: "Rune" } },
  ],
};
