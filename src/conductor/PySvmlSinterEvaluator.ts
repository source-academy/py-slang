import { BasicEvaluator } from "@sourceacademy/conductor/runner";
import initSinter, { SinterValue } from "../engines/svml/sinter/sinter";
import { SINTER_OPCODE_MAX } from "../engines/svml/opcodes";
import { assemble } from "../engines/svml/svml-assembler";
import { SVMLCompiler } from "../engines/svml/svml-compiler";
import { parse } from "../parser/parser-adapter";
import { analyzeWithEnvironments } from "../resolver";
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
      const { errors, environments } = analyzeWithEnvironments(ast, script, 4);
      if (errors.length > 0) {
        throw errors[0];
      }
      const compiler = SVMLCompiler.fromProgram(ast, environments);
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
