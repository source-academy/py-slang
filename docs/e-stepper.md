# The environment stepper ("e-stepper")

Status: design note, draft. Tracking project: **e-stepper** (source-academy GitHub organization).

## Motivation

In CS1101S, the substitution model stops working at SICPy §3.1, where assignment and local state
appear. The course then switches to the environment model, visualized by the CSE machine. As a
mental model, the CSE machine is complete but tedious: the program disappears into a control stack
of instructions, and the stash holds intermediate values far from where they are used.

The e-stepper keeps the substitution stepper's picture of computation: the program itself is
rewritten, one subexpression or statement at a time, so the shape of a recursive or iterative
process stays visible. It adds just one thing, enough to handle state:

- **Every part of the program under evaluation has an environment** in which it looks up names.
- **Environments and data structures are drawn as in the CSE machine visualization**, and the
  program refers into that drawing: environment annotations on function bodies being evaluated, and
  references to heap objects (function objects, lists).

Calls no longer substitute arguments into bodies. A call `f(3)` creates a frame binding the
parameters and steps to the body *annotated with that frame*. Names are looked up, assignments
change frames, and lists are mutable objects that the program points to.

This is reduction semantics with environments (cf. Curien's λρ-calculus). Biernacka and Danvy showed
that such calculi correspond mechanically to environment machines like CEK. The CSE machine is
essentially this model with the program pulled apart into control and stash. So the e-stepper and
the CSE machine describe the same computations and should agree on every result.

Scope: Python §3 first, then §4. It is offered alongside the CSE machine visualization, as a separate
tool (its own side-content tab), selected like the Stepper and the CSE machine.

## Configurations

A step shows a configuration ⟨P, Σ⟩:

- **P**, the program term: the remaining program, in which
  - values are primitives (int, float, complex, bool, str, `None`), shown inline as in the stepper,
    or **references** `Ref(#k)` to heap objects,
  - a function body (or lambda body) under evaluation is wrapped as **`EnvBlock(E, body)`**: the
    body is evaluated in environment `E`.
- **Σ**, the store:
  - **frames** `E = { name ↦ value | unassigned }` with a parent frame (the parent of the global frame `G` is the builtins
    environment `B`, which has none),
  - **heap objects**:
    - function objects `Fn(name?, params, body, E)`, where E is the defining environment,
    - lists `List[v₀, …, vₙ₋₁]`. Pairs are 2-element lists, as in py-slang's CSE machine.

The **current environment** of a redex is the environment of its nearest enclosing `EnvBlock`, or `G`
outside every `EnvBlock`. This is the only place environments appear in the program: annotating
every subexpression would make the display unreadable, and subterms inherit their block's
environment.

Builtins (`print`, `pair`, `math_sqrt`, …) and the library functions written in Python (`map`, …) live
in the builtins environment `B`, the parent of `G` and the root of every chain of frames. As in the
CSE machine visualization, it is not drawn, and a builtin value is shown by its name. Names resolve
by Python's LEGB rule: local, enclosing, global, built-in (see `docs/specs/python_4_estepper.tex`).

## Initial configuration

`G` starts empty and grows: a global binding appears when its first assignment (or `def`, `for`
target, import) executes. This matches the CSE machine, which never pre-allocates module bindings
(`pyGetGlobalVariable` in `src/engines/cse/utils.ts`), and it matters for a program that shadows a
builtin later, such as `print(1); print = 0`: the first `print` must still find the builtin in `B`.
The assignment does not change `B`: as in Python, it creates a binding in `G` that shadows the
builtin from then on, so `p = print; print = 0; p(print)` prints `0`, and `print(3)` is then a
`TypeError`.
Function frames, by contrast, are created with all their locals present but unassigned (see the
call rule). P is the program's statement list, evaluated in `G`.

## Reduction rules

Evaluation order, short-circuiting (`and`, `or`, conditional expressions), `if`/`while`/`for`
unrolling, `break`/`continue`, primitive operators and builtin calls are as in the current stepper
(`src/conductor/stepper/reduce.ts`). The stepper rejects the identity operators (`src/conductor/stepper/preprocess.ts`), so
the e-stepper defines `is` and `is not` itself (see the table). The membership operators `in` and
`not in` are not part of Python §3 or §4. Only the rules involving names, functions and data change. E
always denotes the current environment of the redex.

A `while` loop unfolds by the textbook rule before its test is evaluated:
`while test: body` becomes `if test: (body; while test: body)`. The loop stays in the program, in
full, while the test is evaluated, so the program and the environment always hold all that is
needed to continue by hand.

| Redex (in E) | Contractum | Store effect |
|---|---|---|
| name `x` | the value bound to `x`, found by walking from E toward `G`, then builtins. Respects `global`/`nonlocal` (see below) | none. The first frame that has `x` decides; if `x` is unassigned there, the error is `UnboundLocalError` when that frame is E's own, and `NameError` ("cannot access free variable") when it is an enclosing function's frame, as in the CSE machine (`pyGetVariable`). No frame and no builtin: `NameError` |
| `lambda ps: e` | `Ref(#k)` | allocate `#k = Fn(ε, ps, e, E)` |
| `def f(ps): body` (statement) | statement removed | allocate `#k = Fn(f, ps, body, E)`; bind `f ↦ Ref(#k)` in the frame `f` belongs to |
| `Ref(#k)(v₁, …, vₙ)` with `#k = Fn(_, ps, body, E')` | `EnvBlock(E'', body)` | new frame `E''`, parent `E'`, binding `psᵢ ↦ vᵢ` (rest parameters: a new list), plus every name the body assigns, unassigned |
| `EnvBlock(E'', return v; …)` | `v` | none (the frame stays in Σ) |
| `EnvBlock(E'', return Ref(#k)(v₁, …, vₙ); …)` (a tail call; also a lambda body that is such a call, and a `return` inside a loop) | `EnvBlock(E₃, body)`, replacing the caller's block | as for a function application; `E''` is left in Σ, garbage unless referenced |
| `EnvBlock(E'', ε)` (body finished) | `None` | none |
| `EnvBlock(E'', v)` (lambda body reduced to a value) | `v` | none |
| `x = v` (statement) | statement removed | rebind `x` in its frame (see scoping) |
| `[v₁, …, vₙ]` | `Ref(#k)` | allocate `#k = List[v₁, …, vₙ]` |
| `Ref(#k)[i]` | element `i` of `#k` | none. Bad index or type: `IndexError`/`TypeError` as in CSE |
| `Ref(#k)[i] = v` (statement) | statement removed | `#k[i] := v` |
| `pair(a, b)`, `llist(…)`, `stream(…)` | `Ref(#k)` (outermost cell) | allocate the cells |
| `set_head(Ref(#k), v)`, `set_tail(…)` | `None` | `#k[0] := v` / `#k[1] := v` |
| `v is w`, `v is not w` | `True` iff same primitive value or same reference (negated for `is not`), as in the CSE machine (`pyIdentical`) | none |

A statement sequence inside an `EnvBlock` reduces statement by statement, exactly like the current
stepper's block expression for a multi-statement `def`. When a statement is consumed, it disappears.

**Scoping**: the frame a name `x` belongs to (for both lookup and assignment) is decided statically,
by Python's rule, as the CSE machine and the current stepper already do (py-slang#447):

- if the function declares `global x`, it is `G`,
- if it declares `nonlocal x`, it is the nearest enclosing function frame that binds `x`,
- otherwise, if the function assigns `x` anywhere (or it is a parameter), it is the function's own
  frame,
- otherwise, lookup walks the parent chain.

**Builtin calls** reuse the stepper's `applyBuiltin`, except that list-producing and list-consuming
builtins operate on heap objects instead of list literal nodes.

## Display conventions

- **Environment blocks**: an `EnvBlock` renders as its body, surrounded by a thin coloured bracket
  carrying the frame's label (`E3`). The frame in the environment diagram carries the same label and
  colour. Nested blocks show the call stack as nesting; the innermost block is the active frame,
  highlighted in the diagram.
- **References**: in the first version, a reference is a small labelled badge in the program (`#7`).
  The heap object in the diagram carries the same badge. A reference to a function object is its
  badge too, not the name it was defined with: after `W1 = make_withdraw(100)` the name `withdraw`
  says nothing about what `W1` holds, and two calls give two objects of the same name. The name and
  parameters are in the badge's tooltip. Arrows from the program into the diagram, under the host's
  "Filter Arrows" menu as "From program", start at the badge.
- **Lookups are explicit**: every name in the program is replaced by its value in a step of its own
  ("Looked up balance in frame E1: 100"), left to right, and the diagram highlights the binding that
  was read. Only names of builtins and library functions, which no drawn frame binds, are looked up
  as part of the step that uses them.
- **Garbage**: frames and objects no longer reachable from P (through `EnvBlock`s and `Ref`s) or `G`
  are greyed out, not removed. This makes the result of a returning call visible: its frame stays
  alive if a returned function object still points to it, and becomes garbage otherwise.
- **Frame layout and heap drawing** follow the CSE machine visualization: frames as labelled boxes
  with bindings and a parent arrow, function objects as double circles pointing to their environment,
  lists as box-and-pointer diagrams.

## Worked example: `make_withdraw` (SICPy 3.1.1)

```python
def make_withdraw(balance):
    def withdraw(amount):
        nonlocal balance
        if balance >= amount:
            balance = balance - amount
            return balance
        else:
            return 'Insufficient funds'
    return withdraw

W1 = make_withdraw(100)
W1(50)
```

Initially, `G` is empty.

1. The `def make_withdraw` statement is consumed: `#1 = Fn(make_withdraw, [balance], …, G)`, and
   `G` gains the binding `make_withdraw ↦ #1`.
2. `W1 = make_withdraw(100)`: `make_withdraw` is looked up in G (`#1`), then the call is a step.
   New frame `E1 = { balance: 100, withdraw: unassigned }`, parent G. The program becomes
   `W1 = EnvBlock(E1, def withdraw…; return withdraw)`.
3. Inside E1, `def withdraw` is consumed: `#2 = Fn(withdraw, [amount], …, E1)`, `withdraw ↦ #2` in E1.
4. `return withdraw` looks up `withdraw` in E1 and returns: `W1 = #2` (`Ref(#2)`, shown as the badge
   `#2`).
5. `W1 = Ref(#2)` is consumed: `G` gains `W1 ↦ #2`. E1 stays alive, since #2 points to it.
6. `W1(50)`: new frame `E2 = { amount: 50 }`, parent **E1** (the defining environment of #2, not the
   caller's). The program becomes `EnvBlock(E2, nonlocal balance; if balance >= amount: …)`. E2
   has no binding for `balance`: `nonlocal balance` decided that when `withdraw` was defined. The
   declaration stays in the program as source, but is not evaluated (no step of its own), here or
   anywhere: `global` and `nonlocal` are declarations, not statements that run. A declaration holds
   for the whole function body, wherever it stands (in an `if` or a loop, say), so at each call all
   of them are taken out of the body and put, each once, at its front; they stay in view for as
   long as the body is, whichever branch is taken.
7. `balance >= amount` evaluates in E2: `balance` is looked up and found in E1 (100), then `amount`
   in E2 (50), each in a step of its own; `100 >= 50` gives `True`; the `if` takes its first branch.
8. `balance = balance - amount`: the right-hand side reduces to `50`. Because of `nonlocal balance`,
   the assignment rebinds `balance` **in E1**: this is the step the substitution model cannot
   express.
9. `return balance` gives `50`; the `EnvBlock` disappears. E2 becomes garbage; E1 does not.

A second call `W1(50)` would create `E3` with parent E1 and find `balance` = 50 there. That is the
point of §3.1, now visible on one screen.

## Architecture

| Repo | Work |
|---|---|
| plugins | `common-e-stepper` (protocol), `runner-e-stepper` (runner base class), `web-e-stepper` (a self-contained host plugin that renders its own tab: the program pane reuses the stepper's profile-driven renderer, and the environment pane draws frames and heap with Konva) |
| plugin-directory | register `e-stepper` so `hostLoadPlugin("e-stepper")` resolves to the web bundle |
| py-slang | the e-stepper engine (`src/conductor/estepper/`), `PyEStepperEvaluator3`/`4`, a `--engine estepper` CLI text mode, tests |
| language-directory | `EvaluatorCapability.E_STEPPER`, evaluators `python3EStepper`/`python4EStepper` |
| frontend | treat the `e-stepper` capability as a tool evaluator (hidden from the dropdown, selected by its tab) |

The engine is separate from both the substitution stepper (`src/conductor/stepper/`) and the CSE
machine (`src/engines/cse/`). It reuses the stepper's `translate.ts`, `syntaxProfile.ts` (extended),
builtins and module interop, and its step-driver shape.

The web plugin is self-contained, like the Stepper and the Data Visualizer, rather than abstract like
the CSE machine plugin: the frontend's CSE `Layout` is tied to js-slang's types and to control and
stash, and a self-contained plugin keeps the frontend language-agnostic.

### Protocol (`@sourceacademy/common-e-stepper`)

Extends the stepper protocol (`@sourceacademy/common-stepper`) and reuses the CSE machine's frame
types (`@sourceacademy/common-cse-machine`), so frames look the same in both tools:

```ts
export const E_STEPPER_CHANNEL_ID = "__e_stepper";
export const RUNNER_ID = "__runner_e_stepper";
export const WEB_ID = "__web_e_stepper";
export const E_STEPPER_DIRECTORY_ID = "e-stepper";

/** A heap object the program or a frame refers to. */
export type HeapObject =
  | { kind: "function"; id: string; name?: string; params: string[]; envId: string; source: string }
  | { kind: "list"; id: string; elements: EStepperValue[] };

/** A value in a frame binding or a list element. */
export type EStepperValue =
  | { kind: "primitive"; display: string; label: string }
  | { kind: "ref"; id: string }
  | { kind: "builtin"; name: string }
  | { kind: "unassigned" };

export interface EStepperFrame {
  id: string;                 // e.g. "E3", stable for the run
  name: string;               // "global", or the function name
  parentId: string | null;
  bindings: { name: string; value: EStepperValue }[];
  isActive: boolean;          // frame of the current redex
  isGarbage: boolean;
}

export interface EStepperStep extends SerializedStepperStep {
  // `ast` may contain the node types EnvBlock { envId, body } and Ref { objectId }
  frames: EStepperFrame[];
  heap: HeapObject[];
  /** Bindings read by this step's lookup, for highlighting. */
  lookups?: { frameId: string; name: string }[];
}
```

The `SyntaxProfile` gains two template parts: `{ envBlock: "body", envProp: "envId" }` renders a
bracketed, labelled block, and `{ ref: "objectId" }` renders a reference badge.

Whether frames reuse `CseSerializedEnvFrame` directly or the simpler `EStepperFrame` above is decided
in the protocol issue. Reuse is better if the CSE machine's frame drawing could ever be shared;
otherwise the simpler shape wins.

## Testing

- Unit tests per reduction rule, on small programs.
- **Differential tests against the CSE machine**: the e-stepper's final output (and error kind) must
  equal the CSE machine's for every program in the existing §3/§4 test corpus.
- Golden step sequences (via the CLI text mode) for the teaching examples: `make_withdraw`, the
  counter, the bank account, mutable lists with `set_head`/`set_tail`, and a stream.

## Plan

1. This design note.
2. plugins: `common-e-stepper` and `runner-e-stepper`, published.
3. py-slang: the engine for §3, CLI text mode, tests.
4. plugins: `web-e-stepper`; plugin-directory registration.
5. language-directory, then frontend (reviewed version bumps).
6. §4 (`parse`, `tokenize`, `apply_in_underlying_python`).
7. Polish: arrows from the program into the diagram, collapsing finished frames.

Steps 2–4 are the critical path to a first classroom-usable version. The course is already in
chapter 3, so this is run as a live experiment: release early, observe, adjust.

## Open questions

- How big do programs get before the program pane or the diagram becomes unreadable? Collapsing
  finished `EnvBlock`s (and old frames) is likely needed early.
- `while` and `for` loops in a frame-based world: does unrolling still read well when the loop body
  assigns to the frame instead of substituting?
- Do students need to see the builtins frame at all? (Proposed: no.)
- Step limit: reuse the frontend's Step Limit control, as the stepper and CSE machine do.
