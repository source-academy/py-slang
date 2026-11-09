import type { ModuleDescription, TypeDescription } from "../module-description";
import { fn, fun, opaque } from "./helpers";

const Point = opaque("Point");
/** A curve: a function from a number in [0, 1] to a point. */
const Curve = fun(["number"], Point);
/** A function from a curve to a curve (a transformation of curves). */
const Transformer = fun([Curve], Curve);
/**
 * What `draw_connected(200)` and the like are: applied to a curve, they draw it. The 2D drawers and the
 * 3D drawers (`draw_3D_connected`) are different types: `animate_curve` rejects a 3D drawer and
 * `animate_3D_curve` a 2D one, at run time, so the types tell them apart.
 */
const Drawer = fun([Curve], opaque("CurveDrawn"));
const Drawer3D = fun([Curve], opaque("Curve3DDrawn"));

/**
 * TEMPORARY: the types of `curve`, written by hand from the module's declarations (functions.ts,
 * drawers.ts) and the plugin's (index.ts). A curve is a function, as in the module's documentation:
 * `unit_circle` is one, and `connect_ends` combines two. `compose` is not exported by the plugin.
 * `num_points` is an `integer`: the drawers reject a number that is not whole.
 * To be removed when the module publishes its own description (source-academy/modules#996).
 */
export const CURVE: ModuleDescription = {
  version: 1,
  module: "curve",
  opaqueTypes: ["Point", "CurveDrawn", "Curve3DDrawn", "CurveAnimation"],
  functions: [
    fn(
      "make_point",
      [
        ["x", "number"],
        ["y", "number"],
      ],
      Point,
    ),
    fn(
      "make_3D_point",
      [
        ["x", "number"],
        ["y", "number"],
        ["z", "number"],
      ],
      Point,
    ),
    fn(
      "make_color_point",
      [
        ["x", "number"],
        ["y", "number"],
        ["r", "number"],
        ["g", "number"],
        ["b", "number"],
      ],
      Point,
    ),
    fn(
      "make_3D_color_point",
      [
        ["x", "number"],
        ["y", "number"],
        ["z", "number"],
        ["r", "number"],
        ["g", "number"],
        ["b", "number"],
      ],
      Point,
    ),
    ...["x_of", "y_of", "z_of", "r_of", "g_of", "b_of"].map(name =>
      fn(name, [["pt", Point]], "number"),
    ),
    fn("unit_circle", [["t", "number"]], Point),
    fn("unit_line", [["t", "number"]], Point),
    fn("arc", [["t", "number"]], Point),
    fn("unit_line_at", [["y", "number"]], Curve),
    fn(
      "connect_ends",
      [
        ["curve1", Curve],
        ["curve2", Curve],
      ],
      Curve,
    ),
    fn(
      "connect_rigidly",
      [
        ["curve1", Curve],
        ["curve2", Curve],
      ],
      Curve,
    ),
    fn("invert", [["original", Curve]], Curve),
    fn("put_in_standard_position", [["curve", Curve]], Curve),
    fn(
      "translate",
      [
        ["x0", "number"],
        ["y0", "number"],
        ["z0", "number"],
      ],
      Transformer,
    ),
    fn(
      "rainbow",
      [
        ["repeats", "number"],
        ["phase", "number"],
      ],
      Transformer,
    ),
    fn("rotate_around_origin", [["a", "number"]], Transformer),
    fn(
      "rotate_around_origin_3D",
      [
        ["a", "number"],
        ["b", "number"],
        ["c", "number"],
      ],
      Transformer,
    ),
    fn(
      "scale",
      [
        ["x", "number"],
        ["y", "number"],
        ["z", "number"],
      ],
      Transformer,
    ),
    fn("scale_proportional", [["s", "number"]], Transformer),
    ...[
      "draw_connected",
      "draw_connected_full_view",
      "draw_connected_full_view_proportional",
      "draw_points",
      "draw_points_full_view",
      "draw_points_full_view_proportional",
    ].map(name => fn(name, [["num_points", "integer"]], Drawer)),
    ...[
      "draw_3D_connected",
      "draw_3D_connected_full_view",
      "draw_3D_connected_full_view_proportional",
      "draw_3D_points",
      "draw_3D_points_full_view",
      "draw_3D_points_full_view_proportional",
    ].map(name => fn(name, [["num_points", "integer"]], Drawer3D)),
    ...[
      ["animate_curve", Drawer],
      ["animate_3D_curve", Drawer3D],
    ].map(([name, drawer]) =>
      fn(
        name as string,
        [
          ["duration", "number"],
          ["fps", "number"],
          ["drawer", drawer as TypeDescription],
          ["func", fun(["number"], Curve)],
        ],
        opaque("CurveAnimation"),
      ),
    ),
  ],
  constants: [],
};
