import { BasicEvaluator } from "@sourceacademy/conductor/runner";
import { SINTER_OPCODE_MAX } from "../engines/pvml/opcodes";
import initSinter, { SinterValue } from "../engines/pvml/sinter/sinter";
import { assemble } from "../engines/pvml/pvml-assembler";
import { PVMLCompiler } from "../engines/pvml/pvml-compiler";
import { parse } from "../parser/parser-adapter";
import { analyzeWithEnvironments } from "../resolver";
import math from "../stdlib/math";
import misc from "../stdlib/misc";
import { EvaluatorError } from "./errors";

function sinterValueToNative(value: SinterValue): unknown {
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
      throw new Error(`Unsupported Sinter value type: ${(value as { type: string }).type}`);
  }
}

export class PySvmlSinterEvaluator extends BasicEvaluator {
  private sinter: Awaited<ReturnType<typeof initSinter>> | null = null;

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
      const binary = assemble(program, SINTER_OPCODE_MAX);

      if (!this.sinter) {
        this.sinter = await initSinter({
          print: (text: string) => this.conductor.sendOutput(text),
        });
      }
      const result = this.sinter.runBinary(binary);
      this.conductor.sendResult(sinterValueToNative(result));
    } catch (e) {
      this.conductor.sendError(new EvaluatorError(e));
    }
  }
}
