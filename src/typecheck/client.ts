import { WORKSPACE_ROOT } from "./constants";

/**
 * What the client needs of a worker: a browser `Worker` has it, and so does the adapter of a Node
 * worker thread (node-worker.ts), which the tests and the command line use.
 */
export interface WorkerLike {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  terminate(): void;
}

/** Starts the checker's worker (dist/TypedPy4Checker.js). Called again for the worker that pyright asks for. */
export type WorkerFactory = () => WorkerLike;

/** A diagnostic of the language server, as it sends it. Lines and characters count from 0. */
export interface LspDiagnostic {
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  /** 1 error, 2 warning, 3 information, 4 hint */
  severity?: 1 | 2 | 3 | 4;
  code?: string | number;
  message: string;
  source?: string;
}

interface Message {
  jsonrpc?: "2.0";
  id?: number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: unknown;
  type?: string;
  port?: unknown;
  initialData?: unknown;
}

interface PublishDiagnostics {
  uri: string;
  version?: number;
  diagnostics: LspDiagnostic[];
}

export const DEFAULT_TIMEOUT_MS = 30_000;

/** The URI of a file of the program. */
export function fileUri(name: string): string {
  return `file://${WORKSPACE_ROOT}/${name}`;
}

/**
 * A client of the language server in the checker's worker: the part of the language server protocol
 * that checking needs. The worker is basedpyright's web worker (a language server that talks through
 * `postMessage`); see src/typecheck/bundler/bundle.ts.
 *
 * The worker needs two things from its host that a language server on its own would not: a first
 * message that boots it (`browser/boot`), and a second worker, for the analysis in the background,
 * which it asks for with `browser/newWorker` and hands one end of a message channel.
 *
 * One check at a time: calls are queued.
 */
export class PyrightClient {
  private nextId = 1;
  private readonly pending = new Map<
    number,
    { resolve(v: unknown): void; reject(e: Error): void }
  >();
  private readonly versions = new Map<string, number>();
  /** The files that are being checked, by URI: what to do with the diagnostics that the server publishes. */
  private readonly waiting = new Map<
    string,
    {
      version: number;
      /** The latest diagnostics that the server published for this version of the file. */
      latest?: LspDiagnostic[];
      /** Whether we are waiting for the answer to the request that follows the last publication. */
      flushing: boolean;
      resolve(diagnostics: LspDiagnostic[]): void;
      reject(error: Error): void;
    }
  >();
  /** Whether the server is analyzing (between `pyright/beginProgress` and `pyright/endProgress`). */
  private analyzing = false;
  private readonly workers: WorkerLike[] = [];
  private queue: Promise<unknown> = Promise.resolve();
  private disposed = false;

  private constructor(
    private readonly worker: WorkerLike,
    private readonly createWorker: WorkerFactory,
  ) {
    this.workers.push(worker);
    worker.onmessage = event => this.receive(event.data as Message);
    worker.onerror = event =>
      this.fail(new Error(`the type checker's worker failed: ${String(event)}`));
  }

  /**
   * Starts the worker and the language server in it. `files` are more files of the program, by name
   * (the program itself is given to {@link check}).
   */
  static async start(
    createWorker: WorkerFactory,
    files: Record<string, string> = {},
  ): Promise<PyrightClient> {
    const client = new PyrightClient(createWorker(), createWorker);
    client.worker.postMessage({ type: "browser/boot", mode: "foreground" });
    const embedded = Object.fromEntries(
      Object.entries(files).map(([name, text]) => [`${WORKSPACE_ROOT}/${name}`, text]),
    );
    await client.request("initialize", {
      processId: null,
      rootUri: `file://${WORKSPACE_ROOT}`,
      workspaceFolders: [{ uri: `file://${WORKSPACE_ROOT}`, name: "workspace" }],
      // The server publishes the diagnostics (see `published` for which publication is the answer).
      // Not the other way, asking for them (`textDocument/diagnostic`): under Node that works, but
      // in a browser (Chromium, Firefox, WebKit) the server never answered such a request. The
      // cause was not found: this is what was seen.
      capabilities: { textDocument: { publishDiagnostics: {} } },
      initializationOptions: { files: embedded },
    });
    client.notify("initialized", {});
    return client;
  }

  /**
   * Checks the file `name` of the program with the given text and returns the diagnostics, all
   * severities. A name that has been checked before is a new version of that file. Files that
   * other files import are made known by checking them first.
   */
  check(name: string, text: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<LspDiagnostic[]> {
    const result = this.queue.then(() => this.checkNow(name, text, timeoutMs));
    this.queue = result.catch(() => undefined);
    return result;
  }

  /** Stops the workers. */
  dispose(): void {
    this.disposed = true;
    this.fail(new Error("the type checker was disposed"));
    for (const worker of this.workers) worker.terminate();
    this.workers.length = 0;
  }

  private checkNow(name: string, text: string, timeoutMs: number): Promise<LspDiagnostic[]> {
    if (this.disposed) return Promise.reject(new Error("the type checker was disposed"));
    const uri = fileUri(name);
    const version = (this.versions.get(uri) ?? 0) + 1;
    this.versions.set(uri, version);

    const answer = new Promise<LspDiagnostic[]>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiting.delete(uri);
        reject(new Error(`the type checker did not answer within ${timeoutMs} ms`));
      }, timeoutMs);
      this.waiting.set(uri, {
        version,
        flushing: false,
        resolve: diagnostics => {
          clearTimeout(timer);
          this.waiting.delete(uri);
          resolve(diagnostics);
        },
        reject: error => {
          clearTimeout(timer);
          this.waiting.delete(uri);
          reject(error);
        },
      });
    });

    if (version === 1) {
      // An empty file in the server's file system, so that other files can import it; its text
      // is the open document's.
      this.notify("pyright/createFile", { uri });
    } else {
      // Not `didChange`: the server waits a quarter of a second after a change, in case there are
      // more. Opening the document again is analyzed at once.
      this.notify("textDocument/didClose", { textDocument: { uri } });
    }
    this.notify("textDocument/didOpen", {
      textDocument: { uri, languageId: "python", version, text },
    });
    return answer;
  }

  private send(message: Message): void {
    this.worker.postMessage({ jsonrpc: "2.0", ...message });
  }

  private request(method: string, params: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.pending.set(id, { resolve, reject });
      this.send({ id, method, params });
    });
  }

  private notify(method: string, params: unknown): void {
    this.send({ method, params });
  }

  private receive(message: Message): void {
    if (message.type === "browser/newWorker") {
      // The server asks for a worker for the analysis in the background, with one end of a channel.
      const background = this.createWorker();
      background.onerror = event =>
        this.fail(new Error(`the type checker's background worker failed: ${String(event)}`));
      this.workers.push(background);
      background.postMessage(
        {
          type: "browser/boot",
          mode: "background",
          port: message.port,
          initialData: message.initialData,
        },
        [message.port as Transferable],
      );
      return;
    }
    if (message.method === "pyright/beginProgress") {
      this.analyzing = true;
      return;
    }
    if (message.method === "pyright/endProgress") {
      this.analyzing = false;
      for (const waiting of [...this.waiting.entries()]) this.flush(...waiting);
      return;
    }
    if (message.method === "textDocument/publishDiagnostics") {
      this.published(message.params as PublishDiagnostics);
      return;
    }
    if (message.id !== undefined && message.method === undefined) {
      // The answer to one of our requests.
      const pending = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) pending?.reject(new Error(JSON.stringify(message.error)));
      else pending?.resolve(message.result);
      return;
    }
    if (message.id !== undefined && message.method !== undefined) {
      // A request of the server: it asks for its configuration; there is none beyond the file.
      const items = (message.params as { items?: unknown[] } | undefined)?.items;
      this.send({
        id: message.id,
        result: message.method === "workspace/configuration" ? (items ?? []).map(() => ({})) : null,
      });
      return;
    }
  }

  /**
   * The server analyzes in batches and publishes the diagnostics of the files of each batch, so a file
   * can be published more than once: what it has found so far, which can be wrong (a file that imports
   * another has no errors yet, or the other has changed since), and again when the files that it
   * depends on are done. Which publication is the last depends on how the batches fall, which depends
   * on how fast the processor is. What is known is that the server has no more to analyze when it
   * ends the analysis (`pyright/endProgress`), and that it sends what it publishes at the end in the
   * same turn. So the answer is the latest publication for the version of the file once the analysis
   * has ended and the server has answered a request that we sent after that: the server handles what
   * it receives one at a time, and what it sends arrives in the order that it was sent.
   * (The publication with no version, which clears a file that was closed, is not an answer.)
   */
  private published({ uri, version, diagnostics }: PublishDiagnostics): void {
    const waiting = this.waiting.get(uri);
    if (!waiting || version !== waiting.version) return;
    waiting.latest = diagnostics;
    this.flush(uri, waiting);
  }

  /** Ask the server for something, when it is not analyzing and we have a publication: see {@link published}. */
  private flush(
    uri: string,
    waiting: { latest?: LspDiagnostic[]; flushing: boolean; resolve(d: LspDiagnostic[]): void },
  ): void {
    if (this.analyzing || waiting.latest === undefined || waiting.flushing) return;
    waiting.flushing = true;
    const answered = () => {
      waiting.flushing = false;
      // A new analysis may have begun since: then it ends with the final publication, which comes
      // after this one.
      if (this.analyzing || waiting.latest === undefined) return;
      if (this.waiting.get(uri) === waiting) waiting.resolve(waiting.latest);
    };
    // Any answer will do, also the error for a command that does not exist.
    this.request("workspace/executeCommand", { command: "py-slang.barrier", arguments: [] }).then(
      answered,
      answered,
    );
  }

  private fail(error: Error): void {
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
    for (const waiting of [...this.waiting.values()]) waiting.reject(error);
  }
}
