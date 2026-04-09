import { BasicEvaluator } from "@sourceacademy/conductor/runner";
import initSinter from "../engines/svml/sinter/sinter";
import { assemble } from "../engines/svml/svml-assembler";
import { SVMLCompiler } from "../engines/svml/svml-compiler";
import { parse } from "../parser/parser-adapter";
import { analyzeWithEnvironments } from "../resolver";
import { toEvaluatorError } from "./errors";

function sinterValueToNative(value: { type: string; value?: unknown }): unknown {
  switch (value.type) {
    case "int":
    case "float":
    case "bool":
    case "string":
      return value.value;
    case "bigint":
      return Number(value.value);
    case "NoneType":
    case "undefined":
      return undefined;
    default:
      return undefined;
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
      const binary = assemble(program);

      if (!this.sinter) {
        this.sinter = await initSinter({ print: (text: string) => this.conductor.sendOutput(text) });
      }
      const result = this.sinter.runBinary(binary);
      const native = sinterValueToNative(result);             
      if (native !== undefined) {
          this.conductor.sendOutput(String(native));          
      }                                                       
      this.conductor.sendResult(native);
    } catch (e) {
      this.conductor.sendError(toEvaluatorError(e) as any);
    }
  }
}
