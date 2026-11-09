/**
 * A program of Python §4 Typed that imports a module: checked against the module's description, then
 * (with the types erased) run with the module that the loader provides. The module is a fake `rune`
 * (as in py2js-from-import.test.ts) with the names that the description has.
 */
import { DataType, type TypedValue } from "@sourceacademy/conductor/types";
import { ModuleLoaderRunnerPlugin } from "@sourceacademy/runner-module-loader";
import { StmtNS } from "../ast-types";
import { parse } from "../parser/parser-adapter";
import { GenericDataHandler } from "../conductor/GenericDataHandler";
import { typedBeforeValidation } from "../conductor/typed";
import { Py2JsSession } from "../engines/py2js";
import { eraseTypes, StaticTypeErrors, type TypedPythonChecker } from "../typecheck";
import { CHECKER_SETUP_TIMEOUT_MS, startTypedChecker } from "./typecheck-harness";

jest.setTimeout(60_000);

let checker: TypedPythonChecker;
beforeAll(async () => {
  checker = await startTypedChecker();
}, CHECKER_SETUP_TIMEOUT_MS);
afterAll(() => checker.dispose());
afterEach(() => {
  ModuleLoaderRunnerPlugin.instance = null;
});

/** `rune` with `heart` and `scale(ratio, rune)`, which gives a rune that remembers its scale. */
async function setUp() {
  const dh = new GenericDataHandler(4);
  const heart = await dh.opaque_make({ scale: 1 });
  async function* scaleFunc(
    ratio: TypedValue<DataType>,
    rune: TypedValue<DataType>,
  ): AsyncGenerator<void, TypedValue<DataType>, undefined> {
    await Promise.resolve();
    const inner = await dh.opaque_get(rune as TypedValue<DataType.OPAQUE>);
    return dh.opaque_make({
      scale: (inner as { scale: number }).scale * (ratio as TypedValue<DataType.NUMBER>).value,
    });
  }
  const scale = await dh.closure_make(
    { returnType: DataType.OPAQUE, args: [DataType.NUMBER, DataType.OPAQUE] },
    scaleFunc,
  );
  ModuleLoaderRunnerPlugin.instance = {
    requestModule: (name: string) =>
      name === "rune"
        ? Promise.resolve({
            exports: [
              { symbol: "heart", value: heart },
              { symbol: "scale", value: scale },
            ],
          })
        : Promise.reject(new Error(`no such module: ${name}`)),
  } as unknown as ModuleLoaderRunnerPlugin;
  const outputs: string[] = [];
  const session = new Py2JsSession(4, {
    onOutput: line => outputs.push(line),
    dataHandler: dh,
    beforeValidation: typedBeforeValidation(checker),
  });
  return { session, outputs };
}

test("a correct program that imports a module is checked, and then run with the module", async () => {
  const { session, outputs } = await setUp();
  await session.runChunk(
    "from rune import heart, scale\nsmaller = scale(0.5, heart)\nprint(smaller is not heart)\n",
  );
  expect(outputs).toEqual(["True"]);
});

test("a type mistake in the use of a module is reported before anything runs", async () => {
  const { session, outputs } = await setUp();
  const run = session.runChunk(
    "from rune import heart, scale\nprint('before')\nscale(heart, 0.5)\n",
  );
  await expect(run).rejects.toBeInstanceOf(StaticTypeErrors);
  await expect(run).rejects.toThrow(/2 type errors|scale expects/);
  expect(outputs).toEqual([]);
});

test("a module that has no description cannot be imported", async () => {
  const { session } = await setUp();
  const error = await session
    .runChunk("from physics import gravity\nprint(gravity)\n")
    .catch((e: unknown) => e);
  expect(error).toBeInstanceOf(StaticTypeErrors);
  expect((error as StaticTypeErrors).errors.map(e => e.message)).toContainEqual(
    expect.stringContaining("The module physics cannot be imported: its types are not known"),
  );
});

test("a program imports the type of a module to annotate with it, and runs although the module does not export it", async () => {
  const { session, outputs } = await setUp();
  await session.runChunk(
    "from rune import heart, scale, Rune\n" +
      "def half(r: Rune) -> Rune:\n    return scale(0.5, r)\n" +
      "print(half(heart) is not heart)\n",
  );
  expect(outputs).toEqual(["True"]);
});

test("a type that is imported only as a type cannot be used as a value", async () => {
  const { session, outputs } = await setUp();
  const error = await session
    .runChunk("from rune import heart, Rune\nprint('before')\nprint(Rune)\n")
    .catch((e: unknown) => e);
  expect(error).toBeInstanceOf(StaticTypeErrors);
  const [first] = (error as StaticTypeErrors).errors;
  expect(first).toMatchObject({
    message: "Rune is a type: use it to annotate, not as a value",
    line: 3,
  });
  expect(outputs).toEqual([]);
});

test("an aliased type is a type under its alias, and a value of the same name as the export is not", async () => {
  const { session, outputs } = await setUp();
  const aliased = await session
    .runChunk("from rune import Rune as T\nprint('before')\nprint(T)\n")
    .catch((e: unknown) => e);
  expect((aliased as StaticTypeErrors).errors[0]).toMatchObject({
    message: "T is a type: use it to annotate, not as a value",
    line: 3,
  });
  // `Rune` is not bound by that import: it is an ordinary name (here, the program's own)
  await session.runChunk("from rune import Rune as T\nRune = 5\nprint(Rune)\n");
  expect(outputs).toEqual(["5"]);
});

test("a type that an earlier chunk of the session imported cannot be used as a value in a later one", async () => {
  const { session, outputs } = await setUp();
  await session.runChunk("from rune import heart, scale, Rune\n");
  // as an annotation it is fine, in a later chunk too
  await session.runChunk("def half(r: Rune) -> Rune:\n    return r\nprint(half(heart) is heart)\n");
  const error = await session.runChunk("print(Rune)\n").catch((e: unknown) => e);
  expect((error as StaticTypeErrors).errors[0]).toMatchObject({
    message: "Rune is a type: use it to annotate, not as a value",
    line: 1,
  });
  // a chunk that binds the name as a value makes it a value from then on
  await session.runChunk("Rune = 7\nprint(Rune)\n");
  await session.runChunk("print(Rune + 1)\n");
  expect(outputs).toEqual(["True", "7", "8"]);
});

describe("the names that a program imports only as types", () => {
  const erased = (source: string) =>
    eraseTypes(parse(source), { typeNames: () => new Set(["Rune"]) }).statements[0];

  test("are left out of the import, which stays if other names are imported", () => {
    const stmt = erased("from rune import heart, Rune\n") as StmtNS.FromImport;
    expect(stmt).toBeInstanceOf(StmtNS.FromImport);
    expect(stmt.names.map(({ name }) => name.lexeme)).toEqual(["heart"]);
  });

  test("make the import a pass, if nothing else is imported", () => {
    expect(erased("from rune import Rune\n")).toBeInstanceOf(StmtNS.Pass);
  });

  test("are left alone if the module has no types of that name", () => {
    expect(
      (
        eraseTypes(parse("from sound import Rune\n"), { typeNames: () => undefined })
          .statements[0] as StmtNS.FromImport
      ).names,
    ).toHaveLength(1);
  });
});
