/**
 * How the client finds the answer among what the language server sends, with a server that is
 * scripted (no pyright: the order of the messages is what is tested). The server analyzes in batches,
 * so a file can be published once before the end of the analysis, or first with what it has found so
 * far and again after the end; which one it is depends on how fast the processor is. The real server
 * did both, and a rule that expected the second only hung on a busy machine.
 */
import { PyrightClient, type LspDiagnostic, type WorkerLike } from "../typecheck";

const diagnostic = (message: string): LspDiagnostic => ({
  range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
  severity: 1,
  message,
});

type Message = { id?: number; method?: string; params?: any };

/** A server that does what the script says when a file is opened, and answers the other requests. */
function scriptedServer(onOpen: (emit: (m: object) => void, uri: string, version: number) => void) {
  const server: WorkerLike & { requests: string[] } = {
    onmessage: null,
    onerror: null,
    requests: [],
    terminate: () => undefined,
    postMessage(raw) {
      const message = raw as Message;
      const emit = (m: object) => server.onmessage?.({ data: { jsonrpc: "2.0", ...m } });
      if (message.method !== undefined && message.id !== undefined) {
        server.requests.push(message.method);
        emit({ id: message.id, result: message.method === "initialize" ? {} : null });
      } else if (message.method === "textDocument/didOpen") {
        const { uri, version } = message.params.textDocument;
        onOpen(emit, uri, version);
      }
    },
  };
  return server;
}

const publish = (uri: string, version: number | undefined, ...messages: string[]) => ({
  method: "textDocument/publishDiagnostics",
  params: { uri, version, diagnostics: messages.map(diagnostic) },
});
const begin = { method: "pyright/beginProgress", params: [null] };
const end = { method: "pyright/endProgress", params: [null] };

const check = async (server: WorkerLike, timeoutMs?: number) => {
  const client = await PyrightClient.start(() => server);
  try {
    return (await client.check("a.py", "x = 1\n", timeoutMs)).map(d => d.message);
  } finally {
    client.dispose();
  }
};

describe("the answer among the publications of the server", () => {
  test("a file that is published once, before the end of the analysis (an earlier batch)", async () => {
    const server = scriptedServer((emit, uri, version) => {
      emit(begin);
      emit(publish(uri, version, "the error"));
      emit(end);
    });
    expect(await check(server)).toEqual(["the error"]);
  });

  test("a file that is published after the end of the analysis", async () => {
    const server = scriptedServer((emit, uri, version) => {
      emit(begin);
      emit(end);
      emit(publish(uri, version, "the error"));
    });
    expect(await check(server)).toEqual(["the error"]);
  });

  test("first what the server has found so far, and then, after the end, the final diagnostics", async () => {
    const server = scriptedServer((emit, uri, version) => {
      emit(begin);
      emit(publish(uri, version)); // no errors yet: an import is not analyzed
      emit(end);
      emit(publish(uri, version, "the error")); // sent in the same turn as the end
    });
    expect(await check(server)).toEqual(["the error"]);
  });

  test("a new analysis that begins before the answer to the request: the answer is from its end", async () => {
    const server = scriptedServer((emit, uri, version) => {
      emit(begin);
      emit(publish(uri, version, "so far"));
      emit(end);
      // The server has more to do (a file that this one imports changed): it begins again.
      emit(begin);
      emit(publish(uri, version, "final"));
      emit(end);
    });
    expect(await check(server)).toEqual(["final"]);
  });

  test("the publication of another version, or with no version (a closed file), is not the answer", async () => {
    const server = scriptedServer((emit, uri, version) => {
      emit(begin);
      emit(publish(uri, version + 1, "another version"));
      emit(publish(uri, undefined, "cleared"));
      emit(publish("file:///workspace/other.py", version, "another file"));
      emit(publish(uri, version, "the error"));
      emit(end);
    });
    expect(await check(server)).toEqual(["the error"]);
  });

  test("a server that does not end its analysis: an error after the time that was given", async () => {
    const server = scriptedServer((emit, uri, version) => {
      emit(begin);
      emit(publish(uri, version, "the error"));
    });
    await expect(check(server, 50)).rejects.toThrow(/did not answer within 50 ms/);
  });

  test("the server is asked something only when it is not analyzing", async () => {
    const server = scriptedServer((emit, uri, version) => {
      emit(begin);
      emit(publish(uri, version, "the error"));
      expect(server.requests).not.toContain("workspace/executeCommand");
      emit(end);
    });
    await check(server);
    expect(server.requests).toContain("workspace/executeCommand");
  });
});
