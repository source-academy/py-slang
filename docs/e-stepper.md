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
  - **frames** `E = { name ↦ value | unassigned }` with a parent frame (the global frame `G` has
    none),
  - **heap objects**:
    - function objects `Fn(name?, params, body, E)`, where E is the defining environment,
    - lists `List[v₀, …, vₙ₋₁]`. Pairs are 2-element lists, as in py-slang's CSE machine.

The **current environment** of a redex is the environment of its nearest enclosing `EnvBlock`, or `G`
outside every `EnvBlock`. This is the only place environments appear in the program: annotating
every subexpression would make the display unreadable, and subterms inherit their block's
environment.

Builtins (`print`, `pair`, `math_sqrt`, …) live in an implicit builtins frame above `G`. As in the
CSE machine visualization, it is not drawn, and a builtin value is shown by its name.

## Initial configuration

`G` starts empty and grows: a global binding appears when its first assignment (or `def`, `for`
target, import) executes. This matches the CSE machine, which never pre-allocates module bindings
(`pyGetGlobalVariable` in `src/engines/cse/utils.ts`), and it matters for a program that shadows a
builtin later, such as `print(1); print = 0`: the first `print` must still find the builtin.
Function frames, by contrast, are created with all their locals present but unassigned (see the
call rule). P is the program's statement list, evaluated in `G`.

## Reduction rules

Evaluation order, short-circuiting (`and`, `or`, conditional expressions), `if`/`while`/`for`
unrolling, `break`/`continue`, primitive operators and builtin calls are as in the current stepper
(`src/conductor/stepper/reduce.ts`). The stepper rejects the identity operators (`src/conductor/stepper/preprocess.ts`), so
the e-stepper defines `is` and `is not` itself (see the table). The membership operators `in` and
`not in` are not part of Python §3 or §4. Only the rules involving names, functions and data change. E
always denotes the current environment of the redex.

| Redex (in E) | Contractum | Store effect |
|---|---|---|
| name `x` | the value bound to `x`, found by walking from E toward `G`, then builtins. Respects `global`/`nonlocal` (see below) | none. The first frame that has `x` decides; if `x` is unassigned there, the error is `UnboundLocalError` when that frame is E's own, and `NameError` ("cannot access free variable") when it is an enclosing function's frame, as in the CSE machine (`pyGetVariable`). No frame and no builtin: `NameError` |
| `lambda ps: e` | `Ref(#k)` | allocate `#k = Fn(ε, ps, e, E)` |
| `def f(ps): body` (statement) | statement removed | allocate `#k = Fn(f, ps, body, E)`; bind `f ↦ Ref(#k)` in the frame `f` belongs to |
| `Ref(#k)(v₁, …, vₙ)` with `#k = Fn(_, ps, body, E')` | `EnvBlock(E'', body)` | new frame `E''`, parent `E'`, binding `psᵢ ↦ vᵢ` (rest parameters: a new list), plus every name the body assigns, unassigned |
| `EnvBlock(E'', return v; …)` | `v` | none (the frame stays in Σ) |
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
  The heap object in the diagram carries the same badge. Exception: a reference to a *named* function
  object renders as the function's name in bold, with a hover popover showing its definition and
  environment, like the stepper's mu-terms. Arrows from the program into the diagram come later.
- **Lookups are implicit by default**: a name is replaced by its value as part of the step that
  consumes it. The step's explanation records the lookups ("`balance` in E2 is 100"), and the diagram
  briefly highlights the binding that was read. A toggle makes each lookup a step of its own.
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
2. `W1 = make_withdraw(100)`: lookup of `make_withdraw` (implicit) and the call happen in one step.
   New frame `E1 = { balance: 100, withdraw: unassigned }`, parent G. The program becomes
   `W1 = EnvBlock(E1, def withdraw…; return withdraw)`.
3. Inside E1, `def withdraw` is consumed: `#2 = Fn(withdraw, [amount], …, E1)`, `withdraw ↦ #2` in E1.
4. `return withdraw` looks up `withdraw` in E1 and returns: `W1 = withdraw` (`Ref(#2)`, shown in bold
   as `withdraw`).
5. `W1 = Ref(#2)` is consumed: `G` gains `W1 ↦ #2`. E1 stays alive, since #2 points to it.
6. `W1(50)`: new frame `E2 = { amount: 50 }`, parent **E1** (the defining environment of #2, not the
   caller's). The program becomes `EnvBlock(E2, if balance >= amount: …)`.
7. `balance >= amount` evaluates in E2: `balance` is found in E1 (100), `amount` in E2 (50), giving
   `True`; the `if` takes its first branch.
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

Extends the stepper protocol (`@sourceacademy/common-stepper`).

The protocol lives in the plugins repo (source-academy/plugins#124), which is its source of truth.
In summary:

- ids: channel `__e_stepper`, runner `__runner_e_stepper`, web `__web_e_stepper`, directory
  `e-stepper`;
- `EStepperStep` is a stepper step (`SerializedStepperStep`) plus `frames`, `heap`,
  `activeFrameId` (the frame of the current redex) and `lookups` (bindings the step reads);
- frames (`EStepperFrame`: id/label, name, parent, bindings, `isGarbage`) have their own shape
  rather than reusing the CSE machine's `CseSerializedEnvFrame`, since the web plugin draws its own
  diagram and shares no drawing code with the CSE machine;
- heap objects are function objects (name, parameters, defining frame, source) and lists; a value
  is a primitive, a reference, a builtin (by name) or unassigned;
- the program refers into the store through the node types `EnvBlock { envId, body }` and
  `Ref { objectId }`. The host renders these itself, since their meaning is fixed and
  language-independent; a language's `SyntaxProfile` only covers its ordinary nodes.

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
7. Polish: arrows from the program into the diagram, the lookup toggle, collapsing finished frames.

Steps 2–4 are the critical path to a first classroom-usable version. The course is already in
chapter 3, so this is run as a live experiment: release early, observe, adjust.

## Open questions

- How big do programs get before the program pane or the diagram becomes unreadable? Collapsing
  finished `EnvBlock`s (and old frames) is likely needed early.
- `while` and `for` loops in a frame-based world: does unrolling still read well when the loop body
  assigns to the frame instead of substituting?
- Do students need to see the builtins frame at all? (Proposed: no.)
- Step limit: reuse the frontend's Step Limit control, as the stepper and CSE machine do.
