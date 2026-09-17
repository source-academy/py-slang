export type EV3ExecutionResult =
  | { status: "finished"; output: string } // output = base64-encoded assembled PVML binary
  | { status: "error"; error: string };
