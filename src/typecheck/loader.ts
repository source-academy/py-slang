import { TypedPythonChecker } from "./checker";
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
 * The checker, started when it is first needed (or when {@link preload} says so), and again after a
 * failure: a network error on the first run does not stop a later one. A checker that cannot be
 * started is an error ({@link TypeCheckerUnavailableError}); the program is not run unchecked.
 */
export class LazyChecker implements ChunkChecker {
  private checker?: Promise<TypedPythonChecker>;

  constructor(private readonly start: () => Promise<TypedPythonChecker> = startBrowserChecker) {}

  /** Starts loading now, so that the checker is ready when the first program is run. */
  preload(): void {
    this.get().catch(() => undefined);
  }

  async checkChunk(source: string): Promise<TypeDiagnostic[]> {
    return (await this.get()).checkChunk(source);
  }

  dispose(): void {
    this.checker?.then(checker => checker.dispose()).catch(() => undefined);
    this.checker = undefined;
  }

  private get(): Promise<TypedPythonChecker> {
    this.checker ??= this.start().catch((cause: unknown) => {
      this.checker = undefined;
      throw new TypeCheckerUnavailableError(cause);
    });
    return this.checker;
  }
}
