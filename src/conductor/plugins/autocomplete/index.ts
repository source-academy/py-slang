import { parser } from "@lezer/python";
import {
  AutoCompleteEntry,
  BaseAutoCompleteRunnerPlugin,
  SyntaxHighlightData,
} from "@sourceacademy/autocomplete";
import { IChannel, IConduit } from "@sourceacademy/conductor/conduit";
import pythonMode from "./mode";
import { getNames } from "./resolver";

export default class AutoCompletePlugin extends BaseAutoCompleteRunnerPlugin {
  private readonly variant: number;
  constructor(
    _conduit: IConduit,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    channels: IChannel<any>[],
    variant: number,
  ) {
    super(_conduit, channels);
    this.variant = variant;
  }

  get mode(): SyntaxHighlightData {
    return pythonMode(this.variant);
  }

  autocomplete(code: string, row: number, column: number): AutoCompleteEntry[] {
    const tree = parser.parse(code);

    const entries = getNames(tree, code, row, column, this.variant);
    return entries;
  }
}
