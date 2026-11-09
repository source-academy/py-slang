import { ExprNS, StmtNS } from "../ast-types";
import { parse } from "../parser/parser-adapter";
import { traverseAST } from "../validator";
import { PyrightClient, type WorkerFactory } from "./client";
import { tidy, toTypeDiagnostic, type TypeDiagnostic } from "./diagnostics";
import { opaqueTypeNames, toStub, UnknownDescriptionError } from "./module-description";
import { temporaryDescriptions, type DescriptionSource } from "./modules";

/** What a program binds at its top level: what a later REPL chunk can use. */
export interface TopLevelNames {
  /** Every name: variables, functions, type aliases, loop variables, imports, `global` names. */
  all: string[];
  /** The names of the functions and the type aliases (`def`, `type`) among them. */
  definitions: string[];
  /** The names that are declared with a type (`x: int = 0`), with the text of the type. */
  annotations: Map<string, string>;
}

/** `source` is the text of the program: the annotations are cut from it. */
export function topLevelNames(program: StmtNS.Stmt, source: string): TopLevelNames {
  const all = new Set<string>();
  const definitions = new Set<string>();
  const annotations = new Map<string, string>();
  const bind = (statements: StmtNS.Stmt[]) => {
    for (const statement of statements) {
      if (statement instanceof StmtNS.Assign) {
        if (statement.target instanceof ExprNS.Variable) all.add(statement.target.name.lexeme);
      } else if (statement instanceof StmtNS.AnnAssign) {
        const name = statement.target.name.lexeme;
        all.add(name);
        const { startToken, endToken } = statement.ann;
        annotations.set(
          name,
          source.slice(startToken.indexInSource, endToken.indexInSource + endToken.lexeme.length),
        );
      } else if (statement instanceof StmtNS.FunctionDef || statement instanceof StmtNS.TypeAlias) {
        all.add(statement.name.lexeme);
        definitions.add(statement.name.lexeme);
      } else if (statement instanceof StmtNS.FromImport) {
        for (const { name, alias } of statement.names) all.add((alias ?? name).lexeme);
      } else if (statement instanceof StmtNS.For) {
        all.add(statement.target.lexeme);
        bind(statement.body);
      } else if (statement instanceof StmtNS.While) {
        bind(statement.body);
      } else if (statement instanceof StmtNS.If) {
        bind(statement.body);
        if (statement.elseBlock) bind(statement.elseBlock);
      }
    }
  };
  if (program instanceof StmtNS.FileInput) bind(program.statements);
  // `global x` in a function declares `x` at the top level, wherever the function is.
  traverseAST(program, node => {
    if (node instanceof StmtNS.Global) for (const name of node.names) all.add(name.lexeme);
  });
  return { all: [...all], definitions: [...definitions], annotations };
}

/** The top-level names of a chunk, or none if it is not a program (the checker reports why). */
function namesOfChunk(source: string): TopLevelNames {
  const text = source.endsWith("\n") ? source : source + "\n";
  try {
    return topLevelNames(parse(text), text);
  } catch {
    return { all: [], definitions: [], annotations: new Map() };
  }
}

/** The names of the modules that a program imports (`from rune import show`), not its own files (`from .x import y`). */
function importedModules(source: string): string[] {
  const text = source.endsWith("\n") ? source : source + "\n";
  const modules = new Set<string>();
  try {
    traverseAST(parse(text), node => {
      if (node instanceof StmtNS.FromImport && node.level === 0) modules.add(node.module.lexeme);
    });
  } catch {
    // Not a program: the checker reports why.
  }
  return [...modules];
}

/** A chunk that has been checked and is not part of the session yet: see {@link TypedPythonChecker.proposeChunk}. */
export interface ProposedChunk {
  diagnostics: TypeDiagnostic[];
  /** Makes the chunk part of the session: later chunks can use its names and their types. */
  accept(): void;
}

/**
 * The type checker of Python §4 Typed: pyright, in a worker, with Source Python's builtins and
 * prelude (see src/typecheck/bundler/). Give it the program as it is written, with its annotations:
 * the program's line numbers are the diagnostics' line numbers.
 */
export class TypedPythonChecker {
  /** The REPL chunks that were accepted so far: `chunk_<i>.py`. */
  private chunks = 0;
  /** For each name that a chunk bound, the last chunk that did. */
  private readonly bound = new Map<string, number>();
  /** For each name that a chunk declared with a type, the text of the type (of the last that did). */
  private readonly declared = new Map<string, string>();

  /** The modules whose stubs the checker has been given. */
  private readonly provided = new Set<string>();

  private constructor(
    private readonly client: PyrightClient,
    private readonly descriptions: DescriptionSource,
  ) {}

  /** `descriptions` says what the types of an imported module are (see {@link provideModules}). */
  static async start(
    createWorker: WorkerFactory,
    descriptions: DescriptionSource = temporaryDescriptions,
  ): Promise<TypedPythonChecker> {
    return new TypedPythonChecker(await PyrightClient.start(createWorker), descriptions);
  }

  /**
   * Gives the checker the types of the modules that the program imports, as stubs: a file `rune.pyi`
   * for `from rune import show`, from the module's description (module-description.ts). A module
   * with no description is not given: checking reports that the import cannot be resolved. A
   * description that this version cannot read is reported here, at the first line.
   */
  private async provideModules(source: string): Promise<TypeDiagnostic[]> {
    const problems: TypeDiagnostic[] = [];
    for (const module of importedModules(source)) {
      if (this.provided.has(module)) continue;
      const description = this.descriptions(module);
      if (!description) continue;
      try {
        // `foo.bar` is the file foo/bar.pyi, where pyright looks for it.
        // The source gave the description of another module (stale, or misrouted).
        if (description.module !== module)
          throw new UnknownDescriptionError(
            `it describes the module ${description.module}, not ${module}`,
          );
        const stub = toStub(description);
        const found = await this.client.check(`${module.replace(/\./g, "/")}.pyi`, stub);
        // A description can make a stub that does not check (an opaque type with the name of a
        // builtin): reject it, so that programs are not checked against a broken signature.
        const broken = found.find(d => d.severity === 1);
        if (broken)
          throw new UnknownDescriptionError(
            `its stub has an error: ${broken.message.split("\n")[0]}`,
          );
        this.provided.add(module);
      } catch (cause) {
        if (!(cause instanceof UnknownDescriptionError)) throw cause;
        const message = `The types of the module ${module} cannot be used: ${cause.message}`;
        problems.push({
          severity: "error",
          message,
          original: message,
          line: 1,
          column: 0,
          endLine: 1,
          endColumn: 0,
        });
      }
    }
    return problems;
  }

  /**
   * Checks a program (the file the student wrote). Checking again, with another text, is a new
   * version of the same program, as when the student types.
   */
  async check(source: string): Promise<TypeDiagnostic[]> {
    const problems = await this.provideModules(source);
    const diagnostics = await this.client.check("main.py", source);
    return tidy([...problems, ...diagnostics.map(d => toTypeDiagnostic(d))]);
  }

  /**
   * Checks a chunk of a REPL session: the program so far is the chunks that were accepted, and this
   * one. A chunk without errors is accepted: later chunks can use its names (and the types that they
   * have). A chunk with errors is not.
   */
  async checkChunk(source: string): Promise<TypeDiagnostic[]> {
    const proposed = await this.proposeChunk(source);
    if (!proposed.diagnostics.some(d => d.severity === "error")) proposed.accept();
    return proposed.diagnostics;
  }

  /**
   * Checks a chunk of a REPL session, as {@link checkChunk} does, but remembers nothing: the chunk
   * is part of the session only when `accept()` is called. An engine has more to say about a chunk
   * than the types do (the Resolver rejects a name that Python §4 lacks, such as `sorted`), and a
   * chunk that is not run must not leave its names, and its declared types, in the session.
   * The next proposal replaces one that was not accepted.
   */
  async proposeChunk(source: string): Promise<ProposedChunk> {
    // Each chunk is a file of its own, which imports the names that earlier chunks bound, from the
    // last chunk that bound each. (`import *` would skip the names that start with an underscore.)
    //
    // Not the names that the chunk itself defines (`def`, `type`) or declares (`x: int = 0`): they
    // take the place of the earlier ones, and importing the old one as well would have it win in
    // later chunks. (A variable that the chunk only assigns is imported: `count = count + 1`.)
    //
    // A variable that an earlier chunk declared with a type is declared again, with that type,
    // after it is imported under another name: an imported name has no declared type of its own,
    // and `count = "many"` after `count: int = 0` must be an error.
    const own = namesOfChunk(source);
    const replaced = new Set([...own.definitions, ...own.annotations.keys()]);
    const imports = new Map<number, string[]>();
    const declarations: string[] = [];
    for (const [name, chunk] of this.bound) {
      if (replaced.has(name)) continue;
      const annotation = this.declared.get(name);
      const alias = `__chunk_${chunk}_${name}`;
      imports.set(chunk, [
        ...(imports.get(chunk) ?? []),
        annotation === undefined ? name : `${name} as ${alias}`,
      ]);
      if (annotation !== undefined) declarations.push(`${name}: ${annotation} = ${alias}`);
    }
    const header = [
      ...[...imports]
        .sort(([a], [b]) => a - b)
        .map(([chunk, names]) => `from .chunk_${chunk} import ${names.join(", ")}`),
      ...declarations,
    ];

    const index = this.chunks;
    const problems = await this.provideModules(source);
    const diagnostics = tidy([
      ...problems,
      ...(await this.client.check(`chunk_${index}.py`, [...header, source].join("\n"))).map(d =>
        toTypeDiagnostic(d, header.length),
      ),
    ]);

    let accepted = false;
    return {
      diagnostics,
      accept: () => {
        if (accepted || this.chunks !== index) return;
        accepted = true;
        this.chunks++;
        for (const name of own.all) this.bound.set(name, index);
        // A function or a type alias replaces a variable that was declared with a type: the type is
        // not the name's any more.
        for (const name of own.definitions) this.declared.delete(name);
        for (const [name, annotation] of own.annotations) this.declared.set(name, annotation);
      },
    };
  }

  /** The names that a module defines only as types (see `ChunkChecker.typeNames`). */
  typeNames(module: string): ReadonlySet<string> | undefined {
    const description = this.descriptions(module);
    return description && description.module === module ? opaqueTypeNames(description) : undefined;
  }

  /** Stops the workers. */
  dispose(): void {
    this.client.dispose();
  }
}
