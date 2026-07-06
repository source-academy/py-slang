import { BasicEvaluator } from "@sourceacademy/conductor/runner";
import { PYNTER_OPCODE_MAX } from "../engines/pvml/opcodes";
import { assemble } from "../engines/pvml/pvml-assembler";
import { PVMLCompiler } from "../engines/pvml/pvml-compiler";
import initPynter, { PynterValue } from "../engines/pvml/pynter/pynter-wasm";
import { parse } from "../parser/parser-adapter";
import { analyzeWithEnvironments } from "../resolver";
import math from "../stdlib/math";
import misc from "../stdlib/misc";
import { EvaluatorError } from "./errors";

function pynterValueToNative(value: PynterValue): unknown {
  switch (value.type) {
    case "int":
    case "float":
    case "bool":
    case "string":
      return value.value;
    case "NoneType":
    case "undefined":
      return undefined;
    default:
      throw new Error(`Unsupported Pynter value type: ${(value as { type: string }).type}`);
  }
}

export class PyPvmlPynterEvaluator extends BasicEvaluator {
  private pynter: Awaited<ReturnType<typeof initPynter>> | null = null;

  async evaluateChunk(chunk: string): Promise<void> {
    try {
      const script = chunk + "\n";
      const ast = parse(script);
      const { errors, environments } = analyzeWithEnvironments(ast, script, 4, [misc, math]);
      if (errors.length > 0) {
        throw errors[0];
      }
      const compiler = PVMLCompiler.fromProgram(ast, environments);
      const program = compiler.compileProgram(ast);
      const binary = assemble(program, PYNTER_OPCODE_MAX);

      if (!this.pynter) {
        this.pynter = await initPynter({
          print: (text: string) => this.conductor.sendOutput(text),
        });
      }
      const result = this.pynter.runBinary(binary);
      this.conductor.sendResult(pynterValueToNative(result));
    } catch (e) {
      this.conductor.sendError(new EvaluatorError(e));
    }
  }
}
