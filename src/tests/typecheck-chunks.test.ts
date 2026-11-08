import { TypedPythonChecker, type TypeDiagnostic } from "../typecheck";
import { CHECKER_SETUP_TIMEOUT_MS, startTypedChecker } from "./typecheck-harness";

// The checker runs in a worker thread: when many test files compete for the processor, a check takes
// much longer than the 5 seconds that a test has by default.
jest.setTimeout(60_000);

const errors = (diagnostics: TypeDiagnostic[]) => diagnostics.filter(d => d.severity === "error");

describe("the chunks of a REPL session", () => {
  let session: TypedPythonChecker;
  beforeEach(async () => {
    session = await startTypedChecker();
  }, CHECKER_SETUP_TIMEOUT_MS);
  afterEach(() => session.dispose());

  test("a chunk uses the names, and the types, of the chunks before it", async () => {
    expect(await session.checkChunk("def sq(x: int) -> int:\n    return x * x\n")).toEqual([]);
    expect(errors(await session.checkChunk("print(sq(3))\n"))).toEqual([]);
    const [error] = errors(await session.checkChunk('print(sq("a"))\n'));
    expect(error).toMatchObject({ line: 1, message: "sq expects x to be int, but got str" });
  });

  test("the line of an error is the line in the chunk, not in the file that the checker made", async () => {
    await session.checkChunk("a = 1\n");
    await session.checkChunk("def f() -> int:\n    return 1\n");
    const [error] = errors(await session.checkChunk("print(1)\nprint(2)\nx: int = 'a'\n"));
    expect(error.line).toBe(3);
  });

  test("a chunk with an error is not part of the session", async () => {
    expect(
      errors(await session.checkChunk("def f(x: int) -> int:\n    return x + 'a'\n")),
    ).toHaveLength(1);
    // `f` was not accepted, so it is not defined.
    const [error] = errors(await session.checkChunk("print(f(1))\n"));
    expect(error.message).toMatch(/"f" is not defined/);
  });

  test("a name that starts with an underscore is a name like any other", async () => {
    await session.checkChunk("_cache: list[int] = [0] * 10\n");
    expect(errors(await session.checkChunk("print(_cache[0])\n"))).toEqual([]);
  });

  test("a name that a later chunk defines again has the type of the last chunk", async () => {
    await session.checkChunk("x = 1\n");
    await session.checkChunk("x = 'a'\n");
    expect(errors(await session.checkChunk("print(x + 'b')\n"))).toEqual([]);
    expect(errors(await session.checkChunk("print(x + 1)\n"))).toHaveLength(1);
  });

  test("a function can be defined again with other types", async () => {
    await session.checkChunk("def f(x: int) -> int:\n    return x\n");
    await session.checkChunk("def f(x: str) -> str:\n    return x\n");
    expect(errors(await session.checkChunk("print(f('a'))\n"))).toEqual([]);
    expect(errors(await session.checkChunk("print(f(1))\n"))).toHaveLength(1);
  });

  test("a variable can be updated from its earlier value", async () => {
    await session.checkChunk("count: int = 0\n");
    expect(errors(await session.checkChunk("count = count + 1\n"))).toEqual([]);
    expect(errors(await session.checkChunk("print(count)\n"))).toEqual([]);
  });

  test("a declared type carries over: another type cannot be assigned in a later chunk", async () => {
    await session.checkChunk("count: int = 0\n");
    const diagnostics = errors(await session.checkChunk('count = "many"\n'));
    expect(diagnostics.map(d => d.message)).toEqual([
      'Type "str" is not assignable to declared type "int"',
    ]);
  });

  test("a name can be declared again, with another type, in a later chunk", async () => {
    await session.checkChunk("x: int = 1\n");
    expect(errors(await session.checkChunk('x: str = "a"\n'))).toEqual([]);
    expect(errors(await session.checkChunk('print(x + "b")\n'))).toEqual([]);
    expect(errors(await session.checkChunk("x = 1\n"))).toHaveLength(1);
  });

  test("a declared type with a type alias in it carries over", async () => {
    await session.checkChunk("type Rational = Pair[int, int]\n");
    await session.checkChunk("half: Rational = pair(1, 2)\n");
    expect(errors(await session.checkChunk("half = pair(1, 2)\n"))).toEqual([]);
    expect(errors(await session.checkChunk('half = pair("a", 2)\n'))).toHaveLength(1);
  });

  test("a function that replaces a variable that was declared with a type", async () => {
    await session.checkChunk("x: int = 0\n");
    await session.checkChunk("def x() -> str:\n    return 'a'\n");
    expect(errors(await session.checkChunk("print(x() + 'b')\n"))).toEqual([]);
    expect(errors(await session.checkChunk("print(x() + 1)\n"))).toHaveLength(1);
  });

  test("a type alias, and the names of a for loop and of a global declaration", async () => {
    await session.checkChunk("type Rational = Pair[int, int]\n");
    await session.checkChunk("for i in range(3):\n    j: int = i\n");
    await session.checkChunk("def set_counter() -> None:\n    global counter\n    counter = 1\n");
    const diagnostics = await session.checkChunk(
      "def make(n: int, d: int) -> Rational:\n    return pair(n, d)\nprint(i)\nprint(j)\nprint(counter)\n",
    );
    expect(errors(diagnostics)).toEqual([]);
  });

  test("a chunk that is not a program is not accepted, and the session goes on", async () => {
    expect(errors(await session.checkChunk("def f(:\n"))).not.toHaveLength(0);
    expect(errors(await session.checkChunk("y = 1\n"))).toEqual([]);
    expect(errors(await session.checkChunk("print(y)\n"))).toEqual([]);
  });

  test("a program that is checked on its own does not see the session", async () => {
    await session.checkChunk("z = 1\n");
    expect(errors(await session.check("print(z)\n"))).toHaveLength(1);
  });
});
