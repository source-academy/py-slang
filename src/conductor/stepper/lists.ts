/**
 * The Python §2 linked-list library for the substitution stepper.
 *
 * Python §2 adds the empty linked list `None` and a linked-list library to Python §1 (see py-slang's
 * `docs/specs/python_2.tex` and `docs/lib/linked_list.py`). This module is the stepper's view of that
 * library. As in Source's stepper (`js-slang/src/stepper/builtins/lists.ts`), a pair is a two-element
 * `ArrayExpression` rendered `[head, tail]` and the empty list is `None`; only the surface *names*
 * differ — Python's `pair`/`head`/`tail`/`llist`/`map`/… in place of Source's
 * `pair`/`head`/`tail`/`list`/`map`/… — so a stepped Python program reads as Python while pairs and
 * lists display exactly like Source.
 *
 * The library splits into:
 *  - **primitives** (`pair`, `is_pair`, `head`, `tail`, `is_llist`, `llist`, `draw_data`),
 *    computed directly from already-reduced value arguments; and
 *  - **pre-declared** functions (`map`, `filter`, …), each modelled as a
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
  is_llist: args => {
    checkArity("is_llist", args, 1, 1);
    // A linked list is `None` or a pair whose tail is itself a linked list.
    const ok = (n: StepNode): boolean =>
      isEmptyList(n) || (isPairNode(n) && ok((n.elements as StepNode[])[1]));
    return boolLit(ok(args[0]));
  },
  llist: args => {
    // Variadic: llist(v1, …, vn) = pair(v1, pair(…, pair(vn, None))). No arity check.
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
  // length(xs)
  length: lam(["xs"], call("_length", [id("xs"), intLit(0)])),
  _length: lam(
    ["xs", "acc"],
    cond(
      isNoneOf(id("xs")),
      id("acc"),
      call("_length", [tailOf(id("xs")), bin("+", id("acc"), intLit(1))]),
    ),
  ),

  // map(f, xs)
  map: lam(["f", "xs"], call("_map", [id("f"), id("xs"), none()])),
  _map: lam(
    ["f", "xs", "acc"],
    cond(
      isNoneOf(id("xs")),
      call("reverse", [id("acc")]),
      call("_map", [
        id("f"),
        tailOf(id("xs")),
        pairOf(call(id("f"), [headOf(id("xs"))]), id("acc")),
      ]),
    ),
  ),

  // build_llist(fun, n)
  build_llist: lam(
    ["fun", "n"],
    call("_build_llist", [bin("-", id("n"), intLit(1)), id("fun"), none()]),
  ),
  _build_llist: lam(
    ["i", "fun", "already_built"],
    cond(
      bin("<", id("i"), intLit(0)),
      id("already_built"),
      call("_build_llist", [
        bin("-", id("i"), intLit(1)),
        id("fun"),
        pairOf(call(id("fun"), [id("i")]), id("already_built")),
      ]),
    ),
  ),

  // for_each(fun, xs): apply fun to each element, return True. Modelled as a `def` with a
  // block body so the side-effecting `fun(head(xs))` is shown being evaluated for each element,
  // mirroring Source's block-bodied `for_each`.
  for_each: {
    type: "FunctionDeclaration",
    id: id("for_each"),
    params: [id("fun"), id("xs")],
    body: {
      type: "BlockStatement",
      body: [
        ifElse(
          isNoneOf(id("xs")),
          [ret(boolLit(true))],
          [
            exprStmt(call(id("fun"), [headOf(id("xs"))])),
            ret(call("for_each", [id("fun"), tailOf(id("xs"))])),
          ],
        ),
      ],
    },
  },

  // llist_to_string(xs): box-and-pointer text, e.g. llist(1, 2) ⇒ "[1, [2, None]]".
  llist_to_string: lam(["xs"], call("_llist_to_string", [id("xs"), lam(["x"], id("x"))])),
  _llist_to_string: lam(
    ["xs", "cont"],
    cond(
      isNoneOf(id("xs")),
      call(id("cont"), [stringLiteral("None")]),
      cond(
        isPairOf(id("xs")),
        call("_llist_to_string", [
          headOf(id("xs")),
          lam(
            ["x_str"],
            call("_llist_to_string", [
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

  // reverse(xs)
  reverse: lam(["xs"], call("_reverse", [id("xs"), none()])),
  _reverse: lam(
    ["original", "reversed_acc"],
    cond(
      isNoneOf(id("original")),
      id("reversed_acc"),
      call("_reverse", [
        tailOf(id("original")),
        pairOf(headOf(id("original")), id("reversed_acc")),
      ]),
    ),
  ),

  // append(xs, ys)
  append: lam(["xs", "ys"], call("_append", [id("xs"), id("ys"), lam(["x"], id("x"))])),
  _append: lam(
    ["xs", "ys", "cont"],
    cond(
      isNoneOf(id("xs")),
      call(id("cont"), [id("ys")]),
      call("_append", [
        tailOf(id("xs")),
        id("ys"),
        lam(["zs"], call(id("cont"), [pairOf(headOf(id("xs")), id("zs"))])),
      ]),
    ),
  ),

  // member(v, xs): first sub-list whose head equals v, else None.
  member: lam(
    ["v", "xs"],
    cond(
      isNoneOf(id("xs")),
      none(),
      cond(
        bin("==", id("v"), headOf(id("xs"))),
        id("xs"),
        call("member", [id("v"), tailOf(id("xs"))]),
      ),
    ),
  ),

  // remove(v, xs): remove the first element equal to v.
  remove: lam(["v", "xs"], call("_remove", [id("v"), id("xs"), none()])),
  _remove: lam(
    ["v", "xs", "acc"],
    cond(
      isNoneOf(id("xs")),
      call("append", [call("reverse", [id("acc")]), id("xs")]),
      cond(
        bin("==", id("v"), headOf(id("xs"))),
        call("append", [call("reverse", [id("acc")]), tailOf(id("xs"))]),
        call("_remove", [id("v"), tailOf(id("xs")), pairOf(headOf(id("xs")), id("acc"))]),
      ),
    ),
  ),

  // remove_all(v, xs): remove every element equal to v.
  remove_all: lam(["v", "xs"], call("_remove_all", [id("v"), id("xs"), none()])),
  _remove_all: lam(
    ["v", "xs", "acc"],
    cond(
      isNoneOf(id("xs")),
      call("append", [call("reverse", [id("acc")]), id("xs")]),
      cond(
        bin("==", id("v"), headOf(id("xs"))),
        call("_remove_all", [id("v"), tailOf(id("xs")), id("acc")]),
        call("_remove_all", [id("v"), tailOf(id("xs")), pairOf(headOf(id("xs")), id("acc"))]),
      ),
    ),
  ),

  // enum_llist(start, end): the list start, start+1, …, end.
  enum_llist: lam(["start", "end"], call("_enum_llist", [id("start"), id("end"), none()])),
  _enum_llist: lam(
    ["start", "end", "acc"],
    cond(
      bin(">", id("start"), id("end")),
      call("reverse", [id("acc")]),
      call("_enum_llist", [
        bin("+", id("start"), intLit(1)),
        id("end"),
        pairOf(id("start"), id("acc")),
      ]),
    ),
  ),

  // llist_ref(xs, n): the element at index n (0-based). Out of bounds ⇒ head(None) ⇒ stuck,
  // exactly like Source's `list_ref`.
  llist_ref: lam(
    ["xs", "n"],
    cond(
      bin("==", id("n"), intLit(0)),
      headOf(id("xs")),
      call("llist_ref", [tailOf(id("xs")), bin("-", id("n"), intLit(1))]),
    ),
  ),

  // reduce(f, initial, xs): fold f over the list from the right.
  reduce: lam(
    ["f", "initial", "xs"],
    call("_reduce", [id("f"), id("initial"), id("xs"), lam(["x"], id("x"))]),
  ),
  _reduce: lam(
    ["f", "initial", "xs", "cont"],
    cond(
      isNoneOf(id("xs")),
      call(id("cont"), [id("initial")]),
      call("_reduce", [
        id("f"),
        id("initial"),
        tailOf(id("xs")),
        lam(["x"], call(id("cont"), [call(id("f"), [headOf(id("xs")), id("x")])])),
      ]),
    ),
  ),

  // filter(pred, xs): keep elements for which pred returns True.
  filter: lam(["pred", "xs"], call("_filter", [id("pred"), id("xs"), none()])),
  _filter: lam(
    ["pred", "xs", "acc"],
    cond(
      isNoneOf(id("xs")),
      call("reverse", [id("acc")]),
      cond(
        call(id("pred"), [headOf(id("xs"))]),
        call("_filter", [id("pred"), tailOf(id("xs")), pairOf(headOf(id("xs")), id("acc"))]),
        call("_filter", [id("pred"), tailOf(id("xs")), id("acc")]),
      ),
    ),
  ),
};

/**
 * Expands a pre-declared library call: substitutes the value `args` for the function template's
 * parameters and returns its body (an expression, or — for `for_each` — a block that the
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
  is_llist: 1,
  llist: 0,
  draw_data: 1,
  length: 1,
  map: 2,
  build_llist: 2,
  for_each: 2,
  llist_to_string: 1,
  reverse: 1,
  append: 2,
  member: 2,
  remove: 2,
  remove_all: 2,
  enum_llist: 2,
  llist_ref: 2,
  reduce: 3,
  filter: 2,
};
