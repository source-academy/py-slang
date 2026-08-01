/**
 * Local-file ("folder") imports — a genuine source-to-source transform,
 * mirroring js-slang's own local-module preprocessor (js-slang's
 * src/modules/preprocessor/) but literally: `from .foo import bar`
 * (level > 0 — a leading-dot relative import, Python's own syntax for "a
 * file relative to me", not a Source Academy module) resolves against a
 * program's own file map, and the whole multi-file program is flattened
 * into ONE Python source string — exactly the artifact a student could be
 * shown, and exactly what every py-slang engine already knows how to parse
 * and run, unmodified. See source-academy/py-slang#378.
 *
 * Each locally-imported file becomes a `def __module_<slug>__(): ...`
 * wrapping that file's own statements (copied verbatim from its source),
 * returning a genuine SICPy linked list of (name, value) pairs — Python has
 * no `export` keyword, so every top-level binding qualifies, exactly
 * mirroring js-slang's own local-import bundler down to the generated
 * `__access_named_export__` helper being line-for-line the same walk as
 * its `__access_named_export__` prelude function (js-slang's
 * localImport.prelude.ts). This is why local imports need SICPy §2 or
 * higher: chapter 1 has no pair/list library to build that transfer
 * structure from — the identical restriction js-slang's own folders have on
 * Source §1, and for the identical reason.
 *
 * `level === 0` (a bare name, e.g. `from rune import show`) is a Source
 * Academy module, not a local file — hoisted verbatim to the top of the
 * flattened program (mirroring js-slang's bundler.ts's own hoisting of
 * Source-module imports across every bundled file), so whichever engine
 * runs the flattened text still resolves it exactly as it always has: every
 * engine's own module-loading pre-pass only ever looks at a program's
 * top-level statements, and the grammar guarantees FromImport can only ever
 * appear there anyway (program's own grammar rule parses a leading run of
 * import statements before anything else, in every file) — so hoisting
 * never needs to reach inside a nested block to find one.
 *
 * A dependency's `__exports_<slug>__` name is deterministic — the same
 * absolute path always produces the same identifier — so a name already
 * bound from an earlier chunk in the same persistent session (see
 * `priorGlobalNames`) is recognized without needing any separate runtime
 * cache: bundling simply skips re-declaring/re-invoking that file and
 * reuses the existing binding, exactly the same mechanism REPL-mode
 * compilation (compiler.ts) already uses for "does an earlier chunk already
 * have this name" — no new runtime state needed anywhere.
 *
 * Known simplification: a top-level name that's only conditionally bound
 * (e.g. assigned inside an `if` with no matching `else`, and that branch
 * never runs) is referenced directly when building the returned pair list
 * — if it was truly never assigned, this raises Python's own NameError, the
 * same as referencing it directly in the file's own code would. There's no
 * softer failure mode available: SICPy has neither `try`/`except` nor
 * `locals()`/dict introspection to detect "bound or not" without one of
 * those. This only surfaces for the (rare) combination of a conditionally-
 * unbound top-level name that's also imported by another file.
 */
import { StmtNS } from "../ast-types";
import { parse } from "../parser";

/** Resolves an absolute path to its source, or `undefined` if no such file
 * exists — the same shape as js-slang's own `FileGetter`. */
export type LocalFileGetter = (path: string) => Promise<string | undefined>;

export class LocalImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LocalImportError";
  }
}

const INDENT = "    ";

/** Prepends `indent` to every non-empty line — blank lines stay blank
 * rather than becoming trailing whitespace. */
function indentBlock(text: string, indent: string = INDENT): string {
  return text
    .split("\n")
    .map(line => (line.length > 0 ? indent + line : line))
    .join("\n");
}

/** A statement's own original source text, unchanged — reusing the same
 * span convention as errors.ts's snippet rendering. */
function spanText(source: string, stmt: StmtNS.Stmt): string {
  return source.substring(
    stmt.startToken.indexInSource,
    stmt.endToken.indexInSource + stmt.endToken.lexeme.length,
  );
}

function isFromImport(s: StmtNS.Stmt): s is StmtNS.FromImport {
  return s.kind === "FromImport";
}

/**
 * Resolves a relative import's target file, mirroring CPython's own
 * relative-import semantics: `level` is the number of leading dots (1 = the
 * importing file's own directory, 2 = its parent, ...), and `moduleDotted`
 * (e.g. `"pkg.utils"`) is a further dotted path under that directory. No
 * `__init__.py` package semantics — every `.py` file is a flat, standalone
 * module (a "folder of files" model, not a full Python package system),
 * with a `.py` extension always implied on the final segment.
 */
export function resolveLocalModulePath(
  fromPath: string,
  level: number,
  moduleDotted: string,
): string {
  const fromDirSegments = fromPath.split("/").filter(Boolean);
  fromDirSegments.pop(); // drop the importing file's own name, keep its directory
  const upCount = Math.max(0, level - 1);
  const baseSegments = fromDirSegments.slice(0, Math.max(0, fromDirSegments.length - upCount));
  const segments: string[] = [];
  for (const seg of [...baseSegments, ...moduleDotted.split(".")]) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") segments.pop();
    else segments.push(seg);
  }
  return "/" + segments.join("/") + ".py";
}

/** A stable, valid Python identifier fragment for `path` — the same input
 * always produces the same output, which is what lets a file bundled in an
 * earlier chunk of a persistent session be recognized from a later chunk's
 * own bundling pass (see `priorGlobalNames`) with no separate cache. */
function slugify(path: string): string {
  return path.replace(/^\/+/, "").replace(/[^a-zA-Z0-9]+/g, "_");
}

function moduleFnName(path: string): string {
  return `__module_${slugify(path)}__`;
}

function exportsVarName(path: string): string {
  return `__exports_${slugify(path)}__`;
}

const ACCESS_HELPER_NAME = "__access_named_export__";

/** Mirrors js-slang's own `__access_named_export__` (its local-import
 * prelude, stdlib/localImport.prelude.ts) line for line: a linear walk
 * through `pair(pair(name, value), rest)` nodes, `None`-terminated. */
const ACCESS_HELPER_SRC = `def ${ACCESS_HELPER_NAME}(named_exports, lookup_name):
    if named_exports == None:
        return None
    else:
        name = head(head(named_exports))
        value = tail(head(named_exports))
        if name == lookup_name:
            return value
        else:
            return ${ACCESS_HELPER_NAME}(tail(named_exports), lookup_name)
`;

/**
 * Every name a plain top-level statement list binds — Python has no
 * `export` keyword, so this *is* "this file's exports" (mirrors
 * compiler.ts's own boundNames helper, minus its dual-mode-specific global-
 * declaration scan, which has no equivalent need here — see this module's
 * own doc comment on `global`/nested-function scoping not being addressed).
 */
function topLevelBoundNames(stmts: StmtNS.Stmt[], into: Set<string> = new Set()): Set<string> {
  for (const s of stmts) {
    if (s.kind === "Assign") {
      const target = (s as StmtNS.Assign).target;
      if (target.kind === "Variable") into.add(target.name.lexeme);
    } else if (s.kind === "AnnAssign") {
      into.add((s as StmtNS.AnnAssign).target.name.lexeme);
    } else if (s.kind === "FunctionDef") {
      into.add((s as StmtNS.FunctionDef).name.lexeme);
    } else if (s.kind === "FromImport") {
      for (const spec of (s as StmtNS.FromImport).names) {
        into.add((spec.alias ?? spec.name).lexeme);
      }
    } else if (s.kind === "If") {
      const i = s as StmtNS.If;
      topLevelBoundNames(i.body, into);
      if (i.elseBlock !== null) topLevelBoundNames(i.elseBlock, into);
    } else if (s.kind === "While") {
      topLevelBoundNames((s as StmtNS.While).body, into);
    } else if (s.kind === "For") {
      const f = s as StmtNS.For;
      into.add(f.target.lexeme);
      topLevelBoundNames(f.body, into);
    }
  }
  return into;
}

/** `pair(pair(name1, value1), pair(pair(name2, value2), None))` — see the
 * module doc's "known simplification" note on referencing names directly
 * (no guard against an unbound one) rather than masking or catching it. */
function buildReturnExpr(names: Set<string>): string {
  let expr = "None";
  for (const name of names) {
    expr = `pair(pair(${JSON.stringify(name)}, ${name}), ${expr})`;
  }
  return expr;
}

interface SplitStatements {
  /** Every non-import statement's own verbatim source text, plus an
   * assignment line per name for each local (level > 0) import — in
   * original statement order, not yet indented. */
  bodyText: string;
  /** Every level-0 FromImport's own verbatim source text (hoisted
   * separately — see this module's doc comment). */
  level0ImportTexts: string[];
  /** Every level>0 import this file's statements need, resolved to an
   * absolute path — walked (recursively) before this file's own def is
   * emitted, so each target's `__exports_*__` already exists by then. */
  localImportTargets: string[];
  boundNames: Set<string>;
}

function splitStatements(source: string, statements: StmtNS.Stmt[], currentPath: string): SplitStatements {
  const pieces: string[] = [];
  const level0ImportTexts: string[] = [];
  const localImportTargets: string[] = [];
  for (const stmt of statements) {
    if (isFromImport(stmt)) {
      if (stmt.level === 0) {
        level0ImportTexts.push(spanText(source, stmt));
        continue;
      }
      const targetPath = resolveLocalModulePath(currentPath, stmt.level, stmt.module.lexeme);
      localImportTargets.push(targetPath);
      const exportsVar = exportsVarName(targetPath);
      for (const spec of stmt.names) {
        const bound = (spec.alias ?? spec.name).lexeme;
        pieces.push(`${bound} = ${ACCESS_HELPER_NAME}(${exportsVar}, ${JSON.stringify(spec.name.lexeme)})`);
      }
      continue;
    }
    pieces.push(spanText(source, stmt));
  }
  return {
    bodyText: pieces.join("\n"),
    level0ImportTexts,
    localImportTargets,
    boundNames: topLevelBoundNames(statements),
  };
}

interface BundleState {
  fileGetter: LocalFileGetter;
  variant: number;
  /** Names already bound before this bundling pass even starts (an earlier
   * chunk's own top-level names, for a persistent session) union every
   * `__exports_*__` name emitted so far *in this pass* — the single source
   * of truth for "already available, don't re-bundle" (handles both cross-
   * chunk caching and an in-pass diamond dependency the same way). */
  available: Set<string>;
  inProgress: Set<string>;
  /** Each newly-bundled file's `def ... / __exports_x__ = ...` text, in
   * dependency order (a dependency's block always precedes its importer's). */
  moduleDefs: string[];
  /** Every hoisted level-0 FromImport's own verbatim text, file-visit order. */
  hoistedImports: string[];
  needsAccessHelper: boolean;
}

async function bundleFile(state: BundleState, source: string, path: string): Promise<SplitStatements> {
  const script = source.endsWith("\n") ? source : source + "\n";
  const ast = parse(script);
  const split = splitStatements(script, ast.statements, path);

  if (split.localImportTargets.length > 0 && state.variant < 2) {
    throw new LocalImportError(
      "local file imports ('from .module import name') require SICPy §2 or higher — they use " +
        "pair/list (linked lists) to pass a file's exports to whatever imports from it.",
    );
  }

  state.hoistedImports.push(...split.level0ImportTexts);
  if (split.localImportTargets.length > 0) state.needsAccessHelper = true;

  state.inProgress.add(path);
  try {
    for (const targetPath of split.localImportTargets) {
      if (state.available.has(exportsVarName(targetPath))) continue;
      if (state.inProgress.has(targetPath)) {
        throw new LocalImportError(
          `cannot import '${targetPath}': circular import (it is already being imported)`,
        );
      }
      const targetSource = await state.fileGetter(targetPath);
      if (targetSource === undefined) {
        throw new LocalImportError(`Module "${targetPath}" not found.`);
      }
      const targetSplit = await bundleFile(state, targetSource, targetPath);
      const fnName = moduleFnName(targetPath);
      const exportsVar = exportsVarName(targetPath);
      state.moduleDefs.push(
        `def ${fnName}():\n${indentBlock(targetSplit.bodyText)}\n${INDENT}return ${buildReturnExpr(targetSplit.boundNames)}\n\n` +
          `${exportsVar} = ${fnName}()\n`,
      );
      state.available.add(exportsVar);
    }
  } finally {
    state.inProgress.delete(path);
  }
  return split;
}

/**
 * Flattens `entrypointSource` (the file at `entrypointPath`) and everything
 * it locally imports, transitively, into one Python source string — parse()
 * and run that exactly like any ordinary single-file program; every engine
 * already knows how to. Returns the entrypoint's own text unchanged (no
 * bundling at all) if it has no local imports, so a program that never uses
 * folders is completely unaffected.
 *
 * `priorGlobalNames` are names a persistent session (Py2JsSession) already
 * has bound from an earlier chunk — a dependency already bundled then is
 * recognized here (by its deterministic `__exports_*__` name) and neither
 * re-declared nor re-invoked; pass an empty set for a one-shot run.
 */
export async function bundleLocalImports(
  entrypointSource: string,
  entrypointPath: string,
  fileGetter: LocalFileGetter,
  variant: number,
  priorGlobalNames: Set<string> = new Set(),
): Promise<string> {
  const script = entrypointSource.endsWith("\n") ? entrypointSource : entrypointSource + "\n";
  const ast = parse(script);
  if (!ast.statements.some(s => isFromImport(s) && s.level > 0)) {
    return entrypointSource;
  }

  const state: BundleState = {
    fileGetter,
    variant,
    available: new Set(priorGlobalNames),
    inProgress: new Set(),
    moduleDefs: [],
    hoistedImports: [],
    needsAccessHelper: false,
  };
  const entrypointSplit = await bundleFile(state, entrypointSource, entrypointPath);

  const parts: string[] = [];
  if (state.needsAccessHelper && !priorGlobalNames.has(ACCESS_HELPER_NAME)) {
    parts.push(ACCESS_HELPER_SRC);
  }
  parts.push(...state.hoistedImports);
  parts.push(...state.moduleDefs);
  parts.push(entrypointSplit.bodyText);
  return parts.join("\n") + "\n";
}
