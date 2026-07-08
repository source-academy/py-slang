/// <reference types="node" />
import { BasicEvaluator, IRunnerPlugin } from "@sourceacademy/conductor/runner";
import { RemoteExecutionPlugin } from "@sourceacademy/runner-remote-execution";
import { PYNTER_OPCODE_MAX } from "../engines/pvml/opcodes";
import { assemble } from "../engines/pvml/pvml-assembler";
import { PVMLCompiler } from "../engines/pvml/pvml-compiler";
import { runNativePynter } from "../engines/pvml/pynter/native-pynter";
import { parse } from "../parser/parser-adapter";
import { Resolver } from "../resolver/resolver";
import ev3, { EV3_FUNCTIONS } from "../stdlib/ev3";
import math from "../stdlib/math";
import misc from "../stdlib/misc";
import { EvaluatorError } from "./errors";

const EV3_INTERNAL_FUNCTIONS = new Map(EV3_FUNCTIONS.map((name, i) => [name, i]));

// Path to the native pynter `runner` binary (built via CMake — see the
// pynter repo's build instructions). Only used in Node contexts (this
// evaluator, via native-pynter.ts, spawns a child process and cannot run
// inside a browser Web Worker) — e.g. py-slang's own REPL/CLI, not the
// on-device EV3 pipeline (which stays entirely on EV3Engine/Ev3ExecutionPlugin).
//
// TODO: confirm the actual mechanism this should come from (env var name,
// config file, etc.) rather than this placeholder default.
const PYNTER_RUNNER_PATH = process.env.PYNTER_PATH ?? "./build/runner/runner";

/** Best-effort conversion of native pynter's string result into a JS value. */
function nativeResultToJs(resultType: string, resultValue: string): unknown {
  switch (resultType) {
    case "integer":
      return parseInt(resultValue, 10);
    case "float":
      return parseFloat(resultValue);
    case "boolean":
      return resultValue === "true";
    case "string":
      return resultValue;
    case "undefined":
    case "null":
      return undefined;
    default:
      return resultValue;
  }
}

export class Ev3Evaluator extends BasicEvaluator {
  private readonly remoteExecutionPlugin: RemoteExecutionPlugin;

  constructor(conductor: IRunnerPlugin) {
    super(conductor);
    this.remoteExecutionPlugin = conductor.registerPlugin(
      RemoteExecutionPlugin as never,
    ) as unknown as RemoteExecutionPlugin;
  }

  async evaluateChunk(chunk: string): Promise<void> {
    try {
      const script = chunk + "\n";
      const ast = parse(script);

      const resolver = new Resolver("", ast, [], [misc, math, ev3]);
      const environments = resolver.resolveEnvironments(ast);
      if (resolver.errors.length > 0) {
        throw resolver.errors[0];
      }

      const compiler = PVMLCompiler.fromProgram(ast, environments, EV3_INTERNAL_FUNCTIONS);
      const program = compiler.compileProgram(ast);
      const binary = assemble(program, PYNTER_OPCODE_MAX);

      const { output, fault, resultType, resultValue } = await runNativePynter(
        binary,
        PYNTER_RUNNER_PATH,
      );

      if (output) {
        this.conductor.sendOutput(output);
      }

      if (fault !== "no fault") {
        throw new Error(`pynter fault: ${fault}`);
      }

      this.conductor.sendResult(nativeResultToJs(resultType, resultValue));
    } catch (e) {
      this.conductor.sendError(new EvaluatorError(e));
    }
  }
}
