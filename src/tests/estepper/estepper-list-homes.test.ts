/**
 * Where a host draws a list in the CSE snapshot of an e-stepper step (py-slang#605): a host draws a
 * list beside a reference to it from a binding of the frame its `metadata.envId` names, or from a
 * list of that frame; a list without such a reference is not drawn at all (a pair was missing in
 * the diagram of the issue's program). This checks that every list of every step has one.
 */
import { runEStepper } from "../../conductor/estepper/getSteps";
import { parse } from "../../parser";

interface Value {
  label: string;
  metadata?: { id?: number; envId?: string; elements?: Value[] };
}
interface Environment {
  id: string;
  bindings: { name: string; value: Value }[];
  heapObjects?: Value[];
}

const isList = (v: Value): boolean => v.label === "list" || v.label === "array";

/** The lists of a snapshot (by id) that have no reference a host would draw them by. */
function listsWithoutReference(environments: Environment[]): string[] {
  const homes = new Map<number, string>();
  /** Lists that are referenced from a binding or a list of a frame, by frame. */
  const referenced = new Map<string, Set<number>>();
  const reference = (envId: string, id: number): void => {
    if (!referenced.has(envId)) referenced.set(envId, new Set());
    referenced.get(envId)!.add(id);
  };
  const visit = (v: Value, bindingFrame: string | null, parent: Value | null): void => {
    if (!isList(v) || v.metadata?.id === undefined) return;
    const { id, envId = "" } = v.metadata;
    homes.set(id, envId);
    if (parent === null && bindingFrame !== null) reference(bindingFrame, id);
    if (parent !== null) reference(parent.metadata?.envId ?? "", id);
    for (const element of v.metadata.elements ?? []) {
      if (element.metadata?.id !== id) visit(element, null, v);
    }
  };
  for (const env of environments) {
    for (const b of env.bindings) visit(b.value, env.id, null);
    // A dead object of a frame is drawn there, beside a binding of its own.
    for (const o of env.heapObjects ?? []) {
      visit(o, env.id, null);
    }
  }
  return [...homes]
    .filter(([id, envId]) => !referenced.get(envId)?.has(id))
    .map(([id, envId]) => `list ${id} in ${envId}`);
}

const PROGRAMS: [string, string][] = [
  [
    "a function that changes the tail of the list it is given",
    `gg = lambda x: x % 2 == 0
def fun(ff, xs):
    global gg
    gg = lambda x: x % 2 == 0
    if is_none(xs):
        return xs
    elif gg(head(xs)):
        new_x = ff(head(xs))
        return pair(new_x, fun(ff, tail(xs)))
    else:
        set_tail(xs, fun(ff, tail(xs)))
        return xs
L = llist(2, 3, 4)
R = fun(lambda x: 2 * x, L)
print(R)
print(L)
`,
  ],
  [
    "map over a linked list",
    `def mp(f, xs):
    return xs if is_none(xs) else pair(f(head(xs)), mp(f, tail(xs)))
R = mp(lambda x: x + 1, llist(1, 2, 3))
print(R)
`,
  ],
  [
    "shared and nested lists",
    `a = [1, 2]
b = [a, a]
c = [b, a]
d = c[0]
print(d)
`,
  ],
  [
    "lists made in a function and nested outside it",
    `def f(xs):
    ys = [xs, [3, 4]]
    return ys[1]
z = f([1, 2])
w = [z, [z]]
print(w)
`,
  ],
  [
    "a shared tail",
    `L = llist(1, 2, 3)
M = pair(0, tail(L))
N = pair(9, tail(L))
set_tail(tail(L), None)
print(M)
print(N)
`,
  ],
];

describe("the home frame of a list in an e-stepper snapshot", () => {
  test.each(PROGRAMS)("%s", async (_, code) => {
    const run = await runEStepper(parse(code), code, 4, 100000);
    const problems = run.steps.flatMap((step, i) =>
      listsWithoutReference((step.cse?.environments ?? []) as unknown as Environment[]).map(
        p => `step ${i}: ${p}`,
      ),
    );
    expect(problems).toEqual([]);
  });
});
