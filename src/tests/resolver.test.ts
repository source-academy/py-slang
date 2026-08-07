import { ResolverErrors } from "../resolver/errors";
import { FeatureNotSupportedError } from "../validator";
import { toPythonAstAndResolve } from "./utils";

describe("Resolver Tests", () => {
  describe("Variable Resolution", () => {
    test("Unbound name should throw error", () => {
      const code = "print(x)";
      expect(() => toPythonAstAndResolve(code, 1)).toThrow(ResolverErrors.NameNotFoundError);
    });

    test("Unbound name in function should throw error", () => {
      const code = `
def foo():
    print(y)
foo()
            `;
      expect(() => toPythonAstAndResolve(code, 1)).toThrow(ResolverErrors.NameNotFoundError);
    });
    test("Unbound name in nested function should throw error", () => {
      const code = `
def foo():
    def bar():
        z = 3
    print(z)
foo()
    `;
      expect(() => toPythonAstAndResolve(code, 1)).toThrow(ResolverErrors.NameNotFoundError);
    });

    test("Variable in outer scope should resolve", () => {
      const code = `
x = 10
def foo():
    print(x)
foo()
            `;
      expect(toPythonAstAndResolve(code, 1)).toMatchObject({});
    });
  });

  describe("Variant Specific Syntax", () => {
    test("For loops throw errors for Python 1 and 2", () => {
      const code = `
for i in range(5):
    print(i)
                `;
      expect(() => toPythonAstAndResolve(code, 1)).toThrow();
      expect(() => toPythonAstAndResolve(code, 2)).toThrow();
      expect(toPythonAstAndResolve(code, 3)).toMatchObject({});
    });

    test("While loops throw errors for Python 1 and 2", () => {
      const code = `
i = 0
while i < 5:
    print(i)
            `;
      expect(() => toPythonAstAndResolve(code, 1)).toThrow(FeatureNotSupportedError);
      expect(() => toPythonAstAndResolve(code, 2)).toThrow(FeatureNotSupportedError);
      expect(toPythonAstAndResolve(code, 3)).toMatchObject({});
    });

    test("Break and continue throw errors for Python 1 and 2", () => {
      const code = `
break
`;
      const code2 = `
continue     
`;
      expect(() => toPythonAstAndResolve(code, 1)).toThrow(FeatureNotSupportedError);
      expect(() => toPythonAstAndResolve(code, 2)).toThrow(FeatureNotSupportedError);
      expect(() => toPythonAstAndResolve(code, 3)).toThrow(Error);
      expect(() => toPythonAstAndResolve(code2, 1)).toThrow(FeatureNotSupportedError);
      expect(() => toPythonAstAndResolve(code2, 2)).toThrow(FeatureNotSupportedError);
      expect(() => toPythonAstAndResolve(code2, 3)).toThrow(Error);
    });

    test("Annotated assignments throw errors for Python 1, 2, 3, 4", () => {
      const code = `
x: _int = 5
            `;
      expect(() => toPythonAstAndResolve(code, 1)).toThrow(Error);
      expect(() => toPythonAstAndResolve(code, 2)).toThrow(Error);
      expect(() => toPythonAstAndResolve(code, 3)).toThrow(Error);
      expect(() => toPythonAstAndResolve(code, 4)).toThrow(Error);
    });

    test("Augmented assignments throw errors for Python 1,2,3,4", () => {
      const code = `
x = 5
x += 2
x *= 2
x /= 2
x -= 2
x |= 2
x &= 2
x ^= 2
x @= 2
            `;
      expect(() => toPythonAstAndResolve(code, 1)).toThrow(Error);
      expect(() => toPythonAstAndResolve(code, 2)).toThrow(Error);
      expect(() => toPythonAstAndResolve(code, 3)).toThrow(Error);
      expect(() => toPythonAstAndResolve(code, 4)).toThrow(Error);
    });

    test("Forbidden operators throw errors for Python 1,2,3,4", () => {
      const code = `
x = 5
x ^ 2
x | 2
x & 2
x @ 2
`;
      expect(() => toPythonAstAndResolve(code, 1)).toThrow(Error);
      expect(() => toPythonAstAndResolve(code, 2)).toThrow(Error);
      expect(() => toPythonAstAndResolve(code, 3)).toThrow(Error);
      expect(() => toPythonAstAndResolve(code, 4)).toThrow(Error);
    });

    test("Lists throw errors for Python 1 and 2", () => {
      const code = `
x = [1, 2, 3]
            `;
      expect(() => toPythonAstAndResolve(code, 1)).toThrow(FeatureNotSupportedError);
      expect(() => toPythonAstAndResolve(code, 2)).toThrow(FeatureNotSupportedError);
      expect(toPythonAstAndResolve(code, 3)).toMatchObject({});
    });

    test("List access throw errors for Python 1 and 2", () => {
      const code = `
x = [1, 2, 3]
print(x[0])
            `;
      expect(() => toPythonAstAndResolve(code, 1)).toThrow(FeatureNotSupportedError);
      expect(() => toPythonAstAndResolve(code, 2)).toThrow(FeatureNotSupportedError);
      expect(toPythonAstAndResolve(code, 3)).toMatchObject({});
    });

    test("List assignment throw errors for Python 1 and 2", () => {
      const code = `
x = [1, 2, 3]
x[0] = 10
            `;
      expect(() => toPythonAstAndResolve(code, 1)).toThrow(FeatureNotSupportedError);
      expect(() => toPythonAstAndResolve(code, 2)).toThrow(FeatureNotSupportedError);
      expect(toPythonAstAndResolve(code, 3)).toMatchObject({});
    });
    test("Variadic arguments throw errors for Python 1 and 2", () => {
      const code = `
def foo(*args):
    print(args)
foo(1, 2, 3)
                `;
      expect(() => toPythonAstAndResolve(code, 1)).toThrow(FeatureNotSupportedError);
      expect(() => toPythonAstAndResolve(code, 2)).toThrow(FeatureNotSupportedError);
      expect(toPythonAstAndResolve(code, 3)).toMatchObject({});
    });

    test("Variadic arguments with lambdas throw errors for Python 1 and 2", () => {
      const code = `
foo = lambda *args: args
print(foo(1, 2, 3))
                `;
      expect(() => toPythonAstAndResolve(code, 1)).toThrow(FeatureNotSupportedError);
      expect(() => toPythonAstAndResolve(code, 2)).toThrow(FeatureNotSupportedError);
      expect(toPythonAstAndResolve(code, 3)).toMatchObject({});
    });
  });
  describe("Break and Continue Syntax Errors", () => {
    test("Break outside of loop should throw syntax error", () => {
      const code = `
break
            `;
      expect(() => toPythonAstAndResolve(code, 3)).toThrow(Error);
    });

    test("Continue outside of loop should throw syntax error", () => {
      const code = `
continue
            `;
      expect(() => toPythonAstAndResolve(code, 3)).toThrow(Error);
    });

    test("Break and continue outside a loop have distinct messages, matching CPython's wording", () => {
      try {
        toPythonAstAndResolve("\nbreak\n", 3);
        throw new Error("did not throw");
      } catch (e: any) {
        expect(e.message).toContain("'break' outside loop");
      }
      try {
        toPythonAstAndResolve("\ncontinue\n", 3);
        throw new Error("did not throw");
      } catch (e: any) {
        expect(e.message).toContain("'continue' not properly in loop");
      }
    });
  });

  // A binding construct may appear anywhere in its owning scope's body — nested inside
  // `if`/`while`/`for`, or after a nested `def` that reads it — and real Python only fails
  // at runtime (UnboundLocalError/NameError) for such forward references, never statically.
  describe("Forward references to names bound later in the same scope", () => {
    test("same-function forward reference: name used before an if-nested assignment", () => {
      const code = `
def f():
    print(x)
    if True:
        x = 5
f()
`;
      expect(() => toPythonAstAndResolve(code, 3)).not.toThrow();
    });

    test("module level: nested function implicitly closes over a module global assigned later, inside an if", () => {
      const code = `
def g():
    print(y)
if True:
    y = 5
g()
`;
      expect(() => toPythonAstAndResolve(code, 3)).not.toThrow();
    });

    test("nonlocal: reading the variable before its for-loop-target binding executes, called before the loop runs", () => {
      const code = `
def outer():
    def inner():
        nonlocal i
        print(i)
        i = 5
    inner()
    for i in range(3):
        pass
    return i
print(outer())
`;
      expect(() => toPythonAstAndResolve(code, 3)).not.toThrow();
    });

    test("nonlocal: same as above, but the for-loop appears before the call (still after the def)", () => {
      const code = `
def outer():
    def inner():
        nonlocal i
        print(i)
        i = 5
    for i in range(3):
        pass
    inner()
    return i
print(outer())
`;
      expect(() => toPythonAstAndResolve(code, 3)).not.toThrow();
    });
  });

  describe("NameReassignmentError wording (#211)", () => {
    test("describes the reassignment site as 'reassigned', not 'declared', and has no second message pointing at the original declaration", () => {
      const code = "x = 1\nx = 2";
      try {
        toPythonAstAndResolve(code, 1);
        throw new Error("did not throw");
      } catch (e: any) {
        expect(e).toBeInstanceOf(ResolverErrors.NameReassignmentError);
        expect(e.message).toContain("A name has been reassigned here.");
        expect(e.message).not.toContain("A name has been declared here.");
        expect(e.message).not.toContain("already been declared");
      }
    });
  });

  describe("redefining an imported name is a reassignment (py-slang#413)", () => {
    // Chapters 1-2 are deliberately single-assignment so that substitution alone is a complete
    // explanation of what a program does (see ast.ts's substitute doc comment) — a `def red`
    // silently shadowing an earlier `from rune import red` would break exactly that guarantee, the
    // same as reassigning any other name would. Before this fix, `from rune import red` was invisible
    // to createNoReassignmentValidator (it only checked Assign/AnnAssign/FunctionDef targets), so this
    // sailed through preprocessing and only surfaced, confusingly, as a conductor-level crash once the
    // substitution stepper actually tried to call the (never-actually-shadowed) imported red.
    const code = "from rune import (red, heart)\ndef red(x): return x\nprint(red(4))";

    test("a def redeclaring an imported name is rejected under chapter 1", () => {
      expect(() => toPythonAstAndResolve(code, 1)).toThrow(ResolverErrors.NameReassignmentError);
    });

    test("a def redeclaring an imported name is rejected under chapter 2", () => {
      expect(() => toPythonAstAndResolve(code, 2)).toThrow(ResolverErrors.NameReassignmentError);
    });

    test("chapter 3+ allows it, same as any other reassignment there", () => {
      expect(toPythonAstAndResolve(code, 3)).toMatchObject({});
      expect(toPythonAstAndResolve(code, 4)).toMatchObject({});
    });

    test("two modules declaring the same name is a reassignment too, rejected under chapters 1-2", () => {
      // Same reasoning as a def shadowing an import: two modules both binding `red` is just as much a
      // reassignment as `def red` after `from rune import red` is — chapters 1-2 reject it uniformly,
      // regardless of which two statements (import/import, import/def, def/def, ...) are colliding.
      const twoImports = "from rune import red\nfrom sound import red";
      expect(() => toPythonAstAndResolve(twoImports, 1)).toThrow(
        ResolverErrors.NameReassignmentError,
      );
      expect(() => toPythonAstAndResolve(twoImports, 2)).toThrow(
        ResolverErrors.NameReassignmentError,
      );
    });

    test("chapter 3+ allows two modules declaring the same name too, same as any other reassignment", () => {
      // `moduleInterop.ts`'s `resolveImports` supports "last import wins" for two imports of the same
      // name (see `src/tests/py2js-from-import.test.ts`'s "two imports binding the same name resolve
      // in source order, last one wins") — legal only where reassignment in general is legal.
      const twoImports = "from rune import red\nfrom sound import red";
      expect(toPythonAstAndResolve(twoImports, 3)).toMatchObject({});
      expect(toPythonAstAndResolve(twoImports, 4)).toMatchObject({});
    });
  });
});
