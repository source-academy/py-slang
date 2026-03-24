import { parser } from "@lezer/python";
import { IChannel, IConduit, IPlugin } from "@sourceacademy/conductor/conduit";

import { AUTOCOMPLETE_CHANNEL_ID, RUNNER_PLUGIN_ID, SYNTAX_CHANNEL_ID } from "./constants";
import pythonMode from "./mode";
import { getNames } from "./resolver";
import type { AutoCompleteMessage, SyntaxHighlightMessage } from "./types";

/**
 * This plugin provides autocomplete suggestions and syntax highlighting for Python code.
 *
 * It provides two channels: one for autocomplete requests and responses, and another for sending syntax highlighting information to the web plugin.
 *  a) The autocomplete channel listens for requests containing the current code and cursor position. It uses the resolver to find relevant symbols based on the cursor position and sends back a response with the autocomplete suggestions.
 *  b) The syntax highlighting channel periodically sends the Python mode information to the web plugin until it receives an acknowledgment, ensuring that the web plugin has the necessary information to perform syntax highlighting.
 */
export default class AutoCompletePlugin implements IPlugin {
  static readonly channelAttach = [AUTOCOMPLETE_CHANNEL_ID, SYNTAX_CHANNEL_ID];
  readonly id: string = RUNNER_PLUGIN_ID;

  private readonly __autoCompleteChannel: IChannel<AutoCompleteMessage>;
  private readonly __syntaxHighlightChannel: IChannel<SyntaxHighlightMessage>;

  constructor(
    _conduit: IConduit,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [autoCompleteChannel, syntaxHighlightChannel]: IChannel<any>[],
    variant: number,
  ) {
    this.__autoCompleteChannel = autoCompleteChannel;
    this.__syntaxHighlightChannel = syntaxHighlightChannel;
    const handler = setInterval(() => {
      this.__syntaxHighlightChannel.send({
        type: "message",
        data: pythonMode(variant),
      });
    }, 1000);
    this.__syntaxHighlightChannel.subscribe((message: SyntaxHighlightMessage) => {
      if (message.type === "ack") {
        clearInterval(handler);
      }
    });
    this.__autoCompleteChannel.subscribe((message: AutoCompleteMessage) => {
      if (message.type === "request") {
        const tree = parser.parse(message.code);

        const entries = getNames(tree, message.code, message.row, message.column, variant);
        this.__autoCompleteChannel.send({
          type: "response",
          declarations: entries,
        });
      }
    });
  }
}
