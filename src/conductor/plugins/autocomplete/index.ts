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
  private readonly evaluatorName: string;

  constructor(
    _conduit: IConduit,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    channels: IChannel<any>[],
    variant: number,
    evaluatorName: string,
  ) {
    super(_conduit, channels);
    this.variant = variant;
    this.evaluatorName = evaluatorName;
  }

  get mode(): SyntaxHighlightData {
    return pythonMode(this.variant, this.evaluatorName);
  }

  autocomplete(code: string, row: number, column: number): AutoCompleteEntry[] {
    const tree = parser.parse(code);

    const entries = getNames(tree, code, row, column, this.variant);
    return entries;
  }
}
