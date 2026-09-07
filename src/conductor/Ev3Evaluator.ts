/// <reference types="node" />
import { BasicEvaluator, IRunnerPlugin } from "@sourceacademy/conductor/runner";
import { PYNTER_OPCODE_MAX } from "../engines/pvml/opcodes";
import { assemble } from "../engines/pvml/pvml-assembler";
import { PVMLCompiler } from "../engines/pvml/pvml-compiler";
import { runNativePynter } from "../engines/pvml/pynter/native-pynter";
import { parse } from "../parser/parser-adapter";
import { Resolver } from "../resolver";
import ev3 from "../stdlib/ev3";
import math from "../stdlib/math";
import misc from "../stdlib/misc";
import { EvaluatorError } from "./errors";

// TODO: `@sourceacademy/runner-remote-execution` (source-academy/plugins, package
// src/runner/remoteExecution — see PR #54) is not yet published, so it can't be a real dependency
// of this package yet. This is a minimal structural stand-in for its one public method
// (`RemoteExecutionPlugin.sendConnectionStatus`, confirmed against plugins#54's branch
// `remote-runner-plugin-fixed-54` at src/runner/remoteExecution/src/index.ts) so this file
// typechecks and its intent stays clear. It deliberately does NOT go through
// `conductor.registerPlugin` (the real `RemoteExecutionPlugin` is an `IPlugin` with its own
// channel-attach/id machinery this stand-in has no reason to fake) — once the real package
// publishes, delete this block and replace both it and the constructor below with: `import {
// RemoteExecutionPlugin, type ConnectionStatus } from "@sourceacademy/runner-remote-execution";`
// plus `conductor.registerPlugin(RemoteExecutionPlugin)`, add the package as a real dependency.
type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";
interface RemoteExecutionPlugin {
  sendConnectionStatus(status: ConnectionStatus): void;
}
function makeRemoteExecutionPluginStub(): RemoteExecutionPlugin {
  return {
    sendConnectionStatus(_status: ConnectionStatus): void {
      // No-op until the real plugin registration replaces this stub — see TODO above.
    },
  };
}

/**
 * Path to the native pynter `runner` binary (built via CMake — see the pynter repo's build
 * instructions). Only used in Node contexts (this evaluator, via native-pynter.ts, spawns a child
 * process and cannot run inside a browser Web Worker) — this is a *local development/testing*
 * evaluator that runs a compiled program against the native VM directly on this machine, distinct
 * from the on-device EV3 pipeline (which stays entirely on EV3Engine/Ev3ExecutionPlugin, compiling
 * bytecode for transmission rather than running it locally at all — see EV3Engine's own doc
 * comment).
 *
 * TODO: confirm the actual mechanism this should come from (env var name, config file, etc.)
 * rather than this placeholder default.
 */
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

/**
 * Compiles and runs a robot control program against a *local* native pynter binary — a
 * local-development/testing counterpart to the real on-device pipeline (EV3Engine +
 * Ev3ExecutionPlugin compile bytecode for a physical robot over sling; this runs it right here via
 * child_process instead), useful for exercising EV3-flavoured Python without hardware attached.
 * Calls to actual `ev3_*` functions still fail to compile today — see stdlib/ev3.ts's doc comment
 * — so this only actually runs programs that don't call the EV3 API yet.
 */
export class Ev3Evaluator extends BasicEvaluator {
  private readonly remoteExecutionPlugin: RemoteExecutionPlugin;

  constructor(conductor: IRunnerPlugin) {
    super(conductor);
    this.remoteExecutionPlugin = makeRemoteExecutionPluginStub();
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

      // targetsPynter=true: native pynter's fixed-width value representation can't carry LGCBI's
      // arbitrary-precision bigint constants — see PVMLCompiler's `targetsPynter` doc comment.
      const compiler = PVMLCompiler.fromProgram(ast, 0, environments, false, true);
      const program = compiler.compileProgram(ast);
      const binary = assemble(program, PYNTER_OPCODE_MAX);

      this.remoteExecutionPlugin.sendConnectionStatus("connecting");
      const { output, fault, resultType, resultValue } = await runNativePynter(
        binary,
        PYNTER_RUNNER_PATH,
      );
      this.remoteExecutionPlugin.sendConnectionStatus("connected");

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
