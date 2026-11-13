/**
 * Builds the type checker's worker from the published web worker of `browser-basedpyright`
 * (an LSP server in one JavaScript file, with typeshed embedded as a map from file name to text).
 * The embedded map is edited in place:
 *
 * - the third-party stubs (`stubs/`, 10 MB) are dropped, and so are the standard library stubs
 *   that the builtins do not (transitively) import, which leaves 55 of 753: from 18 MB to 4.7 MB;
 * - given files are replaced (Source Python's `builtins.pyi`) or added (the prelude, the config), so
 *   that the worker is one file with everything the checker needs.
 *
 * Run by scripts/build-typecheck.ts. Nothing here is part of the evaluators.
 */
import { parse, type Node, type ObjectExpression, type Property } from "acorn";

const TYPESHED = "/typeshed-fallback/";

export interface TypeshedFile {
  /** The path below `/typeshed-fallback/`, such as `stdlib/builtins.pyi`. */
  path: string;
  /** The text of the file. */
  text: string;
  /** The range of the whole entry, `"key":"text",`: what to cut to drop the file. */
  start: number;
  end: number;
  /** The range of the string literal of the text: what to replace to change the file. */
  valueStart: number;
  valueEnd: number;
}

export interface WorkerBundle {
  source: string;
  files: Map<string, TypeshedFile>;
  /** Where the embedded map starts (at its opening brace). */
  mapStart: number;
}

function walk(node: unknown, visit: (node: Node) => boolean): boolean {
  if (Array.isArray(node)) return node.some(child => walk(child, visit));
  if (node === null || typeof node !== "object") return false;
  if (typeof (node as Node).type !== "string") return false;
  if (visit(node as Node)) return true;
  return Object.values(node).some(child => walk(child, visit));
}

function stringKey(property: Property): string | undefined {
  const key = property.key;
  return key.type === "Literal" && typeof key.value === "string" ? key.value : undefined;
}

/** Finds the typeshed map in the bundle: the object literal with the most `/typeshed-fallback/…` keys. */
export function readWorkerBundle(source: string): WorkerBundle {
  const program = parse(source, { ecmaVersion: "latest", sourceType: "script" });
  let map: ObjectExpression | undefined;
  let mostFiles = 0;
  walk(program, node => {
    if (node.type !== "ObjectExpression") return false;
    const object = node as ObjectExpression;
    const count = object.properties.filter(
      p => p.type === "Property" && stringKey(p)?.startsWith(TYPESHED),
    ).length;
    if (count > mostFiles) {
      map = object;
      mostFiles = count;
    }
    return false;
  });
  if (!map) throw new Error("the worker bundle has no embedded typeshed: its format has changed");

  const files = new Map<string, TypeshedFile>();
  const properties = map.properties;
  properties.forEach((p, i) => {
    if (p.type !== "Property") return;
    const key = stringKey(p);
    if (key === undefined || !key.startsWith(TYPESHED)) return;
    if (p.value.type !== "Literal" || typeof p.value.value !== "string") {
      throw new Error(`the worker bundle's entry ${key} is not a string literal`);
    }
    const path = key.slice(TYPESHED.length);
    files.set(path, {
      path,
      text: p.value.value,
      start: p.start,
      // Up to the next entry (which takes the comma with it), or the end of the last one.
      end: i + 1 < properties.length ? properties[i + 1].start : p.end,
      valueStart: p.value.start,
      valueEnd: p.value.end,
    });
  });
  return { source, files, mapStart: map.start };
}

/** The module `a.b` of a stub is `a/b.pyi` or `a/b/__init__.pyi`. */
function moduleFile(stdlib: Map<string, string>, module: string): string | undefined {
  const base = module.replace(/\./g, "/");
  return [`${base}.pyi`, `${base}/__init__.pyi`].find(file => stdlib.has(file));
}

/** The modules that a stub imports, as dotted names (the names imported from a package may be modules). */
function importedModules(file: string, text: string): string[] {
  const isPackage = file.endsWith("__init__.pyi");
  const here = file.replace(/(\/__init__)?\.pyi$/, "").replace(/\//g, ".");
  const modules: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const from = /^\s*from\s+(\.*)([\w.]*)\s+import\s+(.*)/.exec(line);
    if (from) {
      const [, dots, name, imported] = from;
      let base = name;
      if (dots) {
        const parts = here.split(".");
        const up = dots.length - (isPackage ? 1 : 0);
        base = [...parts.slice(0, parts.length - up), ...(name ? [name] : [])].join(".");
      }
      modules.push(base);
      for (const item of imported.replace(/[()]/g, "").split(",")) {
        modules.push(`${base}.${item.trim().split(/\s+/)[0]}`);
      }
      continue;
    }
    const plain = /^\s*import\s+(.*)/.exec(line);
    if (plain) for (const item of plain[1].split(",")) modules.push(item.trim().split(/\s+/)[0]);
  }
  return modules;
}

/**
 * The standard library stubs that `roots` (module names such as `builtins`) import, directly or not,
 * as paths below `stdlib/`.
 */
export function stdlibClosure(files: Map<string, TypeshedFile>, roots: string[]): Set<string> {
  const stdlib = new Map<string, string>();
  for (const [path, file] of files) {
    if (path.startsWith("stdlib/")) stdlib.set(path.slice("stdlib/".length), file.text);
  }
  const seen = new Set<string>();
  const queue = roots.map(root => moduleFile(stdlib, root)).filter((f): f is string => !!f);
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const module of importedModules(file, stdlib.get(file)!)) {
      // A module imports its parent packages too.
      const parts = module.split(".");
      for (let i = 1; i <= parts.length; i++) {
        const parent = moduleFile(stdlib, parts.slice(0, i).join("."));
        if (parent && !seen.has(parent)) queue.push(parent);
      }
    }
  }
  return seen;
}

export interface BuildOptions {
  /** The modules whose standard library stubs are kept, with everything they import: `builtins`, … */
  stdlibRoots: string[];
  /** Files of typeshed to replace, by path below `/typeshed-fallback/` (such as `stdlib/builtins.pyi`). */
  replace: Record<string, string>;
  /** Files to add to the embedded file system, by absolute path. */
  add: Record<string, string>;
}

export interface BuildResult {
  source: string;
  kept: number;
  dropped: number;
}

interface Edit {
  start: number;
  end: number;
  text: string;
}

export function buildWorkerBundle(bundle: WorkerBundle, options: BuildOptions): BuildResult {
  const keep = stdlibClosure(bundle.files, options.stdlibRoots);
  const edits: Edit[] = [];
  let kept = 0;
  let dropped = 0;

  for (const [path, file] of bundle.files) {
    const stdlibPath = path.startsWith("stdlib/") ? path.slice("stdlib/".length) : undefined;
    const drop =
      path.startsWith("stubs/") ||
      (stdlibPath !== undefined && stdlibPath !== "VERSIONS" && !keep.has(stdlibPath));
    if (drop) {
      edits.push({ start: file.start, end: file.end, text: "" });
      dropped++;
    } else {
      kept++;
    }
  }

  for (const [path, text] of Object.entries(options.replace)) {
    const file = bundle.files.get(path);
    if (!file) throw new Error(`typeshed has no ${path} to replace`);
    if (!keep.has(path.replace(/^stdlib\//, ""))) {
      throw new Error(`${path} is replaced but not kept: its module is not in stdlibRoots`);
    }
    edits.push({ start: file.valueStart, end: file.valueEnd, text: JSON.stringify(text) });
  }

  // Added files go at the start of the map, which is never empty (an entry at the end could follow a
  // comma that a dropped last entry leaves behind).
  const added = Object.entries(options.add)
    .map(([key, text]) => `${JSON.stringify(key)}:${JSON.stringify(text)},`)
    .join("");
  edits.push({ start: bundle.mapStart + 1, end: bundle.mapStart + 1, text: added });

  edits.sort((a, b) => b.start - a.start || b.end - a.end);
  let source = bundle.source;
  let limit = source.length;
  for (const edit of edits) {
    if (edit.end > limit) throw new Error("overlapping edits of the worker bundle");
    source = source.slice(0, edit.start) + edit.text + source.slice(edit.end);
    limit = edit.start;
  }
  return { source, kept, dropped };
}

/**
 * Pyright's `_validateConditionalIsBool` (its checker calls it for the condition of `if`, `while`, a
 * conditional expression, `not`, `assert` and a comprehension's `if`) accepts a value whose type has a
 * `__bool__` that returns `bool`, or none: with Source Python's `builtins.pyi`, only `int`, `str`, `list`
 * and the like are rejected, whereas a `Pair`, a function or an `object` is taken as always true. This
 * makes it accept exactly `bool` (and what is unknown, which is reported elsewhere).
 *
 * Pyright does not call it for the operands of `and` and `or`: this adds the two calls to the checker's
 * `visitBinaryOperation` (the operators `and` and `or` are 36 and 37 in pyright's `OperatorType`). Python
 * §4 requires a bool for the left operand, and Python §4 Typed for the right operand too, so that
 * `a and b` has the type `bool`.
 *
 * It throws if the shape of the checker has changed.
 */
export function patchBoolOperandChecks(source: string): string {
  const expectOnce = (anchor: string, what: string) => {
    const count = source.split(anchor).length - 1;
    if (count !== 1) {
      throw new Error(
        `pyright has changed: expected exactly one ${what}, found ${count}. ` +
          `Update patchBoolOperandChecks in src/typecheck/bundler/bundle.ts.`,
      );
    }
  };

  // A subtype that has no `__bool__` at all (a `Pair`, a function, an `object`) is invalid too.
  const magic =
    'let o=this._evaluator.getTypeOfMagicMethodCall(n,"__bool__",[],e,void 0)?.type;' +
    '!o||(0,G.isAnyOrUnknown)(o)||(0,G.isClassInstance)(o)&&G.ClassType.isBuiltIn(o,"bool")||' +
    "(t=!1,r.addMessage(m.LocAddendum.conditionalRequiresBool().format(" +
    "{operandType:this._evaluator.printType(n),boolReturnType:this._evaluator.printType(o)})))";
  expectOnce(magic, "check of `__bool__` in _validateConditionalIsBool");

  const visit = "visitBinaryOperation(e){12===e.d.operator||28===e.d.operator";
  expectOnce(visit, "checker visitBinaryOperation");

  const operators = "(36===e.d.operator||37===e.d.operator)";
  const strict =
    'let o=this._evaluator.getTypeOfMagicMethodCall(n,"__bool__",[],e,void 0)?.type;' +
    '(o&&((0,G.isAnyOrUnknown)(o)||(0,G.isClassInstance)(o)&&G.ClassType.isBuiltIn(o,"bool")))||' +
    "(t=!1,r.addMessage(m.LocAddendum.conditionalRequiresBool().format(" +
    '{operandType:this._evaluator.printType(n),boolReturnType:o?this._evaluator.printType(o):""})))';
  return source
    .replace(magic, () => strict)
    .replace(
      visit,
      () =>
        `visitBinaryOperation(e){${operators}&&(this._validateConditionalIsBool(e.d.leftExpr),` +
        `this._validateConditionalIsBool(e.d.rightExpr));12===e.d.operator||28===e.d.operator`,
    );
}
