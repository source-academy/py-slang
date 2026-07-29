import {
  CompletionItemKind,
  type AceRule,
  type AutoCompleteMessage,
  type KeywordMapperArgs,
  type SyntaxHighlightMessage,
  type TokenizerRule,
  type TransferredSyntaxHighlightData,
} from "@sourceacademy/common-autocomplete";
import type { IChannel, IConduit } from "@sourceacademy/conductor/conduit";
import AutoCompletePlugin from "../conductor/plugins/autocomplete";

class TestChannel<T> implements IChannel<T> {
  readonly name = "test";
  private readonly subscribers = new Set<(message: T) => void>();
  peer?: TestChannel<T>;

  send(message: T): void {
    this.peer?.emit(message);
  }

  subscribe(subscriber: (message: T) => void): void {
    this.subscribers.add(subscriber);
  }

  unsubscribe(subscriber: (message: T) => void): void {
    this.subscribers.delete(subscriber);
  }

  close(): void {
    this.subscribers.clear();
  }

  private emit(message: T): void {
    for (const subscriber of this.subscribers) {
      subscriber(message);
    }
  }
}

function makeChannelPair<T>(): [TestChannel<T>, TestChannel<T>] {
  const runner = new TestChannel<T>();
  const web = new TestChannel<T>();
  runner.peer = web;
  web.peer = runner;
  return [runner, web];
}

function makePlugin(variant: number) {
  const [runnerAutocomplete, webAutocomplete] = makeChannelPair<AutoCompleteMessage>();
  const [runnerSyntax, webSyntax] = makeChannelPair<SyntaxHighlightMessage>();
  const plugin = new AutoCompletePlugin(
    {} as IConduit,
    [runnerAutocomplete, runnerSyntax],
    variant,
  );
  return { plugin, webAutocomplete, webSyntax };
}

function requestAutocomplete(
  channel: TestChannel<AutoCompleteMessage>,
  code: string,
  row: number,
  column: number,
) {
  let declarations;
  channel.subscribe(message => {
    if (message.type === "response") {
      declarations = message.declarations;
    }
  });
  channel.send({ type: "request", requestId: 0, code, row, column });
  return declarations;
}

function requestMode(channel: TestChannel<SyntaxHighlightMessage>) {
  let mode: TransferredSyntaxHighlightData | undefined;
  channel.subscribe(message => {
    if (message.type === "response") {
      mode = message.data;
      channel.send({ type: "ack" });
    }
  });
  channel.send({ type: "request" });
  return mode;
}

function isKeywordMapperRule(rule: AceRule): rule is TokenizerRule & { token: KeywordMapperArgs } {
  return (
    "token" in rule &&
    typeof rule.token === "object" &&
    !Array.isArray(rule.token) &&
    "map" in rule.token
  );
}

describe("AutoCompletePlugin Conductor channels", () => {
  test("returns scoped and imported declarations over the autocomplete channel", () => {
    const { webAutocomplete, webSyntax } = makePlugin(2);
    webSyntax.send({ type: "ack" });

    const declarations = requestAutocomplete(
      webAutocomplete,
      "from sound import sine_sound as sine\nsample = 1\nsi",
      3,
      2,
    );

    expect(declarations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "sine",
          meta: CompletionItemKind.Variable,
        }),
      ]),
    );
    expect(declarations).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "sine_sound" })]),
    );
  });

  test("applies chapter gates to autocomplete responses", () => {
    const chapter1 = makePlugin(1);
    const chapter3 = makePlugin(3);
    chapter1.webSyntax.send({ type: "ack" });
    chapter3.webSyntax.send({ type: "ack" });

    expect(requestAutocomplete(chapter1.webAutocomplete, "wh", 1, 2)).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "while" })]),
    );
    expect(requestAutocomplete(chapter3.webAutocomplete, "wh", 1, 2)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "while",
          meta: CompletionItemKind.Keyword,
        }),
      ]),
    );
  });

  test("transfers the Python mode and hookFrom references over the syntax channel", () => {
    const { plugin, webSyntax } = makePlugin(3);
    const mode = requestMode(webSyntax);

    expect(plugin.id).toBe("__autocomplete_plugin_runner");
    expect(mode).toEqual(
      expect.objectContaining({
        id: "ace/mode/python3",
        snippetFileId: "ace/snippets/python",
        lineCommentStart: "#",
        foldingRules: {
          hookFrom: "ace/mode/folding/pythonic",
          args: ["\\:"],
        },
        indents: { hookFrom: "ace/mode/python" },
        outdents: { hookFrom: "ace/mode/python" },
        autoOutdent: { hookFrom: "ace/mode/python" },
      }),
    );
  });

  test("transfers chapter-specific syntax-highlighting keywords and builtins", () => {
    const chapter1 = makePlugin(1);
    const chapter3 = makePlugin(3);
    const chapter1Mode = requestMode(chapter1.webSyntax);
    const chapter3Mode = requestMode(chapter3.webSyntax);

    const chapter1Mapper = chapter1Mode?.highlightRules.constants.find(isKeywordMapperRule);
    const chapter3Mapper = chapter3Mode?.highlightRules.constants.find(isKeywordMapperRule);

    expect(chapter1Mapper?.token).toEqual(
      expect.objectContaining({
        map: expect.objectContaining({
          keyword: expect.stringContaining("def"),
        }),
      }),
    );
    expect(chapter1Mapper?.token.map.keyword).not.toContain("while");
    expect(chapter3Mapper?.token).toEqual(
      expect.objectContaining({
        map: expect.objectContaining({
          keyword: expect.stringContaining("while"),
          "support.function": expect.stringContaining("range"),
        }),
      }),
    );
  });
});
