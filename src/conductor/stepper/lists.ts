/**
 * The Python §2 linked-list library for the substitution stepper.
 *
 * Python §2 adds the empty linked list `None` and a linked-list library to Python §1 (see py-slang's
 * `docs/specs/python_2.tex` and `docs/lib/linked_list.py`). This module is the stepper's view of that
 * library. As in Source's stepper (`js-slang/src/stepper/builtins/lists.ts`), a pair is a two-element
 * `ArrayExpression` rendered `[head, tail]` and the empty list is `None`; only the surface *names*
 * differ — Python's `pair`/`head`/`tail`/`linked_list`/`map_linked_list`/… in place of Source's
 * `pair`/`head`/`tail`/`list`/`map`/… — so a stepped Python program reads as Python while pairs and
 * lists display exactly like Source.
 *
 * The library splits into:
 *  - **primitives** (`pair`, `is_pair`, `head`, `tail`, `is_linked_list`, `linked_list`, `draw_data`),
 *    computed directly from already-reduced value arguments; and
 *  - **pre-declared** functions (`map_linked_list`, `filter_linked_list`, …), each modelled as a
 *    `lambda`/`def` template that the stepper expands by substituting the value arguments for the
 *    parameters — so the recursion unfolds step by step in the visualiser, exactly as Source unfolds
 *    its `$map`/`$filter`/… helpers. A pre-declared function's body refers to other library functions
 *    (and its own `_`-prefixed helper) by name; those names are themselves library built-ins, so each
 *    recursive call re-expands on demand.
 *
 * `None` (the empty-list value and the `is_none` predicate) is provided by the MISC predicates in
 * `builtins.ts` and is intentionally not redefined here. The §3 pair mutators (`set_head`/`set_tail`)
 * and the stream library are out of scope: mutation cannot be modelled in a pure substitution view
 * (Source's stepper omits them too).
 */

import {
  type StepNode,
  clone,
  emptyList,
  identifier,
  isEmptyList,
  isPairNode,
  literal,
  pairNode,
  paramNames,
  stringLiteral,
  substitute,
} from "./ast";

type BuiltinFn = (args: StepNode[]) => StepNode;

/* -------------------------------------------------------------------------- */
/*                          Small self-contained helpers                      */
/* -------------------------------------------------------------------------- */
// lists.ts must not import builtins.ts (builtins.ts imports lists.ts), so the few value helpers it
// needs are defined locally; they mirror the equivalents in builtins.ts.

function fail(message: string): never {
  throw new Error(message);
}
function typeError(message: string): never {
  return fail(`TypeError: ${message}`);
}
function checkArity(name: string, args: StepNode[], min: number, max: number | null): void {
  if (args.length < min || (max !== null && args.length > max)) {
    const want = max === null ? `at least ${min}` : min === max ? `${min}` : `${min} to ${max}`;
    typeError(`${name}() takes ${want} argument(s) but ${args.length} were given`);
  }
}
const boolLit = (b: boolean): StepNode => literal(b, b ? "True" : "False");
const intLit = (n: number): StepNode => literal(BigInt(n), String(n), false);

/* -------------------------------------------------------------------------- */
/*                       AST builders for library templates                   */
/* -------------------------------------------------------------------------- */
// Tiny constructors that read like the Python source they model, used to build the `lambda`/`def`
// templates of the pre-declared functions below.

const id = identifier;
const none = emptyList;
const call = (callee: string | StepNode, args: StepNode[]): StepNode => ({
  type: "CallExpression",
  callee: typeof callee === "string" ? id(callee) : callee,
  arguments: args,
});
const lam = (params: string[], body: StepNode): StepNode => ({
  type: "ArrowFunctionExpression",
  params: params.map(id),
  body,
});
const cond = (test: StepNode, consequent: StepNode, alternate: StepNode): StepNode => ({
  type: "ConditionalExpression",
  test,
  consequent,
  alternate,
});
const bin = (operator: string, left: StepNode, right: StepNode): StepNode => ({
  type: "BinaryExpression",
  operator,
  left,
  right,
});
const and = (left: StepNode, right: StepNode): StepNode => ({
  type: "LogicalExpression",
  operator: "and",
  left,
  right,
});
const or = (left: StepNode, right: StepNode): StepNode => ({
  type: "LogicalExpression",
  operator: "or",
  left,
  right,
});
const not = (argument: StepNode): StepNode => ({
  type: "UnaryExpression",
  operator: "not ",
  argument,
});
/** Left-associative string concatenation: `concat(a, b, c)` ⇒ `(a + b) + c`. */
const concat = (...parts: StepNode[]): StepNode => parts.reduce((acc, part) => bin("+", acc, part));
const ret = (argument: StepNode): StepNode => ({ type: "ReturnStatement", argument });
const exprStmt = (expression: StepNode): StepNode => ({ type: "ExpressionStatement", expression });
const ifElse = (test: StepNode, consequent: StepNode[], alternate: StepNode[]): StepNode => ({
  type: "IfStatement",
  test,
  consequent: { type: "BlockStatement", body: consequent },
  alternate: { type: "BlockStatement", body: alternate },
});

// Calls onto the list primitives, for readability of the templates.
const headOf = (x: StepNode): StepNode => call("head", [x]);
const tailOf = (x: StepNode): StepNode => call("tail", [x]);
const pairOf = (h: StepNode, t: StepNode): StepNode => call("pair", [h, t]);
const isNoneOf = (x: StepNode): StepNode => call("is_none", [x]);
const isPairOf = (x: StepNode): StepNode => call("is_pair", [x]);

/* -------------------------------------------------------------------------- */
/*                                 Primitives                                  */
/* -------------------------------------------------------------------------- */
// Computed directly from value arguments. `pair` builds a pair; the rest inspect/deconstruct one.

const primitives: Record<string, BuiltinFn> = {
  pair: args => {
    checkArity("pair", args, 2, 2);
    return pairNode(args[0], args[1]);
  },
  is_pair: args => {
    checkArity("is_pair", args, 1, 1);
    return boolLit(isPairNode(args[0]));
  },
  head: args => {
    checkArity("head", args, 1, 1);
    if (!isPairNode(args[0])) typeError("head() argument must be a pair");
    return (args[0].elements as StepNode[])[0];
  },
  tail: args => {
    checkArity("tail", args, 1, 1);
    if (!isPairNode(args[0])) typeError("tail() argument must be a pair");
    return (args[0].elements as StepNode[])[1];
  },
  is_linked_list: args => {
    checkArity("is_linked_list", args, 1, 1);
    // A linked list is `None` or a pair whose tail is itself a linked list.
    const ok = (n: StepNode): boolean =>
      isEmptyList(n) || (isPairNode(n) && ok((n.elements as StepNode[])[1]));
    return boolLit(ok(args[0]));
  },
  linked_list: args => {
    // Variadic: linked_list(v1, …, vn) = pair(v1, pair(…, pair(vn, None))). No arity check.
    let result = none();
    for (let i = args.length - 1; i >= 0; i--) result = pairNode(args[i], result);
    return result;
  },
  draw_data: args => {
    // Visualises its arguments as box-and-pointer diagrams; the stepper has no drawing canvas, so it
    // is a no-op returning its first argument (matching Source's `draw_data`/`display_list`).
    if (args.length < 1) typeError("draw_data() takes at least 1 argument but 0 were given");
    return args[0];
  },
};

/* -------------------------------------------------------------------------- */
/*                          Pre-declared (recursive) functions                */
/* -------------------------------------------------------------------------- */
// Each is a `lambda`/`def` template, transcribed from `docs/lib/linked_list.py`; `applyLibrary`
// expands a call by substituting its value arguments for the parameters and returning the body, which
// the reducer then continues to reduce. Internal `_`-prefixed helpers carry the accumulators, exactly
// like the spec's library and Source's `$`-prefixed helpers.

const library: Record<string, StepNode> = {
  // equal(xs, ys): structural equality — pairs compared element-wise, leaves by value.
  equal: lam(
    ["xs", "ys"],
    cond(
      isPairOf(id("xs")),
      and(
        isPairOf(id("ys")),
        and(
          call("equal", [headOf(id("xs")), headOf(id("ys"))]),
          call("equal", [tailOf(id("xs")), tailOf(id("ys"))]),
        ),
      ),
      cond(
        isNoneOf(id("xs")),
        isNoneOf(id("ys")),
        cond(
          or(
            call("is_int", [id("xs")]),
            or(call("is_float", [id("xs")]), call("is_complex", [id("xs")])),
          ),
          and(
            or(
              call("is_int", [id("ys")]),
              or(call("is_float", [id("ys")]), call("is_complex", [id("ys")])),
            ),
            bin("==", id("xs"), id("ys")),
          ),
          cond(
            call("is_boolean", [id("xs")]),
            and(
              call("is_boolean", [id("ys")]),
              or(and(id("xs"), id("ys")), and(not(id("xs")), not(id("ys")))),
            ),
            cond(
              call("is_string", [id("xs")]),
              and(call("is_string", [id("ys")]), bin("==", id("xs"), id("ys"))),
              boolLit(false),
            ),
          ),
        ),
      ),
    ),
  ),

  // length_linked_list(xs)
  length_linked_list: lam(["xs"], call("_length_linked_list", [id("xs"), intLit(0)])),
  _length_linked_list: lam(
    ["xs", "acc"],
    cond(
      isNoneOf(id("xs")),
      id("acc"),
      call("_length_linked_list", [tailOf(id("xs")), bin("+", id("acc"), intLit(1))]),
    ),
  ),

  // map_linked_list(f, xs)
  map_linked_list: lam(["f", "xs"], call("_map_linked_list", [id("f"), id("xs"), none()])),
  _map_linked_list: lam(
    ["f", "xs", "acc"],
    cond(
      isNoneOf(id("xs")),
      call("reverse_linked_list", [id("acc")]),
      call("_map_linked_list", [
        id("f"),
        tailOf(id("xs")),
        pairOf(call(id("f"), [headOf(id("xs"))]), id("acc")),
      ]),
    ),
  ),

  // build_linked_list(fun, n)
  build_linked_list: lam(
    ["fun", "n"],
    call("_build_linked_list", [bin("-", id("n"), intLit(1)), id("fun"), none()]),
  ),
  _build_linked_list: lam(
    ["i", "fun", "already_built"],
    cond(
      bin("<", id("i"), intLit(0)),
      id("already_built"),
      call("_build_linked_list", [
        bin("-", id("i"), intLit(1)),
        id("fun"),
        pairOf(call(id("fun"), [id("i")]), id("already_built")),
      ]),
    ),
  ),

  // for_each_linked_list(fun, xs): apply fun to each element, return True. Modelled as a `def` with a
  // block body so the side-effecting `fun(head(xs))` is shown being evaluated for each element,
  // mirroring Source's block-bodied `for_each`.
  for_each_linked_list: {
    type: "FunctionDeclaration",
    id: id("for_each_linked_list"),
    params: [id("fun"), id("xs")],
    body: {
      type: "BlockStatement",
      body: [
        ifElse(
          isNoneOf(id("xs")),
          [ret(boolLit(true))],
          [
            exprStmt(call(id("fun"), [headOf(id("xs"))])),
            ret(call("for_each_linked_list", [id("fun"), tailOf(id("xs"))])),
          ],
        ),
      ],
    },
  },

  // linked_list_to_string(xs): box-and-pointer text, e.g. linked_list(1, 2) ⇒ "[1, [2, None]]".
  linked_list_to_string: lam(
    ["xs"],
    call("_linked_list_to_string", [id("xs"), lam(["x"], id("x"))]),
  ),
  _linked_list_to_string: lam(
    ["xs", "cont"],
    cond(
      isNoneOf(id("xs")),
      call(id("cont"), [stringLiteral("None")]),
      cond(
        isPairOf(id("xs")),
        call("_linked_list_to_string", [
          headOf(id("xs")),
          lam(
            ["x_str"],
            call("_linked_list_to_string", [
              tailOf(id("xs")),
              lam(
                ["y_str"],
                call(id("cont"), [
                  concat(
                    stringLiteral("["),
                    id("x_str"),
                    stringLiteral(", "),
                    id("y_str"),
                    stringLiteral("]"),
                  ),
                ]),
              ),
            ]),
          ),
        ]),
        call(id("cont"), [call("repr", [id("xs")])]),
      ),
    ),
  ),

  // reverse_linked_list(xs)
  reverse_linked_list: lam(["xs"], call("_reverse_linked_list", [id("xs"), none()])),
  _reverse_linked_list: lam(
    ["original", "reversed_acc"],
    cond(
      isNoneOf(id("original")),
      id("reversed_acc"),
      call("_reverse_linked_list", [
        tailOf(id("original")),
        pairOf(headOf(id("original")), id("reversed_acc")),
      ]),
    ),
  ),

  // append_linked_list(xs, ys)
  append_linked_list: lam(
    ["xs", "ys"],
    call("_append_linked_list", [id("xs"), id("ys"), lam(["x"], id("x"))]),
  ),
  _append_linked_list: lam(
    ["xs", "ys", "cont"],
    cond(
      isNoneOf(id("xs")),
      call(id("cont"), [id("ys")]),
      call("_append_linked_list", [
        tailOf(id("xs")),
        id("ys"),
        lam(["zs"], call(id("cont"), [pairOf(headOf(id("xs")), id("zs"))])),
      ]),
    ),
  ),

  // member_linked_list(v, xs): first sub-list whose head equals v, else None.
  member_linked_list: lam(
    ["v", "xs"],
    cond(
      isNoneOf(id("xs")),
      none(),
      cond(
        bin("==", id("v"), headOf(id("xs"))),
        id("xs"),
        call("member_linked_list", [id("v"), tailOf(id("xs"))]),
      ),
    ),
  ),

  // remove_linked_list(v, xs): remove the first element equal to v.
  remove_linked_list: lam(["v", "xs"], call("_remove_linked_list", [id("v"), id("xs"), none()])),
  _remove_linked_list: lam(
    ["v", "xs", "acc"],
    cond(
      isNoneOf(id("xs")),
      call("append_linked_list", [call("reverse_linked_list", [id("acc")]), id("xs")]),
      cond(
        bin("==", id("v"), headOf(id("xs"))),
        call("append_linked_list", [call("reverse_linked_list", [id("acc")]), tailOf(id("xs"))]),
        call("_remove_linked_list", [
          id("v"),
          tailOf(id("xs")),
          pairOf(headOf(id("xs")), id("acc")),
        ]),
      ),
    ),
  ),

  // remove_all_linked_list(v, xs): remove every element equal to v.
  remove_all_linked_list: lam(
    ["v", "xs"],
    call("_remove_all_linked_list", [id("v"), id("xs"), none()]),
  ),
  _remove_all_linked_list: lam(
    ["v", "xs", "acc"],
    cond(
      isNoneOf(id("xs")),
      call("append_linked_list", [call("reverse_linked_list", [id("acc")]), id("xs")]),
      cond(
        bin("==", id("v"), headOf(id("xs"))),
        call("_remove_all_linked_list", [id("v"), tailOf(id("xs")), id("acc")]),
        call("_remove_all_linked_list", [
          id("v"),
          tailOf(id("xs")),
          pairOf(headOf(id("xs")), id("acc")),
        ]),
      ),
    ),
  ),

  // enum_linked_list(start, end): the list start, start+1, …, end.
  enum_linked_list: lam(
    ["start", "end"],
    call("_enum_linked_list", [id("start"), id("end"), none()]),
  ),
  _enum_linked_list: lam(
    ["start", "end", "acc"],
    cond(
      bin(">", id("start"), id("end")),
      call("reverse_linked_list", [id("acc")]),
      call("_enum_linked_list", [
        bin("+", id("start"), intLit(1)),
        id("end"),
        pairOf(id("start"), id("acc")),
      ]),
    ),
  ),

  // ref_linked_list(xs, n): the element at index n (0-based). Out of bounds ⇒ head(None) ⇒ stuck,
  // exactly like Source's `list_ref`.
  ref_linked_list: lam(
    ["xs", "n"],
    cond(
      bin("==", id("n"), intLit(0)),
      headOf(id("xs")),
      call("ref_linked_list", [tailOf(id("xs")), bin("-", id("n"), intLit(1))]),
    ),
  ),

  // accumulate_linked_list(f, initial, xs): fold f over the list from the right.
  accumulate_linked_list: lam(
    ["f", "initial", "xs"],
    call("_accumulate_linked_list", [id("f"), id("initial"), id("xs"), lam(["x"], id("x"))]),
  ),
  _accumulate_linked_list: lam(
    ["f", "initial", "xs", "cont"],
    cond(
      isNoneOf(id("xs")),
      call(id("cont"), [id("initial")]),
      call("_accumulate_linked_list", [
        id("f"),
        id("initial"),
        tailOf(id("xs")),
        lam(["x"], call(id("cont"), [call(id("f"), [headOf(id("xs")), id("x")])])),
      ]),
    ),
  ),

  // filter_linked_list(pred, xs): keep elements for which pred returns True.
  filter_linked_list: lam(
    ["pred", "xs"],
    call("_filter_linked_list", [id("pred"), id("xs"), none()]),
  ),
  _filter_linked_list: lam(
    ["pred", "xs", "acc"],
    cond(
      isNoneOf(id("xs")),
      call("reverse_linked_list", [id("acc")]),
      cond(
        call(id("pred"), [headOf(id("xs"))]),
        call("_filter_linked_list", [
          id("pred"),
          tailOf(id("xs")),
          pairOf(headOf(id("xs")), id("acc")),
        ]),
        call("_filter_linked_list", [id("pred"), tailOf(id("xs")), id("acc")]),
      ),
    ),
  ),
};

/**
 * Expands a pre-declared library call: substitutes the value `args` for the function template's
 * parameters and returns its body (an expression, or — for `for_each_linked_list` — a block that the
 * reducer evaluates as a block expression). The body's other library-function references resolve as
 * built-ins on subsequent steps, so recursion unfolds one step at a time.
 */
function applyLibrary(name: string, fn: StepNode, args: StepNode[]): StepNode {
  const params = paramNames(fn);
  if (params.length !== args.length) {
    typeError(`${name}() takes ${params.length} argument(s) but ${args.length} were given`);
  }
  let body = clone(fn.body as StepNode);
  params.forEach((param, index) => {
    body = substitute(body, param, args[index]);
  });
  return body;
}

/* -------------------------------------------------------------------------- */
/*                                  Exports                                    */
/* -------------------------------------------------------------------------- */

/** The complete §2 linked-list dispatch table (primitives + pre-declared functions and helpers). */
export const listBuiltins: Record<string, BuiltinFn> = { ...primitives };
for (const [name, fn] of Object.entries(library)) {
  listBuiltins[name] = args => applyLibrary(name, fn, args);
}

/** Parameter counts of the public list functions, for the `arity` built-in. */
export const listArities: Record<string, number> = {
  pair: 2,
  is_pair: 1,
  head: 1,
  tail: 1,
  is_linked_list: 1,
  linked_list: 0,
  draw_data: 1,
  equal: 2,
  length_linked_list: 1,
  map_linked_list: 2,
  build_linked_list: 2,
  for_each_linked_list: 2,
  linked_list_to_string: 1,
  reverse_linked_list: 1,
  append_linked_list: 2,
  member_linked_list: 2,
  remove_linked_list: 2,
  remove_all_linked_list: 2,
  enum_linked_list: 2,
  ref_linked_list: 2,
  accumulate_linked_list: 3,
  filter_linked_list: 2,
};
