import { TypedPythonChecker, type ProposedChunk } from "./checker";
import type { WorkerLike } from "./client";
import type { TypeDiagnostic } from "./diagnostics";
import { TypeCheckerUnavailableError } from "./errors";
import type { ChunkChecker } from "./typed-chunk";

/** Where the worker of the Typed Python §4 checker is published: next to the evaluators. */
export const TYPED_PY4_CHECKER_URL = "https://source-academy.github.io/py-slang/TypedPy4Checker.js";

/**
 * Starts the checker in a browser (or a web worker, as an evaluator is): fetches its script and runs
 * it as a worker from a `blob:` URL. (An evaluator is itself started from a `blob:` URL, so it
 * cannot start a worker from another origin's URL directly; the script is served with
 * `Access-Control-Allow-Origin: *`, as the evaluators are.) The URL of the blob is kept: the worker
 * is started again by the checker for the analysis in the background.
 */
export async function startBrowserChecker(
  url: string = TYPED_PY4_CHECKER_URL,
): Promise<TypedPythonChecker> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  const script = await response.text();
  const blob = URL.createObjectURL(new Blob([script], { type: "text/javascript" }));
  // A Worker has the members that the client uses (`postMessage`, `onmessage`, `onerror`,
  // `terminate`); only the type of its message event is more than the client asks for.
  return TypedPythonChecker.start(() => new Worker(blob) as unknown as WorkerLike);
}

/**
 * The checker, started when it is first needed (or when {@link preload} says so). A checker that
 * cannot be started, or that fails while it is in use (its worker died, or a check timed out), is an
 * error ({@link TypeCheckerUnavailableError}) and the program is not run unchecked; it is dropped, and
 * the next run starts another. That one is told the chunks of the session that were accepted, so
 * that a chunk can still use the names of the earlier ones.
 */
export class LazyChecker implements ChunkChecker {
  private checker?: Promise<TypedPythonChecker>;
  /** The chunks of the session that were accepted, in order. */
  private readonly accepted: string[] = [];

  constructor(private readonly start: () => Promise<TypedPythonChecker> = startBrowserChecker) {}

  /** Starts loading now, so that the checker is ready when the first program is run. */
  preload(): void {
    this.get().catch(() => undefined);
  }

  proposeChunk(source: string): Promise<ProposedChunk> {
    return this.guarded(async checker => {
      const proposed = await checker.proposeChunk(source);
      return {
        diagnostics: proposed.diagnostics,
        accept: () => {
          proposed.accept();
          this.accepted.push(source);
        },
      };
    });
  }

  check(source: string): Promise<TypeDiagnostic[]> {
    return this.guarded(checker => checker.check(source));
  }

  private async guarded<T>(use: (checker: TypedPythonChecker) => Promise<T>): Promise<T> {
    const promise = this.get();
    try {
      return await use(await promise);
    } catch (cause) {
      // Not the checker's findings (those are diagnostics): it does not work. Do not keep it.
      if (this.checker === promise) this.drop();
      throw cause instanceof TypeCheckerUnavailableError
        ? cause
        : new TypeCheckerUnavailableError(cause);
    }
  }

  private get(): Promise<TypedPythonChecker> {
    this.checker ??= this.start().then(async checker => {
      try {
        // A new checker has seen none of the session: tell it what was accepted.
        for (const source of this.accepted) (await checker.proposeChunk(source)).accept();
      } catch (cause) {
        checker.dispose();
        throw cause;
      }
      return checker;
    });
    const promise = this.checker;
    promise.catch(() => {
      if (this.checker === promise) this.checker = undefined;
    });
    return promise;
  }

  private drop(): void {
    const dropped = this.checker;
    this.checker = undefined;
    dropped?.then(checker => checker.dispose()).catch(() => undefined);
  }
}
